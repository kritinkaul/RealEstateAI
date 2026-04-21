import { ArrowRight, CalendarDays, MapPin, TriangleAlert } from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function getProjectStats(project) {
  const tasks = project.tasks || [];
  const delayed = tasks.filter((task) => task.status === "delayed").length;
  const overBudget = tasks.filter((task) => task.actualCost > task.budget).length;
  const riskScore = Math.min(100, Math.round(((delayed * 18 + overBudget * 12) / Math.max(tasks.length, 1)) * 3));

  return { delayed, overBudget, riskScore };
}

function ProjectCards({ projects, selectedProjectId, onSelectProject }) {
  return (
    <section className="portfolio-strip" aria-label="Project portfolio">
      {projects.map((project) => {
        const isSelected = project.id === selectedProjectId;
        const stats = getProjectStats(project);

        return (
          <button
            className={`project-card ${isSelected ? "is-selected" : ""}`}
            key={project.id}
            onClick={() => onSelectProject(project.id)}
          >
            <img src={project.imageUrl} alt="" />
            <div className="project-card-overlay" />
            <div className="project-card-content">
              <div className="project-card-topline">
                <span>{project.assetType}</span>
                <strong>{stats.riskScore}% risk</strong>
              </div>
              <h3>{project.name}</h3>
              <div className="project-card-meta">
                <span>
                  <MapPin size={14} />
                  {project.location}
                </span>
                <span>
                  <CalendarDays size={14} />
                  {project.targetCompletion}
                </span>
              </div>
              <div className="project-card-footer">
                <span>
                  <TriangleAlert size={14} />
                  {stats.delayed} delayed
                </span>
                <span>{currency.format(project.overallBudget)}</span>
                <ArrowRight size={18} />
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}

export default ProjectCards;
