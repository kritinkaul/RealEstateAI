import { useEffect, useRef, useState } from "react";
import { MessageSquareText, Send, UserRound } from "lucide-react";
import { sendChatMessage } from "../api";

function normalizeAssistantText(payload) {
  if (payload == null) {
    return "No reply received. Check that the API is running on port 8001.";
  }
  const answer = payload.answer;
  if (typeof answer === "string") {
    return answer;
  }
  if (answer != null && typeof answer === "object") {
    try {
      return JSON.stringify(answer);
    } catch {
      return String(answer);
    }
  }
  if (answer != null) {
    return String(answer);
  }
  return "Unexpected response from the server. Try again or reload the page.";
}

const starters = [
  "Biggest issue",
  "Why delayed?",
  "Fix first",
  "Budget risk",
];

function ChatBox({ projectReady, projectId, projectName }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Ask about slip risk, who is exposed downstream, budget pressure, or what to escalate first.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const sendLockRef = useRef(false);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Context is ${projectName}. Ask what is late, what it is blocking, where cost is drifting, or what to do Monday morning.`,
      },
    ]);
    setInput("");
    setError("");
  }, [projectName]);

  const submitMessage = async (text) => {
    const promptMap = {
      "Biggest issue": "What is the biggest issue?",
      "Why delayed?": "Why is the project delayed?",
      "Fix first": "What should I fix first?",
      "Budget risk": "Where is the biggest budget risk?",
    };
    const clean = (promptMap[text] || text).trim();
    if (!clean || !projectReady || isSending || sendLockRef.current) {
      return;
    }

    sendLockRef.current = true;
    setMessages((current) => [...current, { role: "user", content: clean }]);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const result = await sendChatMessage(clean, projectId);
      const reply = normalizeAssistantText(result);
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (requestError) {
      const msg = requestError?.message || "Chat request failed.";
      setError(msg);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Could not reach the desk. Start the API (`uvicorn` on port 8001) or check the browser Network tab for errors.",
        },
      ]);
    } finally {
      sendLockRef.current = false;
      setIsSending(false);
    }
  };

  return (
    <section className="chat-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Project inbox</span>
          <h2>Ask the desk</h2>
        </div>
      </div>

      <div className="starter-row">
        {starters.map((starter) => (
          <button
            type="button"
            key={starter}
            onClick={() => submitMessage(starter)}
            disabled={isSending || !projectReady}
          >
            {starter}
          </button>
        ))}
      </div>

      <div className="chat-log" aria-live="polite">
        {messages.map((message, index) => (
          <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <span className="avatar">{message.role === "assistant" ? <MessageSquareText size={15} /> : <UserRound size={16} />}</span>
            <p>{message.content}</p>
          </div>
        ))}
        {isSending && (
          <div className="chat-message assistant">
            <span className="avatar">
              <MessageSquareText size={15} />
            </span>
            <p className="thinking-text">Drafting reply…</p>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitMessage(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`Message about ${projectName}…`}
          disabled={!projectReady || isSending}
        />
        <button type="submit" aria-label="Send chat message" disabled={!input.trim() || isSending}>
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}

export default ChatBox;
