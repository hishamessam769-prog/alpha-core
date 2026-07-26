export const formatNumber = (value, digits = 2, locale = "en-GB") =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));

export const formatPercent = (value, digits = 2) => {
  const n = Number(value || 0);
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
};

export const monthLabel = (key, short = false, locale = "en-GB") => {
  if (!key) return "";
  return new Date(`${key}-01T00:00:00`).toLocaleDateString(locale, {
    month: short ? "short" : "long",
    year: "numeric",
  });
};

export const dateTimeLabel = (value, locale = "en-GB") => {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Cairo",
  });
};

export const stockReturn = (close, open) => {
  const o = Number(open);
  const c = Number(close);
  if (!o || !Number.isFinite(o) || !Number.isFinite(c)) return 0;
  return ((c - o) / o) * 100;
};

export function calculateMonth(month) {
  const rows = (month?.holdings || [])
    .slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((holding) => {
      const mtd = stockReturn(holding.close_price, holding.open_price);
      const contribution = (Number(holding.weight || 0) / 100) * mtd;
      return { ...holding, mtd, contribution };
    });

  const portfolioReturn = rows.reduce((sum, row) => sum + row.contribution, 0);
  const benchmarkReturn = stockReturn(month?.benchmark_close, month?.benchmark_open);

  return {
    rows,
    portfolioReturn,
    benchmarkReturn,
    alpha: portfolioReturn - benchmarkReturn,
  };
}

export function effectiveReturns(month) {
  const calculated = calculateMonth(month);
  return {
    portfolio: Number(
      month?.is_closed && month?.final_portfolio_return != null
        ? month.final_portfolio_return
        : month?.live_portfolio_return ?? calculated.portfolioReturn
    ),
    benchmark: Number(
      month?.is_closed && month?.final_benchmark_return != null
        ? month.final_benchmark_return
        : month?.live_benchmark_return ?? calculated.benchmarkReturn
    ),
  };
}

export function buildMonthlyTrackRecord(months = [], locale = "en-GB") {
  let portfolioFactor = 1;
  let benchmarkFactor = 1;

  return [...months]
    .filter((month) => month.is_published)
    .sort((a, b) => a.month_key.localeCompare(b.month_key))
    .map((month) => {
      const returns = effectiveReturns(month);
      portfolioFactor *= 1 + returns.portfolio / 100;
      benchmarkFactor *= 1 + returns.benchmark / 100;
      const cumulativePortfolio = (portfolioFactor - 1) * 100;
      const cumulativeBenchmark = (benchmarkFactor - 1) * 100;

      return {
        monthId: month.id,
        month: month.month_key,
        label: monthLabel(month.month_key, true, locale),
        portfolio: returns.portfolio,
        benchmark: returns.benchmark,
        alpha: returns.portfolio - returns.benchmark,
        cumulativePortfolio,
        cumulativeBenchmark,
        cumulativeAlpha: cumulativePortfolio - cumulativeBenchmark,
        isClosed: Boolean(month.is_closed),
        updatedAt: month.updated_at,
      };
    });
}

// V2.1: exactly one point per published month. Daily updates change the current
// month's point instead of adding more dots to the cumulative chart.
export function buildMonthlyPerformanceSeries(months = [], locale = "en-GB") {
  const track = buildMonthlyTrackRecord(months, locale);
  return [
    {
      month: "launch",
      label: locale.startsWith("ar") ? "الإطلاق" : "Launch",
      cumulativePortfolio: 0,
      cumulativeBenchmark: 0,
      cumulativeAlpha: 0,
    },
    ...track.map((row) => ({
      month: row.month,
      label: row.label,
      cumulativePortfolio: row.cumulativePortfolio,
      cumulativeBenchmark: row.cumulativeBenchmark,
      cumulativeAlpha: row.cumulativeAlpha,
    })),
  ];
}

export function filterSeriesByRange(series = [], range = "ALL") {
  if (range === "ALL") return series;
  const count = range === "3M" ? 3 : range === "6M" ? 6 : range === "1Y" ? 12 : series.length;
  const launch = series[0]?.month === "launch" ? [series[0]] : [];
  const monthly = series.filter((point) => point.month !== "launch").slice(-count);
  return [...launch, ...monthly];
}
