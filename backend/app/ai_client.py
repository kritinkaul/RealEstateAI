from __future__ import annotations

from typing import Any
import asyncio
import json
import os
import re

import httpx


GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


ANALYSIS_SYSTEM_PROMPT = """
You are a senior owner-side construction project manager reviewing a live portfolio.
Analyze the project data the way you would in a Friday owner report: direct, specific, no filler.

Return only valid JSON with this exact shape:
{
  "summary": "2-4 sentence executive summary",
  "criticalRisks": [
    {"title": "risk title", "detail": "risk detail", "severity": "High|Medium|Low"}
  ],
  "predictions": [
    {"title": "prediction title", "detail": "what may happen next"}
  ],
  "recommendedActions": [
    {"title": "action title", "detail": "specific next step", "owner": "role or contractor"}
  ],
  "actionsTaken": [
    {"title": "simulated action title", "detail": "what you would log, email, or escalate as PM"}
  ]
}

Focus on delayed tasks, budget overruns, dependency effects, and next likely blockers.
Be concise, specific, and realistic for owner and engineering review.
"""


CHAT_SYSTEM_PROMPT = """
You are the lead PM on this construction job. Answer from the project data only—plain language, no preamble, no "As an AI".
When useful, cite task names, contractors, deadlines, dependencies, and dollars.
If the question is off-topic, say you only cover this job and give one example question.
Keep under 180 words.
"""


class GeminiClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def analyze_project(self, project: dict[str, Any]) -> dict[str, Any]:
        if not self.is_configured:
            return build_local_analysis(project)

        user_text = f"Project JSON:\n{json.dumps(project, indent=2)}"

        try:
            text = await self._generate_text(ANALYSIS_SYSTEM_PROMPT, user_text, json_mode=True)
            parsed = parse_json_response(text)
            if parsed:
                parsed["source"] = "gemini"
                return parsed
            return build_local_analysis(project)
        except httpx.HTTPStatusError as exc:
            return build_local_analysis(project, _format_gemini_error(exc.response))
        except Exception as exc:
            return build_local_analysis(project, str(exc))

    async def chat(self, project: dict[str, Any], message: str) -> dict[str, str]:
        if not self.is_configured:
            return {
                "answer": build_local_chat_answer(project, message),
                "source": "local-rules",
            }

        user_text = f"Project JSON:\n{json.dumps(project, indent=2)}\n\nUser question: {message}"

        try:
            answer = await self._generate_text(CHAT_SYSTEM_PROMPT, user_text)
            return {"answer": answer.strip(), "source": "gemini"}
        except Exception:
            return {
                "answer": build_local_chat_answer(project, message),
                "source": "local-rules",
            }

    async def _generate_text(self, system_instruction: str, user_text: str, json_mode: bool = False) -> str:
        errors: list[Exception] = []
        models = _model_fallback_chain(self.model)

        for model in models:
            for attempt in range(2):
                try:
                    return await self._request_model(model, system_instruction, user_text, json_mode)
                except httpx.HTTPStatusError as exc:
                    errors.append(exc)
                    if exc.response.status_code not in {429, 500, 502, 503, 504}:
                        raise
                except Exception as exc:
                    errors.append(exc)

                await asyncio.sleep(0.45 * (attempt + 1))

        raise errors[-1] if errors else RuntimeError("Gemini request failed.")

    async def _request_model(
        self, model: str, system_instruction: str, user_text: str, json_mode: bool = False
    ) -> str:
        url = GEMINI_API_URL.format(model=model)
        generation_config: dict[str, Any] = {
            "temperature": 0.2,
            "topP": 0.85,
            "maxOutputTokens": 8192,
        }
        if json_mode:
            generation_config["responseMimeType"] = "application/json"
        thinking = _thinking_config_for_model(model)
        if thinking is not None:
            generation_config["thinkingConfig"] = thinking

        payload: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_instruction.strip()}]},
            "contents": [{"role": "user", "parts": [{"text": user_text}]}],
            "generationConfig": generation_config,
        }
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code == 400 and thinking is not None:
                cfg = {k: v for k, v in generation_config.items() if k != "thinkingConfig"}
                payload_retry = {
                    **payload,
                    "generationConfig": cfg,
                }
                response = await client.post(url, headers=headers, json=payload_retry)
            if response.status_code in {429, 500, 502, 503, 504}:
                response.raise_for_status()
            if response.status_code >= 400:
                raise RuntimeError(_format_gemini_error(response))

        data = response.json()
        if data.get("promptFeedback", {}).get("blockReason"):
            raise ValueError(f"Prompt blocked: {data['promptFeedback']['blockReason']}")
        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini returned no candidates (check API key, model name, and quota).")
        parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
        text = "".join(part.get("text", "") for part in parts)
        if not text.strip():
            fr = candidates[0].get("finishReason", "unknown")
            raise ValueError(
                f"Gemini returned empty output (finishReason={fr}). "
                "For Gemini 2.5 Flash, set thinkingBudget to 0 or increase maxOutputTokens."
            )
        return text


