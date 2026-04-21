function resolveApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (fromEnv != null && String(fromEnv).trim() !== "") {
    return String(fromEnv).trim().replace(/\/$/, "");
  }
  // Dev server: same-origin /api → Vite proxies to FastAPI (avoids CORS + connection issues)
  if (import.meta.env.DEV) {
    return "/api";
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8001`;
  }
  return "http://127.0.0.1:8001";
}

const API_BASE_URL = resolveApiBaseUrl();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      raw ? `${response.status}: ${raw.slice(0, 280)}` : `Request failed (${response.status})`
    );
  }

  if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d?.msg || d).join("; ")
          : data?.message || raw?.slice(0, 280) || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function getProject() {
  return request("/project");
}

export function getProjects() {
  return request("/projects");
}

export function analyzeProject(projectId) {
  return request("/analyze", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
}

export function sendChatMessage(message, projectId) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ message, projectId }),
  });
}

export { API_BASE_URL };
