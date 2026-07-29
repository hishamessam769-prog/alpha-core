import { formatNumber } from "../lib/calculations";

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export default function AllocationDonutChart({
  data = [],
  colours = [],
  holdingsCount = 0,
  locale = "en-GB",
  isArabic = false,
}) {
  const cleanData = data
    .map((item) => ({ ...item, value: finitePositive(item?.value) }))
    .filter((item) => item.value > 0);
  const total = cleanData.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;

  return (
    <div className="allocation-chart-v3 allocation-chart-v342" role="img" aria-label={isArabic ? "رسم توزيع المحفظة" : "Portfolio allocation donut chart"}>
      <svg className="allocation-donut-svg-v342" viewBox="0 0 240 240" aria-hidden="true">
        <circle className="allocation-donut-track-v342" cx="120" cy="120" r="84" pathLength="100"/>
        {cleanData.map((entry, index) => {
          const percentage = total > 0 ? (entry.value / total) * 100 : 0;
          const gap = Math.min(1.15, percentage * 0.18);
          const visiblePercentage = Math.max(0, percentage - gap);
          const dashOffset = -offset - gap / 2;
          offset += percentage;
          return (
            <circle
              className="allocation-donut-segment-v342"
              key={`${entry.name}-${index}`}
              cx="120"
              cy="120"
              r="84"
              pathLength="100"
              stroke={colours[index % colours.length] || "var(--primary)"}
              strokeDasharray={`${visiblePercentage} ${100 - visiblePercentage}`}
              strokeDashoffset={dashOffset}
              style={{ "--segment-delay": `${index * 90}ms` }}
            >
              <title>{`${entry.name}: ${formatNumber(entry.value, 1, locale)}%`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="allocation-donut-centre-v342">
        <b>{holdingsCount}</b>
        <span>{isArabic ? "أسهم" : "holdings"}</span>
      </div>
    </div>
  );
}
