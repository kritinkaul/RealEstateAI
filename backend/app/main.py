from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .ai_client import GeminiClient
from .project_loader import list_projects, load_project


load_dotenv()

app = FastAPI(title="RealEstateAI API", version="0.1.0")
ai_client = GeminiClient()

# Local dev: any Vite port (5173, 5174, …) and either localhost or 127.0.0.1
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    projectId: str | None = None


class AnalyzeRequest(BaseModel):
    projectId: str | None = None


def get_project_or_404(project_id: str | None = None) -> dict[str, Any]:
    try:
        return load_project(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found.") from exc


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "geminiConfigured": ai_client.is_configured,
        "geminiModel": ai_client.model,
    }


@app.get("/project")
def get_project() -> dict[str, Any]:
    return load_project()


@app.get("/projects")
def get_projects() -> dict[str, list[dict[str, Any]]]:
    return {"projects": list_projects()}


@app.get("/project/{project_id}")
def get_project_by_id(project_id: str) -> dict[str, Any]:
    return get_project_or_404(project_id)


@app.post("/analyze")
async def analyze_project(request: AnalyzeRequest | None = None) -> dict[str, Any]:
    project = get_project_or_404(request.projectId if request else None)
    return await ai_client.analyze_project(project)


@app.post("/chat")
async def chat(request: ChatRequest) -> dict[str, str]:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    project = get_project_or_404(request.projectId)
    return await ai_client.chat(project, message)
