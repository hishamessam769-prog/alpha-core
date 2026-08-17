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

function eventAllocations(event) {
  return (event?.portfolio_event_allocations || event?.allocations || [])
    .slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function eventSnapshot(event) {
  const value = event?.price_snapshot;
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function endPriceForAllocation(allocation, holdingMap) {
  const ticker = String(allocation?.ticker || "").toUpperCase();
  if (ticker === "CASH") return 1;
  const holding = holdingMap[ticker];
  return Number(allocation?.latest_price ?? holding?.close_price ?? allocation?.reference_price ?? allocation?.start_price ?? 0);
}

// V3.13: Event-driven monthly engine. A month is still the reporting unit, but
// exceptional mid-month actions split it into compounded allocation segments.
// Once a ticker is removed by an event, later price moves no longer affect NAV.
export function calculateMonth(month) {
  const originalHoldings = (month?.holdings || [])
    .slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const events = (month?.portfolio_events || [])
    .filter((event) => event?.is_published !== false)
    .slice()
    .sort((a, b) => String(a.event_date || "").localeCompare(String(b.event_date || "")) || Number(a.sequence_no || 0) - Number(b.sequence_no || 0));

  if (!events.length) {
    const rows = originalHoldings.map((holding) => {
      const mtd = stockReturn(holding.close_price, holding.open_price);
      const contribution = (Number(holding.weight || 0) / 100) * mtd;
      return { ...holding, mtd, contribution };
    });
    const portfolioReturn = rows.reduce((sum, row) => sum + row.contribution, 0);
    const benchmarkReturn = stockReturn(month?.benchmark_close, month?.benchmark_open);
    return { rows, portfolioReturn, benchmarkReturn, alpha: portfolioReturn - benchmarkReturn, eventDriven: false, events: [] };
  }

  const holdingMap = Object.fromEntries(originalHoldings.map((holding) => [String(holding.ticker || "").toUpperCase(), holding]));
  let allocations = originalHoldings.map((holding) => ({
    ticker: String(holding.ticker || "").toUpperCase(),
    weight_pct: Number(holding.weight || 0),
    start_price: Number(holding.open_price || 0),
    latest_price: Number(holding.close_price || 0),
    source_holding: holding,
  }));
  let portfolioFactor = 1;
  let benchmarkFactor = 1;
  let benchmarkStart = Number(month?.benchmark_open || 0);
  const contributionByTicker = {};

  const applySegment = (endPriceResolver) => {
    const factorBefore = portfolioFactor;
    let segmentReturn = 0;
    allocations.forEach((allocation) => {
      const ticker = String(allocation.ticker || "").toUpperCase();
      if (ticker === "CASH") return;
      const startPrice = Number(allocation.start_price || allocation.reference_price || 0);
      const endPrice = Number(endPriceResolver(allocation) || 0);
      const assetReturn = stockReturn(endPrice, startPrice);
      const weighted = (Number(allocation.weight_pct || 0) / 100) * assetReturn;
      segmentReturn += weighted;
      contributionByTicker[ticker] = Number(contributionByTicker[ticker] || 0) + factorBefore * weighted;
    });
    portfolioFactor *= 1 + segmentReturn / 100;
  };

  events.forEach((event) => {
    const snapshot = eventSnapshot(event);
    applySegment((allocation) => {
      const ticker = String(allocation.ticker || "").toUpperCase();
      if (ticker === "CASH") return 1;
      if (snapshot[ticker] != null) return snapshot[ticker];
      if (ticker === String(event.affected_ticker || "").toUpperCase() && event.execution_price != null) return event.execution_price;
      return allocation.start_price;
    });

    const benchmarkEnd = Number(event?.benchmark_price || benchmarkStart || 0);
    if (benchmarkStart > 0 && benchmarkEnd > 0) benchmarkFactor *= 1 + stockReturn(benchmarkEnd, benchmarkStart) / 100;
    benchmarkStart = benchmarkEnd || benchmarkStart;

    const next = eventAllocations(event);
    if (next.length) {
      allocations = next.map((allocation) => ({
        ...allocation,
        ticker: String(allocation.ticker || "").toUpperCase(),
        weight_pct: Number(allocation.weight_pct || 0),
        start_price: Number(allocation.reference_price || (String(allocation.ticker || "").toUpperCase() === "CASH" ? 1 : 0)),
      }));
    }
  });

  applySegment((allocation) => endPriceForAllocation(allocation, holdingMap));
  const benchmarkClose = Number(month?.benchmark_close || benchmarkStart || 0);
  if (benchmarkStart > 0 && benchmarkClose > 0) benchmarkFactor *= 1 + stockReturn(benchmarkClose, benchmarkStart) / 100;

  const portfolioReturn = (portfolioFactor - 1) * 100;
  const benchmarkReturn = (benchmarkFactor - 1) * 100;
  const rows = allocations.map((allocation, index) => {
    const ticker = String(allocation.ticker || "").toUpperCase();
    const source = holdingMap[ticker] || {};
    const openPrice = Number(allocation.start_price || allocation.reference_price || (ticker === "CASH" ? 1 : 0));
    const closePrice = endPriceForAllocation(allocation, holdingMap);
    const mtd = ticker === "CASH" ? 0 : stockReturn(closePrice, openPrice);
    return {
      ...source,
      ...allocation,
      id: allocation.id || source.id || `event-current-${ticker}-${index}`,
      ticker,
      weight: Number(allocation.weight_pct ?? source.weight ?? 0),
      open_price: openPrice,
      close_price: closePrice,
      mtd,
      contribution: Number(contributionByTicker[ticker] || 0),
      is_cash: ticker === "CASH",
    };
  });

  return {
    rows,
    portfolioReturn,
    benchmarkReturn,
    alpha: portfolioReturn - benchmarkReturn,
    eventDriven: true,
    events,
    exitedContribution: Object.fromEntries(Object.entries(contributionByTicker).filter(([ticker]) => !rows.some((row) => row.ticker === ticker))),
  };
}

export function effectiveReturns(month) {
  const calculated = calculateMonth(month);
  const eventDriven = Boolean((month?.portfolio_events || []).length);
  return {
    portfolio: Number(
      month?.is_closed && month?.final_portfolio_return != null
        ? month.final_portfolio_return
        : eventDriven
          ? calculated.portfolioReturn
          : month?.live_portfolio_return ?? calculated.portfolioReturn
    ),
    benchmark: Number(
      month?.is_closed && month?.final_benchmark_return != null
        ? month.final_benchmark_return
        : eventDriven
          ? calculated.benchmarkReturn
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
