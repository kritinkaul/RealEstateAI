import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Building2, CalendarClock, ChevronDown, LayoutGrid } from "lucide-react";
import { analyzeProject, getProjects } from "./api";
import AIInsights from "./components/AIInsights.jsx";
import ChatBox from "./components/ChatBox.jsx";
import ProjectCards from "./components/ProjectCards.jsx";
import ProjectStats from "./components/ProjectStats.jsx";
import TaskList from "./components/TaskList.jsx";

function calculateStats(project) {
  if (!project) {
    return { delayed: 0, overBudget: 0, totalBudget: 0, totalActual: 0, impacted: 0, completion: 0 };
  }

  const tasks = project.tasks || [];
  const delayedIds = new Set(tasks.filter((task) => task.status === "delayed").map((task) => task.id));
  const onTrack = tasks.filter((task) => task.status === "on track").length;

  return {
    delayed: tasks.filter((task) => task.status === "delayed").length,
    overBudget: tasks.filter((task) => task.actualCost > task.budget).length,
    totalBudget: tasks.reduce((sum, task) => sum + task.budget, 0),
    totalActual: tasks.reduce((sum, task) => sum + task.actualCost, 0),
    impacted: tasks.filter((task) => task.dependencies?.some((id) => delayedIds.has(id))).length,
    completion: Math.round((onTrack / Math.max(tasks.length, 1)) * 100),
  };
}

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectError, setProjectError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingHint, setLoadingHint] = useState("");

  useEffect(() => {
    const hintTimer = window.setTimeout(() => {
      setLoadingHint("If this is the first load on free tier hosting, the API may be waking up.");
    }, 3500);
    getProjects()
      .then((payload) => {
        const loadedProjects = payload.projects || [];
        setProjects(loadedProjects);
        setSelectedProjectId(loadedProjects[0]?.id || "");
      })
      .catch((error) => setProjectError(error.message))
      .finally(() => {
        window.clearTimeout(hintTimer);
        setIsProjectLoading(false);
      });
  }, []);

  const project = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );

  const stats = useMemo(() => calculateStats(project), [project]);

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setAnalysis(null);
    setAnalysisError("");
  };

  const handleAnalyze = async () => {
    if (!project) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      const result = await analyzeProject(project.id);
      setAnalysis(result);
    } catch (error) {
      setAnalysisError(error.message || "Could not analyze the project.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isProjectLoading) {
    return (
      <main className="shell loading-shell">
        <div className="orbital-loader" />
        <p>Loading portfolio…</p>
        {loadingHint && <p style={{ marginTop: 0, maxWidth: 420, lineHeight: 1.6 }}>{loadingHint}</p>}
      </main>
    );
  }

  if (projectError || !project) {
    const isNetwork =
      /failed to fetch|networkerror|load failed/i.test(projectError || "") ||
      projectError === "Failed to fetch";
    const isMissingVercelEnv = /VITE_API_BASE_URL/i.test(projectError || "");
    return (
      <main className="shell centered-state">
        <AlertTriangle size={34} />
        <h1>Project data could not load</h1>
        <p>{projectError || "No projects were found."}</p>
        {isMissingVercelEnv && (
          <p style={{ maxWidth: 540, marginTop: 12, lineHeight: 1.6, color: "var(--ink-muted, #5c5852)" }}>
            On Vercel, add <strong>VITE_API_BASE_URL</strong> = your Render API URL (e.g.{" "}
            <code style={{ fontSize: "0.88em" }}>https://your-api.onrender.com</code>), then{" "}
            <strong>Redeploy</strong>. The UI cannot guess your API host in production.
          </p>
        )}
        {isNetwork && !isMissingVercelEnv && import.meta.env.DEV && (
          <>
            <p style={{ maxWidth: 520, marginTop: 12, lineHeight: 1.6, color: "var(--ink-muted, #5c5852)" }}>
              Start the API on port <strong>8001</strong>, then refresh. Example:
            </p>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 8,
                background: "rgba(26,24,22,0.06)",
                fontSize: "0.82rem",
                textAlign: "left",
                maxWidth: 560,
                overflow: "auto",
              }}
            >
              cd backend{"\n"}
              .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
            </pre>
          </>
        )}
        {isNetwork && !isMissingVercelEnv && import.meta.env.PROD && (
          <p style={{ maxWidth: 540, marginTop: 12, lineHeight: 1.6, color: "var(--ink-muted, #5c5852)" }}>
            Confirm <strong>Render</strong> is running (open your API <code>/health</code>),{" "}
            <strong>CORS_ORIGINS</strong> on Render includes this Vercel URL, and{" "}
            <strong>VITE_API_BASE_URL</strong> in Vercel exactly matches your Render API origin.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="command-bar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden>
            <LayoutGrid size={18} strokeWidth={2} />
          </span>
          <div>
            <strong>RealEstateAI</strong>
            <span>Owner portfolio desk</span>
          </div>
        </div>

        <label className="project-select">
          <span>Active project</span>
          <div>
            <select value={project.id} onChange={(event) => handleSelectProject(event.target.value)}>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={17} />
          </div>
        </label>

        <div className="command-metrics">
          <span>{stats.delayed} delayed</span>
          <span>{stats.impacted} exposed</span>
          <span>{stats.completion}% stable</span>
        </div>

        <button className="primary-button command-action" onClick={handleAnalyze} disabled={isAnalyzing}>
          <BarChart3 size={18} strokeWidth={2} />
          {isAnalyzing ? "Running…" : "Run readout"}
        </button>
      </section>

      <section className="hero-band">
        <div className="hero-copy">
          <div className="eyebrow">Portfolio intelligence</div>
          <h1>See which jobs are eating schedule and budget—before they become headlines</h1>
          <p>
            One desk for active developments: slipped tasks, dependency drag, cost variance, and a
            straight answer on what to escalate this week.
          </p>
        </div>
        <div className="hero-meta">
          <div>
            <Building2 size={18} />
            {project.name}
          </div>
          <div>
            <CalendarClock size={18} />
            Target completion {project.targetCompletion}
          </div>
        </div>
      </section>

      <ProjectCards
        projects={projects}
        selectedProjectId={project.id}
        onSelectProject={handleSelectProject}
      />

      <ProjectStats stats={stats} project={project} />

      <section className="workspace-grid">
        <div className="left-column">
          <TaskList tasks={project.tasks} />
        </div>
        <div className="right-column">
          <section className="analysis-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">Weekly readout</span>
                <h2>Risk & recovery</h2>
              </div>
              <button className="ghost-button" onClick={handleAnalyze} disabled={isAnalyzing}>
                <BarChart3 size={18} strokeWidth={2} />
                {isAnalyzing ? "Running…" : "Refresh readout"}
              </button>
            </div>
            {analysisError && <div className="error-banner">{analysisError}</div>}
            <AIInsights analysis={analysis} isAnalyzing={isAnalyzing} />
          </section>
          <ChatBox projectReady={Boolean(project)} projectId={project.id} projectName={project.name} />
        </div>
      </section>
    </main>
  );
}

export default App;
