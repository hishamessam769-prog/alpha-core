export const formatNumber = (value, digits = 2) =>
  new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));

export const formatPercent = (value, digits = 2) => {
  const n = Number(value || 0);
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
};

export const monthLabel = (key, short = false) => {
  if (!key) return "";
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
    month: short ? "short" : "long",
    year: "numeric",
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

const effectiveReturns = (month) => {
  const calculated = calculateMonth(month);
  return {
    portfolio: Number(
      month.is_closed && month.final_portfolio_return != null
        ? month.final_portfolio_return
        : month.live_portfolio_return ?? calculated.portfolioReturn
    ),
    benchmark: Number(
      month.is_closed && month.final_benchmark_return != null
        ? month.final_benchmark_return
        : month.live_benchmark_return ?? calculated.benchmarkReturn
    ),
  };
};

export function buildMonthlyTrackRecord(months = []) {
  let pf = 1;
  let bf = 1;

  return [...months]
    .filter((month) => month.is_published)
    .sort((a, b) => a.month_key.localeCompare(b.month_key))
    .map((month) => {
      const returns = effectiveReturns(month);
      pf *= 1 + returns.portfolio / 100;
      bf *= 1 + returns.benchmark / 100;
      const cumulativePortfolio = (pf - 1) * 100;
      const cumulativeBenchmark = (bf - 1) * 100;

      return {
        monthId: month.id,
        month: month.month_key,
        label: monthLabel(month.month_key, true),
        portfolio: returns.portfolio,
        benchmark: returns.benchmark,
        alpha: returns.portfolio - returns.benchmark,
        cumulativePortfolio,
        cumulativeBenchmark,
        cumulativeAlpha: cumulativePortfolio - cumulativeBenchmark,
        isClosed: month.is_closed,
      };
    });
}

export function buildPerformanceSeries(months = []) {
  const ordered = [...months]
    .filter((month) => month.is_published)
    .sort((a, b) => a.month_key.localeCompare(b.month_key));

  let pf = 1;
  let bf = 1;
  const points = [{
    label: "Launch",
    cumulativePortfolio: 0,
    cumulativeBenchmark: 0,
    cumulativeAlpha: 0,
  }];

  ordered.forEach((month, index) => {
    const isLast = index === ordered.length - 1;
    const snapshots = [...(month.snapshots || [])].sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date)
    );

    if (!month.is_closed && isLast && snapshots.length) {
      const baseP = pf;
      const baseB = bf;

      snapshots.forEach((snapshot) => {
        const p = baseP * (1 + Number(snapshot.portfolio_return || 0) / 100);
        const b = baseB * (1 + Number(snapshot.benchmark_return || 0) / 100);
        points.push({
          label: new Date(`${snapshot.snapshot_date}T00:00:00`).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          }),
          cumulativePortfolio: (p - 1) * 100,
          cumulativeBenchmark: (b - 1) * 100,
          cumulativeAlpha: (p - b) * 100,
        });
      });

      const latest = effectiveReturns(month);
      const p = baseP * (1 + latest.portfolio / 100);
      const b = baseB * (1 + latest.benchmark / 100);
      points.push({
        label: "Latest",
        cumulativePortfolio: (p - 1) * 100,
        cumulativeBenchmark: (b - 1) * 100,
        cumulativeAlpha: (p - b) * 100,
      });
      return;
    }

    const returns = effectiveReturns(month);
    pf *= 1 + returns.portfolio / 100;
    bf *= 1 + returns.benchmark / 100;
    points.push({
      label: monthLabel(month.month_key, true),
      cumulativePortfolio: (pf - 1) * 100,
      cumulativeBenchmark: (bf - 1) * 100,
      cumulativeAlpha: (pf - bf) * 100,
    });
  });

  return points;
}
