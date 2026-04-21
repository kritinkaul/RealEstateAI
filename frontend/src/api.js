function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  const trimmed = fromEnv != null ? String(fromEnv).trim() : "";
  if (trimmed !== "") {
    return trimmed.replace(/\/$/, "");
  }
  // Dev: same-origin /api → Vite proxies to FastAPI
  if (import.meta.env.DEV) {
    return "/api";
  }
  // SSR / Node tests only (no browser)
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8001";
  }
  // Production in the browser (e.g. Vercel): never guess hostname:8001 — that hits the static
  // frontend host (e.g. real-estate-ai-frontend.vercel.app:8001), not Render.
  throw new Error(
    "Missing VITE_API_BASE_URL. In Vercel → Project → Settings → Environment Variables, set it to your Render API origin (example: https://your-service.onrender.com) with no trailing slash, then redeploy the frontend."
  );
}

// Dev: Vite proxy + local API. Production (hosted API): allow cold starts.
const DEFAULT_TIMEOUT_MS = import.meta.env.DEV ? 15000 : 60000;

async function request(path, options = {}) {
  const API_BASE_URL = getApiBaseUrl();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
      ...options,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(
        `Request timed out (${DEFAULT_TIMEOUT_MS / 1000}s). Open your Render /health URL once to wake the service, then retry.`
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }

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

/** Resolved API origin; throws in production if VITE_API_BASE_URL is not set. */
export function getResolvedApiBaseUrl() {
  return getApiBaseUrl();
}
