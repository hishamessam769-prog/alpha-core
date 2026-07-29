import { useEffect, useMemo, useRef, useState } from "react";
import { formatPercent } from "../lib/calculations";
import { useLanguage } from "../context/LanguageContext";

const WIDTH_FALLBACK = 900;
const HEIGHT_FALLBACK = 310;

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function useChartSize(ref) {
  const [size, setSize] = useState({ width: WIDTH_FALLBACK, height: HEIGHT_FALLBACK });

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const update = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({
          width: Math.max(320, Math.round(rect.width)),
          height: Math.max(230, Math.round(rect.height)),
        });
      }
    };

    update();
    const frame = window.requestAnimationFrame(update);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(node);
    window.addEventListener("resize", update);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return size;
}

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] || next;
    const controlOneX = current.x + (next.x - previous.x) / 6;
    const controlOneY = current.y + (next.y - previous.y) / 6;
    const controlTwoX = next.x - (after.x - current.x) / 6;
    const controlTwoY = next.y - (after.y - current.y) / 6;
    path += ` C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${next.x} ${next.y}`;
  }
  return path;
}

function compactAxisValue(value) {
  const absolute = Math.abs(value);
  if (absolute >= 100) return `${Math.round(value)}%`;
  if (absolute >= 10) return `${value.toFixed(1)}%`;
  return `${value.toFixed(2)}%`;
}

