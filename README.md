# RealEstateAI

Portfolio project: a fake “construction portfolio” dashboard where you can flip between sample jobs, see which tasks are late or over budget, run a risk readout, and ask short questions about the selected project.

There’s a Python API plus a React frontend. If you don’t plug in a Gemini key, it still runs using simple rule-based fallbacks so the UI isn’t empty.

## What it actually does

- Pick a project, see tasks, delays, and rough cost vs budget  
- Button to generate a readout (risks, predictions-ish stuff, suggested next steps)  
- Little chat box that’s supposed to stay on project topics  

## Run it locally

**1. Backend** (terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export GEMINI_API_KEY="your_key"   # optional
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

**2. Frontend** (terminal 2, from repo root)

```bash
npm install
npm run dev
```

Open the link Vite prints (often port 5173). You need Node 18+.

The dev server sends API calls through `/api` to `localhost:8001`, so you don’t fight CORS while coding.

**Shortcut:** if `.venv` already exists, `npm run dev:api` from the root starts the backend the same way.

## Hosted version

If you deploy: frontend and backend are on different URLs. Set `VITE_API_BASE_URL` on the frontend host to your public API URL (no slash at the end). First load after the API slept can be slow on free hosting—refresh once.

## API (quick reference)

| Method | Path | What |
|--------|------|------|
| GET | `/health` | sanity check |
| GET | `/projects` | list projects |
| GET | `/project` | default project |
| GET | `/project/{id}` | one project |
| POST | `/analyze` | readout JSON |
| POST | `/chat` | short answer |

No Gemini key → readout/chat still return something from the fallback logic; analyze might add a `serviceNote` if something errored.

## Data

Sample projects live in `backend/data/projects.json`. It’s all static JSON for the demo.
