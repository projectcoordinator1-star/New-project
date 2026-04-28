export function AppHero({ activeView, hero, heroStats, roleConfig, dataMode }) {
  const showContextBadge = activeView !== "attendance";

  return (
    <section className={`hero hero--${activeView}`}>
      <div>
        <p className="eyebrow">{hero.eyebrow}</p>
        <h2>{hero.title}</h2>
        <p className="hero__copy">{hero.description}</p>
        <div className="hero__metrics">
          {heroStats.map((item) => (
            <div key={item.label} className="hero__metric">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
      {showContextBadge ? (
        <div className="hero__badge">
          <strong>Current Context</strong>
          <span>{hero.badge}</span>
          <div className="hero__badge-list">
            <div>
              <small>Workflow Role</small>
              <b>{roleConfig.label}</b>
            </div>
            <div>
              <small>Data Source</small>
              <b>{dataMode === "qpms" ? "Real QPMS Files" : "Built-in Demo"}</b>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
