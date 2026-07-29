import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber, formatPercent } from "../lib/calculations";

const visualColours = ["#20d3ff", "#8b5cf6", "#2dd4bf", "#60a5fa", "#f97316", "#ec4899"];

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampWeight(value) {
  return Math.min(100, Math.max(0, safeNumber(value)));
}

function AssetWeightDonut({ row, index, locale, isArabic }) {
  const weight = clampWeight(row?.weight);
  const chartData = [
    { name: row?.ticker || "—", value: weight },
    { name: isArabic ? "المتبقي" : "Remaining", value: Math.max(0, 100 - weight) },
  ];
  const colour = visualColours[index % visualColours.length];
  const monthlyReturn = safeNumber(row?.mtd);

  return (
    <article className="asset-weight-card-v341">
      <div className="asset-weight-chart-v341" aria-label={`${row?.ticker || "Asset"} ${formatNumber(weight, 1, locale)}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              innerRadius="69%"
              outerRadius="94%"
              cornerRadius={8}
              stroke="none"
              isAnimationActive
              animationBegin={100 + index * 90}
              animationDuration={900}
            >
              <Cell fill={colour}/>
              <Cell fill="rgba(148, 163, 184, 0.12)"/>
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="asset-weight-centre-v341">
          <strong>{formatNumber(weight, 1, locale)}%</strong>
          <small>{row?.ticker || "—"}</small>
        </div>
      </div>
      <div className="asset-weight-meta-v341">
        <span>{isArabic ? "وزن الأصل" : "Asset weight"}</span>
        <em className={monthlyReturn >= 0 ? "positive" : "negative"}>{formatPercent(monthlyReturn)}</em>
      </div>
    </article>
  );
}

export default function PortfolioVisualSuite({
  holdings = [],
  portfolioReturn = 0,
  benchmarkReturn = 0,
  benchmarkTicker = "Benchmark",
  locale = "en-GB",
  isArabic = false,
}) {
  const portfolio = safeNumber(portfolioReturn);
  const benchmark = safeNumber(benchmarkReturn);
  const alpha = portfolio - benchmark;
  const visibleHoldings = [...holdings].sort((a, b) => safeNumber(b?.weight) - safeNumber(a?.weight)).slice(0, 6);
  const splitIndex = Math.ceil(visibleHoldings.length / 2);
  const leftHoldings = visibleHoldings.slice(0, splitIndex);
  const rightHoldings = visibleHoldings.slice(splitIndex);
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
    <section className="portfolio-visual-suite-v341 panel-v21" aria-label={isArabic ? "تصور أداء وتوزيع المحفظة" : "Portfolio performance and allocation visualisation"}>
      <header className="portfolio-visual-heading-v341">
        <div>
          <span className="eyebrow">PORTFOLIO VISUAL INTELLIGENCE</span>
          <h2>{isArabic ? "مقارنة ألفا وتوزيع الأصول" : "Alpha comparison and asset allocation"}</h2>
          <p>{isArabic ? "مقارنة ديناميكية لأداء المحفظة مقابل المؤشر مع الوزن الفعلي لكل مركز." : "A dynamic comparison of portfolio performance against its benchmark, with the live weight of every holding."}</p>
        </div>
        <span className={`visual-alpha-badge-v341 ${alpha >= 0 ? "positive" : "negative"}`}>
          <small>ALPHA</small>
          <b>{formatPercent(alpha)}</b>
        </span>
      </header>

      <div className="portfolio-visual-stage-v341">
        <div className="asset-weight-column-v341 asset-weight-left-v341">
          {leftHoldings.map((row, index) => (
            <AssetWeightDonut key={row.id || row.ticker || index} row={row} index={index} locale={locale} isArabic={isArabic}/>
          ))}
        </div>

        <article className="alpha-comparison-card-v341">
          <div className="alpha-comparison-orbit-v341">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={comparisonData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="63%"
                  outerRadius="91%"
                  paddingAngle={4}
                  cornerRadius={10}
                  stroke="none"
                  isAnimationActive
                  animationDuration={1200}
                >
                  {comparisonData.map((entry) => <Cell key={entry.name} fill={entry.colour}/>) }
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 14, color: "var(--text)" }}
                  itemStyle={{ color: "var(--text)" }}
                  formatter={(_, __, payload) => [formatPercent(payload?.payload?.actual || 0), payload?.payload?.name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="alpha-comparison-centre-v341">
              <small>{isArabic ? "الألفا الشهرية" : "Monthly Alpha"}</small>
              <strong className={alpha >= 0 ? "positive" : "negative"}>{formatPercent(alpha)}</strong>
              <span>{isArabic ? "المحفظة − المؤشر" : "Portfolio − benchmark"}</span>
            </div>
          </div>

          <div className="comparison-legend-v341">
            {comparisonData.map((entry) => (
              <div key={entry.name}>
                <i style={{ backgroundColor: entry.colour }}/>
                <span><small>{entry.name}</small><b className={entry.actual >= 0 ? "positive" : "negative"}>{formatPercent(entry.actual)}</b></span>
              </div>
            ))}
          </div>
        </article>

        <div className="asset-weight-column-v341 asset-weight-right-v341">
          {rightHoldings.map((row, index) => (
            <AssetWeightDonut key={row.id || row.ticker || index} row={row} index={index + splitIndex} locale={locale} isArabic={isArabic}/>
          ))}
        </div>
      </div>

      {holdings.length > 6 && (
        <p className="portfolio-visual-note-v341">
          {isArabic ? `يتم عرض أكبر 6 مراكز من إجمالي ${holdings.length} مراكز.` : `Showing the first 6 visual allocations from ${holdings.length} total holdings.`}
        </p>
      )}
    </section>
  );
}
