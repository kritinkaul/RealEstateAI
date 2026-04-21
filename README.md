# RealEstateAI

A FastAPI + React owner desk for construction portfolios: schedule exposure, budget variance, and Gemini-backed readouts and Q&A (with offline rules if the API is unavailable).

The backend defaults to `gemini-2.5-flash-lite`. **Gemini 2.5 Flash** models use internal “thinking” tokens; this app sets `thinkingBudget: 0` on Flash/Flash-Lite so replies are not starved of output tokens.

## Run Locally

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="your_key_here"
export CORS_ORIGINS="https://real-estate-ai-frontend.vercel.app"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

After `pip install`, you can also start the API from the repo root with `npm run dev:api` (uses `backend/.venv`).

Frontend (from repo root — recommended):

```bash
npm install
npm run dev
```

Keep the **API running on port 8001** while you use the UI. In development, Vite proxies `/api` → `http://127.0.0.1:8001`, so the browser does not call port 8001 directly (fewer CORS/network issues).

Or from `frontend/` only:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/`). If port 5173 is in use, Vite picks the next free port. Use **Node 18+** (Vite 6).

## API

- `GET /project` returns the sample project JSON
- `GET /projects` returns the project portfolio
- `GET /project/{project_id}` returns one project
- `POST /analyze` returns structured readout sections
- `POST /chat` answers project questions with project context

If Gemini is not configured or the request fails, the backend falls back to deterministic local rules and includes a `serviceNote` on analyze when useful for debugging.
