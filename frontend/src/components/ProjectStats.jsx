import { useState } from "react";
import { Activity, CircleDollarSign, GitBranch, ListChecks } from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function ProjectStats({ stats, project }) {
  const [activeMetric, setActiveMetric] = useState("Delayed");
  const variance = stats.totalActual - stats.totalBudget;
  const taskCount = project.tasks.length;

  const cards = [
    {
      label: "Total Tasks",
      value: taskCount,
      icon: ListChecks,
      tone: "neutral",
      detail: `${project.name} has ${taskCount} tracked activities across permits, site work, construction, inspections, and closeout.`,
    },
    {
      label: "Delayed",
      value: stats.delayed,
      icon: Activity,
      tone: stats.delayed ? "danger" : "good",
      detail: `${stats.delayed} activities are behind plan. Selecting delayed task cards shows contractors, prerequisites, and cost exposure.`,
    },
    {
      label: "Dependency Exposure",
      value: stats.impacted,
      icon: GitBranch,
      tone: stats.impacted ? "warning" : "good",
      detail: `${stats.impacted} downstream activities depend on delayed work and may lose schedule float if recovery action is not taken.`,
    },
    {
      label: "Cost Variance",
      value: currency.format(variance),
      icon: CircleDollarSign,
      tone: variance > 0 ? "danger" : "good",
      detail:
        variance > 0
          ? `Actual cost is ${currency.format(variance)} above the task-level budget tracked here.`
          : `Actual cost is ${currency.format(Math.abs(variance))} below the task-level budget tracked here.`,
    },
  ];

  const active = cards.find((card) => card.label === activeMetric) || cards[0];

  return (
    <section className="stats-wrap">
      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          const selected = card.label === active.label;
          return (
            <button
              className={`stat-card ${card.tone} ${selected ? "is-selected" : ""}`}
              key={card.label}
              onClick={() => setActiveMetric(card.label)}
            >
              <Icon size={22} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </button>
          );
        })}
      </div>
      <aside className={`metric-detail ${active.tone}`}>
        <span>{active.label}</span>
        <p>{active.detail}</p>
      </aside>
    </section>
  );
}

export default ProjectStats;
