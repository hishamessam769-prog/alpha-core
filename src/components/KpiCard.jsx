export default function KpiCard({ title, value, note, tone = "neutral", icon, badge }) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-card-glow"/>
      <div className="kpi-title-row">
        <small>{title}</small>
        {icon ? <span className="kpi-icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      <div className="kpi-footer-row">{note ? <span>{note}</span> : <span/>}{badge ? <em>{badge}</em> : null}</div>
    </article>
  );
}