export default function PerformanceChart({ data = [] }) {
  const { t, isArabic } = useLanguage();
  const canvasRef = useRef(null);
  const { width, height } = useChartSize(canvasRef);
  const [activeIndex, setActiveIndex] = useState(null);

  const cleanData = useMemo(
    () => (data || []).map((row, index) => ({
      ...row,
      label: row?.label || String(index + 1),
      cumulativePortfolio: finiteNumber(row?.cumulativePortfolio),
      cumulativeBenchmark: finiteNumber(row?.cumulativeBenchmark),
      cumulativeAlpha: finiteNumber(row?.cumulativeAlpha),
    })),
    [data],
  );

  const chart = useMemo(() => {
    const margin = {
      top: 18,
      right: width < 560 ? 14 : 24,
      bottom: width < 560 ? 38 : 42,
      left: width < 560 ? 42 : 58,
    };
    const plotWidth = Math.max(1, width - margin.left - margin.right);
    const plotHeight = Math.max(1, height - margin.top - margin.bottom);
    const values = cleanData.flatMap((row) => [row.cumulativePortfolio, row.cumulativeBenchmark, row.cumulativeAlpha, 0]);
    let minimum = Math.min(...values);
    let maximum = Math.max(...values);
    const spread = maximum - minimum;
    const padding = spread > 0 ? Math.max(spread * 0.16, 0.75) : Math.max(Math.abs(maximum) * 0.2, 1);
    minimum -= padding;
    maximum += padding;

    const xFor = (index) => cleanData.length <= 1
      ? margin.left + plotWidth / 2
      : margin.left + (index / (cleanData.length - 1)) * plotWidth;
    const yFor = (value) => margin.top + ((maximum - value) / (maximum - minimum || 1)) * plotHeight;
    const makePoints = (key) => cleanData.map((row, index) => ({ x: xFor(index), y: yFor(row[key]), value: row[key] }));
    const portfolioPoints = makePoints("cumulativePortfolio");
    const benchmarkPoints = makePoints("cumulativeBenchmark");
    const alphaPoints = makePoints("cumulativeAlpha");
    const zeroY = yFor(0);
    const portfolioPath = smoothPath(portfolioPoints);
    const areaPath = portfolioPoints.length
      ? `${portfolioPath} L ${portfolioPoints.at(-1).x} ${zeroY} L ${portfolioPoints[0].x} ${zeroY} Z`
      : "";
    const tickCount = width < 560 ? 4 : 5;
    const yTicks = Array.from({ length: tickCount }, (_, index) => maximum - ((maximum - minimum) * index) / (tickCount - 1));
    const labelStep = cleanData.length <= 6 ? 1 : Math.ceil((cleanData.length - 1) / (width < 560 ? 3 : 5));
    const xLabelIndexes = cleanData
      .map((_, index) => index)
      .filter((index) => index === 0 || index === cleanData.length - 1 || index % labelStep === 0);

    return {
      margin,
      plotWidth,
      plotHeight,
      xFor,
      yFor,
      zeroY,
      portfolioPoints,
      benchmarkPoints,
      alphaPoints,
      portfolioPath,
      benchmarkPath: smoothPath(benchmarkPoints),
      alphaPath: smoothPath(alphaPoints),
      areaPath,
      yTicks,
      xLabelIndexes,
    };
  }, [cleanData, width, height]);

  const series = [
    { key: "cumulativePortfolio", label: t("cumulativePortfolio"), colour: "var(--primary)", className: "portfolio" },
    { key: "cumulativeBenchmark", label: t("cumulativeBenchmark"), colour: "#8b5cf6", className: "benchmark" },
    { key: "cumulativeAlpha", label: t("cumulativeAlpha"), colour: "var(--text)", className: "alpha" },
  ];

  const activeRow = activeIndex == null ? null : cleanData[activeIndex];
  const activeX = activeIndex == null ? null : chart.xFor(activeIndex);

  const updateActivePoint = (clientX) => {
    if (!canvasRef.current || cleanData.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const relativeX = ((clientX - rect.left) / Math.max(rect.width, 1)) * width;
    const rawIndex = cleanData.length <= 1
      ? 0
      : Math.round(((relativeX - chart.margin.left) / Math.max(chart.plotWidth, 1)) * (cleanData.length - 1));
    setActiveIndex(Math.max(0, Math.min(cleanData.length - 1, rawIndex)));
  };

  if (!cleanData.length) {
    return (
      <div className="performance-chart performance-chart-empty-v342" role="img" aria-label={t("performanceOverview")}>
        <span>{isArabic ? "لا توجد بيانات أداء متاحة." : "No performance data available."}</span>
      </div>
    );
  }

  return (
    <div className="performance-chart performance-chart-v342" role="img" aria-label={t("performanceOverview")}>
      <div
        ref={canvasRef}
        className="performance-chart-canvas-v342"
        onPointerMove={(event) => updateActivePoint(event.clientX)}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-hidden="true">
          <defs>
            <linearGradient id="portfolioAreaV342" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28"/>
              <stop offset="88%" stopColor="var(--primary)" stopOpacity="0"/>
            </linearGradient>
            <filter id="portfolioGlowV342" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {chart.yTicks.map((tick) => {
            const y = chart.yFor(tick);
            return (
              <g key={tick} className="performance-grid-row-v342">
                <line x1={chart.margin.left} x2={width - chart.margin.right} y1={y} y2={y}/>
                <text x={chart.margin.left - 10} y={y + 3} textAnchor="end">{compactAxisValue(tick)}</text>
              </g>
            );
          })}

          <line className="performance-zero-line-v342" x1={chart.margin.left} x2={width - chart.margin.right} y1={chart.zeroY} y2={chart.zeroY}/>

          {chart.areaPath && <path className="performance-area-v342" d={chart.areaPath} fill="url(#portfolioAreaV342)"/>}
          <path className="performance-line-v342 portfolio" pathLength="1" d={chart.portfolioPath}/>
          <path className="performance-line-v342 benchmark" pathLength="1" d={chart.benchmarkPath}/>
          <path className="performance-line-v342 alpha" pathLength="1" d={chart.alphaPath}/>

          {chart.xLabelIndexes.map((index) => (
            <text
              className="performance-x-label-v342"
              key={`${cleanData[index].label}-${index}`}
              x={chart.xFor(index)}
              y={height - 12}
              textAnchor={index === 0 ? "start" : index === cleanData.length - 1 ? "end" : "middle"}
            >
              {cleanData[index].label}
            </text>
          ))}

          {activeRow && (
            <g className="performance-active-v342">
              <line x1={activeX} x2={activeX} y1={chart.margin.top} y2={height - chart.margin.bottom}/>
              {series.map((item) => (
                <circle
                  key={item.key}
                  cx={activeX}
                  cy={chart.yFor(activeRow[item.key])}
                  r="4.5"
                  fill={item.colour}
                  stroke="var(--panel)"
                  strokeWidth="3"
                />
              ))}
            </g>
          )}
        </svg>

        {activeRow && (
          <div
            className={`performance-tooltip-v342 ${activeX > width * 0.66 ? "align-end" : ""}`}
            style={{ left: `${(activeX / width) * 100}%`, top: `${Math.max(8, (chart.yFor(activeRow.cumulativePortfolio) / height) * 100)}%` }}
          >
            <strong>{activeRow.label}</strong>
            {series.map((item) => (
              <span key={item.key}>
                <i style={{ background: item.colour }}/>
                <small>{item.label}</small>
                <b>{formatPercent(activeRow[item.key])}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="performance-legend-v342" aria-label="Chart legend">
        {series.map((item) => (
          <span key={item.key}>
            <i className={item.className}/>
            <b>{item.label}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
