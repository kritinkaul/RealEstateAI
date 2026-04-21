import { useEffect, useState } from "react";
import { AlertCircle, CheckCheck, ClipboardList, Eye, ShieldAlert } from "lucide-react";

const messages = [
  "Tracing dependency chains…",
  "Reconciling budget vs actuals…",
  "Spotting downstream exposure…",
  "Drafting recovery moves…",
];

function AIInsights({ analysis, isAnalyzing }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!isAnalyzing) {
      setMessageIndex(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 1100);

    return () => window.clearInterval(interval);
  }, [isAnalyzing]);

  if (isAnalyzing) {
    return (
      <div className="analysis-loading">
        <div className="orbital-loader" />
        <strong>{messages[messageIndex]}</strong>
        <span>Pulling schedule, costs, and contractor handoffs into one readout.</span>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="empty-analysis">
        <ShieldAlert size={32} />
        <h3>No readout yet</h3>
        <p>Run a readout to see risks, what is likely to slip next, and who should move first.</p>
      </div>
    );
  }

  const sourceNote =
    analysis.source === "local-rules" && analysis.serviceNote ? analysis.serviceNote : null;

  return (
    <div className="insight-stack">
      {sourceNote && <div className="source-fallback-note">{sourceNote}</div>}
      <section className="summary-block">
        <span className="section-label">Summary</span>
        <p>{analysis.summary}</p>
      </section>
      <InsightSection
        title="Critical Risks"
        icon={AlertCircle}
        items={analysis.criticalRisks}
        renderItem={(item) => (
          <>
            <div className="item-title-line">
              <strong>{item.title}</strong>
              {item.severity && <span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span>}
            </div>
            <p>{item.detail}</p>
          </>
        )}
      />
      <InsightSection
        title="Predictions"
        icon={Eye}
        items={analysis.predictions}
        renderItem={(item) => (
          <>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </>
        )}
      />
      <InsightSection
        title="Recommended Actions"
        icon={ClipboardList}
        items={analysis.recommendedActions}
        renderItem={(item) => (
          <>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            {item.owner && <span className="owner-pill">{item.owner}</span>}
          </>
        )}
      />
      <InsightSection
        title="Actions Taken"
        icon={CheckCheck}
        items={analysis.actionsTaken}
        renderItem={(item) => (
          <>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </>
        )}
      />
    </div>
  );
}

function InsightSection({ title, icon: Icon, items = [], renderItem }) {
  return (
    <section className="insight-section">
      <div className="section-heading">
        <Icon size={18} />
        <h3>{title}</h3>
      </div>
      <div className="insight-items">
        {items.map((item, index) => (
          <article className="insight-item" key={`${title}-${index}`}>
            {renderItem(item)}
          </article>
        ))}
      </div>
    </section>
  );
}

export default AIInsights;
