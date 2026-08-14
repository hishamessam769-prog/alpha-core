const TRADING_DAYS = 252;

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function localDateInput(date = new Date()) {
  const d = date instanceof Date ? date : toDateOnly(date) || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatJournalCurrency(value, locale = "en-EG", decimals = 2) {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)} EGP`;
}

export function describeJournalAmount(value, isArabic = false) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return isArabic ? "أدخل قيمة صحيحة" : "Enter a valid amount";
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} ${isArabic ? "مليار جنيه" : "bn EGP"}`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} ${isArabic ? "مليون جنيه" : "m EGP"}`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)} ${isArabic ? "ألف جنيه" : "k EGP"}`;
  return formatJournalCurrency(amount, isArabic ? "ar-EG" : "en-EG", 2);
}

export function journalPercent(value, digits = 2) {
  const number = Number(value || 0);
  return `${number >= 0 ? "+" : ""}${number.toFixed(digits)}%`;
}

function addMonths(date, months) {
  const copy = new Date(date);
  const originalDay = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(originalDay, lastDay));
  return copy;
}

function addYears(date, years) {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function startForTimeframe(timeframe, anchor) {
  const end = toDateOnly(anchor) || new Date();
  if (timeframe === "1D") return new Date(end);
  if (timeframe === "1W") {
    const result = new Date(end);
    result.setDate(result.getDate() - 6);
    return result;
  }
  if (timeframe === "1M") return addMonths(end, -1);
  if (timeframe === "YTD") return new Date(end.getFullYear(), 0, 1);
  if (timeframe === "1Y") return addYears(end, -1);
  return null;
}

function sampleStdDev(values) {
  if (!Array.isArray(values) || values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function volatilityMeta(volatilityPct, isArabic) {
  if (volatilityPct < 15) {
    return {
      key: "low",
      title: isArabic ? "تذبذب منخفض" : "Low volatility",
      description: isArabic ? "إدارة مخاطر هادئة" : "Calm risk profile",
    };
  }
  if (volatilityPct <= 25) {
    return {
      key: "moderate",
      title: isArabic ? "تذبذب متزن" : "Moderate volatility",
      description: isArabic ? "أداء متوافق مع حركة السوق" : "Balanced market movement",
    };
  }
  return {
    key: "high",
    title: isArabic ? "تذبذب مرتفع" : "High volatility",
    description: isArabic ? "محفظة ذات حركية عالية" : "High-movement portfolio",
  };
}

function riskAdjustedGuidance(ratio, volatilityPct, cumulativeReturnPct, isArabic) {
  if (!Number.isFinite(ratio)) {
    return isArabic ? "نحتاج إلى جلسات إضافية لقياس كفاءة العائد مقابل التذبذب." : "More sessions are needed to measure return efficiency versus volatility.";
  }
  if (ratio >= 1) return isArabic ? "عائد ممتاز مقارنةً بمستوى التذبذب." : "Excellent return relative to the level of volatility.";
  if (ratio >= 0.5) return isArabic ? "العائد جيد مقارنةً بمستوى التذبذب خلال الفترة." : "Good return relative to volatility over the selected period.";
  if (ratio >= 0) return isArabic ? "العائد موجب لكن كفاءة العائد مقابل التذبذب ما زالت محدودة." : "Return is positive, but return efficiency versus volatility is still limited.";
  if (volatilityPct > 25) return isArabic ? "تذبذب مرتفع مع عائد سلبي؛ راجع توزيع الأوزان ومستوى المخاطر." : "High volatility with negative return; review portfolio weights and risk exposure.";
  if (cumulativeReturnPct < 0) return isArabic ? "العائد سلبي خلال الفترة المختارة؛ راقب الاتجاه قبل زيادة المخاطر." : "Return is negative in the selected period; monitor the trend before adding risk.";
  return isArabic ? "العائد مقابل التذبذب يحتاج إلى مزيد من البيانات." : "Return versus volatility needs more data.";
}

export function filterJournalSnapshots(snapshots = [], timeframe = "ALL", customFrom = "", customTo = "") {
  const sorted = [...snapshots]
    .filter((item) => item?.snapshot_date && Number(item?.portfolio_value) > 0)
    .sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date)));
  if (!sorted.length) return { selected: [], startDate: null, endDate: null, priorSnapshot: null };

  const latestDate = toDateOnly(sorted.at(-1).snapshot_date);
  let endDate = latestDate;
  let startDate = null;

  if (timeframe === "CUSTOM") {
    startDate = toDateOnly(customFrom) || toDateOnly(sorted[0].snapshot_date);
    endDate = toDateOnly(customTo) || latestDate;
    if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
  } else if (timeframe !== "ALL") {
    startDate = startForTimeframe(timeframe, latestDate);
  }

  const selected = sorted.filter((item) => {
    const date = toDateOnly(item.snapshot_date);
    if (!date) return false;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });

  const selectedStart = selected.length ? toDateOnly(selected[0].snapshot_date) : startDate;
  const priorSnapshot = selectedStart
    ? [...sorted].reverse().find((item) => toDateOnly(item.snapshot_date) < selectedStart) || null
    : null;

  return {
    selected,
    startDate: startDate ? localDateInput(startDate) : null,
    endDate: endDate ? localDateInput(endDate) : null,
    priorSnapshot,
  };
}

