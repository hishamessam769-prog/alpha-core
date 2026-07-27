import { stockReturn } from "./calculations.js";

export const recommendationStatusLabel = (status, isArabic = false) => {
  const labels = {
    draft: isArabic ? "مسودة" : "Draft",
    open: isArabic ? "مفتوحة" : "Open",
    closed: isArabic ? "مغلقة" : "Closed",
    target_hit: isArabic ? "حقق المستهدف" : "Target hit",
    stopped: isArabic ? "تم إيقافها" : "Stopped",
  };
  return labels[status] || status;
};

export const dateOnly = (value) => {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const daysBetween = (start, end = new Date()) => {
  const a = dateOnly(start);
  const b = end instanceof Date ? end : dateOnly(end);
  if (!a || !b) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
};

export function recommendationMetrics(recommendation, prices = {}) {
  const stockPrice = prices[String(recommendation?.ticker || "").toUpperCase()];
  const benchmarkPrice = prices[String(recommendation?.benchmark_ticker || "EGX30CAP").toUpperCase()];
  const isOpen = ["open", "draft"].includes(recommendation?.status);

  const currentPrice = isOpen
    ? Number(stockPrice?.close_price || recommendation?.entry_price || 0)
    : Number(recommendation?.close_price || recommendation?.entry_price || 0);
  const currentBenchmark = isOpen
    ? Number(benchmarkPrice?.close_price || recommendation?.benchmark_entry || 0)
    : Number(recommendation?.benchmark_close || recommendation?.benchmark_entry || 0);

  const returnPct = stockReturn(currentPrice, recommendation?.entry_price);
  const benchmarkReturn = stockReturn(currentBenchmark, recommendation?.benchmark_entry);
  const targetReturn = stockReturn(recommendation?.target_price, recommendation?.entry_price);
  const upsideToTarget = stockReturn(recommendation?.target_price, currentPrice);
  const endDate = isOpen ? new Date() : recommendation?.close_date;
  const durationDays = daysBetween(recommendation?.recommendation_date, endDate);

  return {
    isOpen,
    currentPrice,
    currentBenchmark,
    returnPct,
    benchmarkReturn,
    alpha: returnPct - benchmarkReturn,
    targetReturn,
    upsideToTarget,
    durationDays,
    priceDate: stockPrice?.price_date || recommendation?.close_date || recommendation?.recommendation_date,
    benchmarkPriceDate: benchmarkPrice?.price_date || recommendation?.close_date || recommendation?.recommendation_date,
  };
}

export function recommendationSummary(recommendations = [], prices = {}) {
  const evaluated = recommendations.map((item) => ({ item, metrics: recommendationMetrics(item, prices) }));
  const closed = evaluated.filter(({ item }) => !["open", "draft"].includes(item.status));
  const open = evaluated.filter(({ item }) => item.status === "open");
  const average = (rows, selector) => rows.length
    ? rows.reduce((sum, row) => sum + Number(selector(row) || 0), 0) / rows.length
    : 0;
  const winners = closed.filter(({ metrics }) => metrics.returnPct > 0);

  return {
    total: recommendations.length,
    open: open.length,
    closed: closed.length,
    successRate: closed.length ? (winners.length / closed.length) * 100 : 0,
    averageClosedReturn: average(closed, ({ metrics }) => metrics.returnPct),
    averageClosedAlpha: average(closed, ({ metrics }) => metrics.alpha),
    averageClosedDays: average(closed, ({ metrics }) => metrics.durationDays),
    averageOpenReturn: average(open, ({ metrics }) => metrics.returnPct),
  };
}

export const splitResearchPoints = (value = "") => String(value)
  .split(/\n+/)
  .map((item) => item.replace(/^[-•]\s*/, "").trim())
  .filter(Boolean);
