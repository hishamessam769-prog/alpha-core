export default function KpiCard({ title, value, note, tone = "neutral" }) {
  return (
    <article className={`kpi-card ${tone}`}>
      <small>{title}</small>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}