export function calculateJournalAnalytics({ snapshots = [], settings = null, timeframe = "ALL", customFrom = "", customTo = "", isArabic = false }) {
  const sorted = [...snapshots]
    .filter((item) => item?.snapshot_date && Number(item?.portfolio_value) > 0)
    .sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date)));
  const filtered = filterJournalSnapshots(sorted, timeframe, customFrom, customTo);
  const selected = filtered.selected;
  const baselineCapital = Number(settings?.baseline_capital || 0);
  const baselineDate = settings?.baseline_date || null;

  if (!selected.length) {
    const meta = volatilityMeta(0, isArabic);
    return {
      selected,
      startDate: filtered.startDate,
      endDate: filtered.endDate,
      periodStartValue: baselineCapital,
      currentValue: baselineCapital,
      cumulativePnl: 0,
      cumulativeReturnPct: 0,
      dailyPnl: 0,
      dailyReturnPct: 0,
      annualizedVolatilityPct: 0,
      volatility: meta,
      riskAdjustedRatio: null,
      riskAdjustedGuidance: riskAdjustedGuidance(NaN, 0, 0, isArabic),
      maxDrawdownPct: 0,
      winDays: 0,
      lossDays: 0,
      flatDays: 0,
      winRatePct: 0,
      lossRatePct: 0,
      observationCount: 0,
      returnObservationCount: 0,
      chartPoints: baselineCapital > 0 && baselineDate ? [{ date: baselineDate, value: baselineCapital, baseline: true }] : [],
    };
  }

  const firstSelected = selected[0];
  const lastSelected = selected.at(-1);
  const prior = filtered.priorSnapshot;
  const periodStartValue = prior ? Number(prior.portfolio_value) : baselineCapital || Number(firstSelected.portfolio_value);
  const currentValue = Number(lastSelected.portfolio_value);
  const cumulativePnl = currentValue - periodStartValue;
  const cumulativeReturnPct = periodStartValue > 0 ? (cumulativePnl / periodStartValue) * 100 : 0;

  const latestIndex = sorted.findIndex((item) => item.id === lastSelected.id);
  const previousOverall = latestIndex > 0 ? sorted[latestIndex - 1] : null;
  const dailyStart = previousOverall ? Number(previousOverall.portfolio_value) : baselineCapital || currentValue;
  const dailyPnl = currentValue - dailyStart;
  const dailyReturnPct = dailyStart > 0 ? (dailyPnl / dailyStart) * 100 : 0;

  const returnSeriesRecords = prior ? [prior, ...selected] : [...selected];
  const dailyReturns = [];
  for (let index = 1; index < returnSeriesRecords.length; index += 1) {
    const previous = Number(returnSeriesRecords[index - 1].portfolio_value);
    const current = Number(returnSeriesRecords[index].portfolio_value);
    if (previous > 0 && current > 0) dailyReturns.push((current / previous) - 1);
  }

  const dailyStd = sampleStdDev(dailyReturns);
  const annualizedVolatility = dailyStd * Math.sqrt(TRADING_DAYS);
  const annualizedVolatilityPct = annualizedVolatility * 100;
  const meanDailyReturn = dailyReturns.length ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length : 0;
  const annualizedMeanReturn = meanDailyReturn * TRADING_DAYS;
  const riskAdjustedRatio = annualizedVolatility > 0 && dailyReturns.length >= 2 ? annualizedMeanReturn / annualizedVolatility : null;

  const drawdownValues = [periodStartValue, ...selected.map((item) => Number(item.portfolio_value))].filter((value) => value > 0);
  let peak = drawdownValues[0] || 0;
  let maxDrawdown = 0;
  for (const value of drawdownValues) {
    if (value > peak) peak = value;
    if (peak > 0) {
      const drawdown = (value / peak) - 1;
      if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }
  }

  const winDays = dailyReturns.filter((value) => value > 0).length;
  const lossDays = dailyReturns.filter((value) => value < 0).length;
  const flatDays = dailyReturns.filter((value) => value === 0).length;
  const ratioDenominator = dailyReturns.length || 1;
  const volatility = volatilityMeta(annualizedVolatilityPct, isArabic);

  const chartPoints = selected.map((item) => ({
    id: item.id,
    date: item.snapshot_date,
    value: Number(item.portfolio_value),
    note: item.session_note || "",
  }));
  if (prior) chartPoints.unshift({ id: prior.id, date: prior.snapshot_date, value: Number(prior.portfolio_value), prior: true });
  else if (baselineCapital > 0 && baselineDate && baselineDate <= firstSelected.snapshot_date) chartPoints.unshift({ date: baselineDate, value: baselineCapital, baseline: true });

  return {
    selected,
    startDate: filtered.startDate || firstSelected.snapshot_date,
    endDate: filtered.endDate || lastSelected.snapshot_date,
    periodStartValue,
    currentValue,
    cumulativePnl,
    cumulativeReturnPct,
    dailyPnl,
    dailyReturnPct,
    annualizedVolatilityPct,
    volatility,
    riskAdjustedRatio,
    riskAdjustedGuidance: riskAdjustedGuidance(riskAdjustedRatio, annualizedVolatilityPct, cumulativeReturnPct, isArabic),
    maxDrawdownPct: maxDrawdown * 100,
    winDays,
    lossDays,
    flatDays,
    winRatePct: (winDays / ratioDenominator) * 100,
    lossRatePct: (lossDays / ratioDenominator) * 100,
    observationCount: selected.length,
    returnObservationCount: dailyReturns.length,
    chartPoints,
  };
}