def _model_fallback_chain(primary: str) -> list[str]:
    fallbacks = [
        primary,
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ]
    seen: set[str] = set()
    ordered: list[str] = []
    for m in fallbacks:
        m = m.strip()
        if m and m not in seen:
            seen.add(m)
            ordered.append(m)
    return ordered


def _thinking_config_for_model(model: str) -> dict[str, int] | None:
    lowered = model.lower()
    if "gemini-2.5-flash" in lowered and "preview" not in lowered:
        return {"thinkingBudget": 0}
    return None


def _format_gemini_error(response: httpx.Response) -> str:
    try:
        data = response.json()
        err = data.get("error", {})
        msg = err.get("message", response.text)
        return f"Gemini API {response.status_code}: {msg}"
    except Exception:
        return f"Gemini API {response.status_code}: {response.text}"


def parse_json_response(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def build_local_analysis(project: dict[str, Any], service_note: str | None = None) -> dict[str, Any]:
    tasks = project.get("tasks", [])
    delayed = [task for task in tasks if task.get("status") == "delayed"]
    over_budget = [
        task
        for task in tasks
        if float(task.get("actualCost", 0)) > float(task.get("budget", 0))
    ]
    dependency_map = {task.get("id"): task for task in tasks}
    impacted = []
    delayed_ids = {task.get("id") for task in delayed}

    for task in tasks:
        blockers = [dep for dep in task.get("dependencies", []) if dep in delayed_ids]
        if blockers:
            impacted.append(
                {
                    "task": task,
                    "blockers": [dependency_map[dep]["name"] for dep in blockers if dep in dependency_map],
                }
            )

    highest_risk = delayed[0] if delayed else (over_budget[0] if over_budget else tasks[0])

    return {
        "summary": (
            f"{project.get('name', 'The project')} has {len(delayed)} delayed tasks and "
            f"{len(over_budget)} budget overrun flags. The immediate concern is "
            f"{highest_risk.get('name')}, because it can slow dependent work and compress the inspection window."
        ),
        "criticalRisks": [
            {
                "title": task["name"],
                "detail": (
                    f"{task['contractor']} is marked delayed with a {task['deadline']} deadline. "
                    f"Budget is ${task['budget']:,} versus actual ${task['actualCost']:,}."
                ),
                "severity": "High" if task in delayed[:2] else "Medium",
            }
            for task in delayed[:4]
        ]
        + [
            {
                "title": f"Budget pressure: {task['name']}",
                "detail": (
                    f"Actual cost is ${task['actualCost']:,}, above the ${task['budget']:,} budget. "
                    "This should be reviewed before approving downstream scope changes."
                ),
                "severity": "Medium",
            }
            for task in over_budget[:2]
        ],
        "predictions": [
            {
                "title": f"{item['task']['name']} may slip next",
                "detail": (
                    f"It depends on delayed work: {', '.join(item['blockers'])}. "
                    "Without recovery action, this task will likely miss its planned start."
                ),
            }
            for item in impacted[:4]
        ]
        or [
            {
                "title": "Schedule buffer will tighten",
                "detail": "Current delays are not yet cascading widely, but float should be protected now.",
            }
        ],
        "recommendedActions": [
            {
                "title": "Escalate delayed critical path work",
                "detail": (
                    f"Hold a same-day recovery call with {highest_risk.get('contractor')} and request a "
                    "48-hour recovery plan with labor, material, and inspection constraints."
                ),
                "owner": "Project Manager",
            },
            {
                "title": "Re-sequence dependent tasks",
                "detail": "Move any work that does not depend on delayed permits, utilities, or inspections into the next available work window.",
                "owner": "Scheduler",
            },
            {
                "title": "Freeze discretionary change orders",
                "detail": "Review over-budget tasks before approving new scope so budget variance does not compound.",
                "owner": "Owner Representative",
            },
        ],
        "actionsTaken": [
            {
                "title": "Created risk alert",
                "detail": f"Logged {len(delayed)} delayed tasks and routed the highest-risk item to the project manager.",
            },
            {
                "title": "Flagged dependency impact",
                "detail": f"Identified {len(impacted)} tasks that are exposed to delayed prerequisites.",
            },
            {
                "title": "Prepared recovery agenda",
                "detail": "Drafted talking points for contractor escalation, schedule recovery, and budget review.",
            },
        ],
        "source": "local-rules",
        "serviceNote": service_note,
    }


def build_local_chat_answer(project: dict[str, Any], message: str) -> str:
    tasks = project.get("tasks", [])
    delayed = [task for task in tasks if task.get("status") == "delayed"]
    over_budget = [
        task
        for task in tasks
        if float(task.get("actualCost", 0)) > float(task.get("budget", 0))
    ]
    first_issue = delayed[0] if delayed else (over_budget[0] if over_budget else None)
    lower_message = message.lower()

    if not is_project_question(lower_message):
        return (
            f"I can help with {project.get('name', 'this project')} only. "
            "Try asking which task is most critical, why the schedule is slipping, or what action the project team should take next."
        )

    if lower_message.strip() in {"hi", "hello", "hey", "hello bron", "hello bro", "yo"}:
        return (
            f"I am ready on {project.get('name', 'this project')}. "
            "Ask me about schedule risk, budget exposure, dependencies, or the first issue to fix."
        )

    if not first_issue:
        return "The project looks stable right now. I would keep monitoring deadlines, contractor handoffs, and actual cost against budget."

    if "biggest" in lower_message or "first" in lower_message or "fix" in lower_message:
        return (
            f"The biggest issue is {first_issue['name']}. It is assigned to {first_issue['contractor']}, "
            f"due {first_issue['deadline']}, and is currently {first_issue['status']}. Fix this first because dependent tasks can lose schedule float quickly."
        )

    if "why" in lower_message or "delayed" in lower_message:
        names = ", ".join(task["name"] for task in delayed[:4])
        return (
            f"The project is delayed because these tasks are off track: {names}. "
            "The main risk is that tasks with dependencies cannot start cleanly until their blockers are recovered."
        )

    if "budget" in lower_message or "cost" in lower_message:
        names = ", ".join(
            f"{task['name']} (${task['actualCost']:,} actual vs ${task['budget']:,} budget)"
            for task in over_budget[:3]
        )
        return f"Budget pressure is concentrated in: {names or 'no current over-budget tasks'}. Review these before approving more change orders."

    return (
        f"I would focus on {first_issue['name']} first, then re-check dependent tasks and budget exposure. "
        "The practical next move is a recovery call, a revised schedule, and a clear owner for each blocker."
    )


def is_project_question(message: str) -> bool:
    project_terms = {
        "project", "task", "tasks", "issue", "risk", "risks", "delay", "delayed", "late",
        "schedule", "deadline", "budget", "cost", "overrun", "contractor", "dependency",
        "dependencies", "fix", "first", "permit", "inspection", "construction", "owner",
        "engineer", "phase", "critical", "action", "recommend", "next", "why", "what",
        "status", "blocked", "blocker", "blocking", "hello", "hi", "hey", "yo",
    }
    return any(term in message for term in project_terms)
