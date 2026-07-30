import { formatPercent } from "../lib/calculations";

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ComparisonRing({ data }) {
  const total = data.reduce((sum, entry) => sum + Math.max(0, safeNumber(entry.value)), 0) || 1;
  let offset = 0;

  return (
    <svg className="alpha-comparison-svg-v342" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="alpha-comparison-track-v342" cx="50" cy="50" r="41" pathLength="100"/>
      {data.map((entry, index) => {
        const percentage = (Math.max(0, safeNumber(entry.value)) / total) * 100;
        const gap = Math.min(1.4, percentage * 0.15);
        const visiblePercentage = Math.max(0, percentage - gap);
        const dashOffset = -offset - gap / 2;
        offset += percentage;
        return (
          <circle
            className="alpha-comparison-segment-v342"
            key={entry.name}
            cx="50"
            cy="50"
            r="41"
            pathLength="100"
            stroke={entry.colour}
            strokeDasharray={`${visiblePercentage} ${100 - visiblePercentage}`}
            strokeDashoffset={dashOffset}
            style={{ "--segment-delay": `${index * 140}ms` }}
          >
            <title>{`${entry.name}: ${formatPercent(entry.actual)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

export default function PortfolioVisualSuite({
  portfolioReturn = 0,
  benchmarkReturn = 0,
  benchmarkTicker = "Benchmark",
  isArabic = false,
}) {
  const portfolio = safeNumber(portfolioReturn);
  const benchmark = safeNumber(benchmarkReturn);
  const alpha = portfolio - benchmark;
  const bothZero = Math.abs(portfolio) < 0.0001 && Math.abs(benchmark) < 0.0001;
  const comparisonData = [
    {
      name: isArabic ? "المحفظة" : "ALPHA portfolio",
      value: bothZero ? 1 : Math.max(Math.abs(portfolio), 0.0001),
      actual: portfolio,
      colour: "#20d3ff",
    },
    {
      name: benchmarkTicker || (isArabic ? "المؤشر" : "Benchmark"),
      value: bothZero ? 1 : Math.max(Math.abs(benchmark), 0.0001),
      actual: benchmark,
      colour: "#8b5cf6",
    },
  ];

  return (
    <section className="portfolio-visual-suite-v341 portfolio-visual-suite-v343 panel-v21" aria-label={isArabic ? "مقارنة أداء المحفظة بالمؤشر" : "Portfolio versus benchmark visualisation"}>
      <header className="portfolio-visual-heading-v341 portfolio-visual-heading-v343">
        <div>
          <span className="eyebrow">PORTFOLIO COMPARISON</span>
          <h2>{isArabic ? "المحفظة مقابل المؤشر" : "Portfolio versus benchmark"}</h2>
          <p>{isArabic ? "مقارنة بصرية مباشرة بين عائد الشهر الحالي وعائد المؤشر المرجعي." : "A focused visual comparison of current-month portfolio and benchmark performance."}</p>
        </div>
      </header>

      <article className="alpha-comparison-card-v341 alpha-comparison-card-v343">
        <div className="alpha-comparison-orbit-v341">
          <ComparisonRing data={comparisonData}/>
          <div className="alpha-comparison-centre-v341">
            <small>{isArabic ? "الألفا الشهرية" : "Monthly Alpha"}</small>
            <strong className={alpha >= 0 ? "positive" : "negative"}>{formatPercent(alpha)}</strong>
            <span>{isArabic ? "المحفظة − المؤشر" : "Portfolio − benchmark"}</span>
          </div>
        </div>

        <div className="comparison-legend-v341 comparison-legend-v343">
          {comparisonData.map((entry) => (
            <div key={entry.name}>
              <i style={{ backgroundColor: entry.colour }}/>
              <span><small>{entry.name}</small></span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
