export default function KpiCard({ title, value, note, tone = "neutral", icon }) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-title-row">
        <small>{title}</small>
        {icon ? <span className="kpi-icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      {note ? <span>{note}</span> : null}
    </article>
  );
}
