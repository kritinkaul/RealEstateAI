import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Link2 } from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 0,
});

function TaskList({ tasks }) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks.find((task) => task.status === "delayed")?.id || tasks[0]?.id);

  const taskNames = useMemo(() => Object.fromEntries(tasks.map((task) => [task.id, task.name])), [tasks]);
  const dependentMap = useMemo(() => {
    return tasks.reduce((map, task) => {
      task.dependencies.forEach((dependencyId) => {
        map[dependencyId] = [...(map[dependencyId] || []), task.name];
      });
      return map;
    }, {});
  }, [tasks]);

  return (
    <section className="task-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Project tasks</span>
          <h2>Interactive schedule monitor</h2>
        </div>
        <span className="count-pill">{tasks.length} tasks</span>
      </div>

      <div className="task-list">
        {tasks.map((task) => {
          const delayed = task.status === "delayed";
          const overBudget = task.actualCost > task.budget;
          const selected = selectedTaskId === task.id;
          const dependents = dependentMap[task.id] || [];

          return (
            <article className={`task-row ${delayed ? "is-delayed" : ""} ${selected ? "is-selected" : ""}`} key={task.id}>
              <button className="task-summary" onClick={() => setSelectedTaskId(selected ? "" : task.id)}>
                <div className="status-rail" />
                <div className="task-main">
                  <div className="task-title-line">
                    <div>
                      <span className="phase-label">{task.phase}</span>
                      <h3>{task.name}</h3>
                    </div>
                    <span className={`status-pill ${delayed ? "delayed" : "track"}`}>
                      {delayed ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                      {task.status}
                    </span>
                  </div>

                  <div className="task-details">
                    <span>Due {task.deadline}</span>
                    <span>{task.contractor}</span>
                    <span className={overBudget ? "over-budget" : ""}>
                      {currency.format(task.actualCost)} / {currency.format(task.budget)}
                    </span>
                  </div>
                </div>
                <ChevronDown className="task-chevron" size={19} />
              </button>

              {selected && (
                <div className="task-expanded">
                  <p>{task.notes}</p>
                  <div className="dependency-grid">
                    <div>
                      <span className="detail-label">
                        <Link2 size={14} />
                        Prerequisites
                      </span>
                      <div className="dependencies">
                        {task.dependencies.length ? (
                          task.dependencies.map((id) => <span key={id}>{taskNames[id] || id}</span>)
                        ) : (
                          <span>No prerequisites</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="detail-label">Impacts</span>
                      <div className="dependencies">
                        {dependents.length ? dependents.map((name) => <span key={name}>{name}</span>) : <span>No direct dependents</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default TaskList;
