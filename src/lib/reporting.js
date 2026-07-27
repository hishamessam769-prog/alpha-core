import { buildMonthlyTrackRecord, calculateMonth, dateTimeLabel, formatNumber, formatPercent, monthLabel } from "./calculations.js";

export const educationalDisclaimer = (isArabic) => isArabic
  ? "هذا التقرير لأغراض تعليمية ومعلوماتية عامة فقط ولا يمثل نصيحة استثمارية شخصية أو دعوة مباشرة للشراء أو البيع."
  : "This report is for general educational and informational purposes only. It is not personalised investment advice or a direct invitation to buy or sell.";

export function buildPortfolioReport({ portfolio, month, months, locale = "en-GB", isArabic = false, reportType = "monthly" }) {
  const metrics = calculateMonth(month);
  const reportMonth = { ...month, is_published: true, live_portfolio_return: metrics.portfolioReturn, live_benchmark_return: metrics.benchmarkReturn, live_alpha: metrics.alpha };
  const reportMonths = [...(months || []).filter((item) => item.id !== month.id && item.month_key !== month.month_key), reportMonth];
  const track = buildMonthlyTrackRecord(reportMonths, locale).filter((row) => row.month <= month.month_key);
  const cumulative = track.at(-1) || { cumulativePortfolio: 0, cumulativeBenchmark: 0, cumulativeAlpha: 0 };
  const sorted = [...metrics.rows].sort((a, b) => b.mtd - a.mtd);
  const best = sorted[0] || null;
  const worst = sorted.at(-1) || null;
  const status = month.is_closed
    ? (isArabic ? "نهائي" : "Final")
    : month.is_published
      ? (isArabic ? "مباشر" : "Live")
      : (isArabic ? "مسودة" : "Draft");
  const portfolioName = isArabic && portfolio?.name_ar ? portfolio.name_ar : portfolio?.name || month.strategy_name || "ALPHA CORE";
  const frequency = {
    daily: isArabic ? "تقرير يومي" : "Daily report",
    weekly: isArabic ? "تقرير أسبوعي" : "Weekly report",
    monthly: isArabic ? "تقرير شهري" : "Monthly report",
  }[reportType] || (isArabic ? "تقرير شهري" : "Monthly report");
  const updatedAt = month.updated_at || portfolio?.updated_at || new Date().toISOString();
  const currentGuidance = month.current_investor_guidance || month.investor_guidance || "—";
  const newGuidance = month.new_investor_guidance || month.investor_guidance || "—";

  return {
    portfolioName,
    monthLabel: monthLabel(month.month_key, false, locale),
    frequency,
    status,
    updatedAt,
    updatedAtLabel: dateTimeLabel(updatedAt, locale),
    benchmarkTicker: month.benchmark_ticker || portfolio?.benchmark_ticker || "EGX30CAP",
    portfolioReturn: metrics.portfolioReturn,
    benchmarkReturn: metrics.benchmarkReturn,
    alpha: metrics.alpha,
    cumulativePortfolio: cumulative.cumulativePortfolio,
    cumulativeBenchmark: cumulative.cumulativeBenchmark,
    cumulativeAlpha: cumulative.cumulativeAlpha,
    rows: metrics.rows,
    best,
    worst,
    strategyNotes: [month.update_title, month.public_commentary, month.monthly_objective].filter(Boolean).join("\n\n") || "—",
    currentGuidance,
    newGuidance,
    changes: (month.swaps || []).map((swap) => `${swap.removed_ticker} → ${swap.added_ticker}${swap.reason ? `: ${swap.reason}` : ""}`),
    disclaimer: educationalDisclaimer(isArabic),
  };
}

export function buildAiSummary(report, isArabic = false, locale = "en-GB") {
  const allocation = report.rows.map((row) => `${row.ticker} ${formatNumber(row.weight, 2, locale)}%`).join(" | ");
  const changes = report.changes.length ? report.changes.join("\n- ") : (isArabic ? "لا توجد تغييرات معلنة" : "No announced changes");
  if (isArabic) {
    return `ALPHA CORE — ملخص أداء المحفظة\n\nالمحفظة: ${report.portfolioName}\nالفترة: ${report.frequency} — ${report.monthLabel}\nالحالة: ${report.status}\nآخر تحديث: ${report.updatedAtLabel}\n\nالأداء\n- عائد المحفظة: ${formatPercent(report.portfolioReturn)}\n- عائد المؤشر ${report.benchmarkTicker}: ${formatPercent(report.benchmarkReturn)}\n- الألفا: ${formatPercent(report.alpha)}\n- العائد التراكمي للمحفظة: ${formatPercent(report.cumulativePortfolio)}\n- العائد التراكمي للمؤشر: ${formatPercent(report.cumulativeBenchmark)}\n- الألفا التراكمية: ${formatPercent(report.cumulativeAlpha)}\n\nأفضل سهم: ${report.best ? `${report.best.ticker} ${formatPercent(report.best.mtd)}` : "—"}\nأسوأ سهم: ${report.worst ? `${report.worst.ticker} ${formatPercent(report.worst.mtd)}` : "—"}\n\nأهم التغييرات\n- ${changes}\n\nالأوزان الحالية\n${allocation || "—"}\n\nملاحظات الاستراتيجية\n${report.strategyNotes}\n\nتعليمات المستثمر الحالي\n${report.currentGuidance}\n\nتعليمات المستثمر الجديد\n${report.newGuidance}\n\n${report.disclaimer}`;
  }
  return `ALPHA CORE — Portfolio Performance Summary\n\nPortfolio: ${report.portfolioName}\nPeriod: ${report.frequency} — ${report.monthLabel}\nStatus: ${report.status}\nLast updated: ${report.updatedAtLabel}\n\nPerformance\n- Portfolio return: ${formatPercent(report.portfolioReturn)}\n- ${report.benchmarkTicker} return: ${formatPercent(report.benchmarkReturn)}\n- Alpha: ${formatPercent(report.alpha)}\n- Cumulative portfolio return: ${formatPercent(report.cumulativePortfolio)}\n- Cumulative benchmark return: ${formatPercent(report.cumulativeBenchmark)}\n- Cumulative alpha: ${formatPercent(report.cumulativeAlpha)}\n\nBest stock: ${report.best ? `${report.best.ticker} ${formatPercent(report.best.mtd)}` : "—"}\nWorst stock: ${report.worst ? `${report.worst.ticker} ${formatPercent(report.worst.mtd)}` : "—"}\n\nKey changes\n- ${changes}\n\nCurrent weights\n${allocation || "—"}\n\nStrategy notes\n${report.strategyNotes}\n\nExisting investor guidance\n${report.currentGuidance}\n\nNew investor guidance\n${report.newGuidance}\n\n${report.disclaimer}`;
}

export function buildSocialCopy(report, isArabic = false) {
  if (isArabic) {
    return `تحديث ${report.portfolioName} — ${report.monthLabel}\n\nعائد المحفظة ${formatPercent(report.portfolioReturn)}\nعائد ${report.benchmarkTicker} ${formatPercent(report.benchmarkReturn)}\nالألفا ${formatPercent(report.alpha)}\nالألفا التراكمية منذ الإطلاق ${formatPercent(report.cumulativeAlpha)}\n\nأفضل سهم ${report.best ? `${report.best.ticker} ${formatPercent(report.best.mtd)}` : "—"}\nأسوأ سهم ${report.worst ? `${report.worst.ticker} ${formatPercent(report.worst.mtd)}` : "—"}\n\nحالة المحفظة ${report.status}\nآخر تحديث ${report.updatedAtLabel}\n\nالتقرير كامل متاح داخل ALPHA CORE\n\nتنويه: المحتوى تعليمي ومعلوماتي عام وليس نصيحة استثمارية شخصية.`;
  }
  return `${report.portfolioName} update — ${report.monthLabel}\n\nPortfolio return ${formatPercent(report.portfolioReturn)}\n${report.benchmarkTicker} return ${formatPercent(report.benchmarkReturn)}\nAlpha ${formatPercent(report.alpha)}\nCumulative alpha since launch ${formatPercent(report.cumulativeAlpha)}\n\nBest stock ${report.best ? `${report.best.ticker} ${formatPercent(report.best.mtd)}` : "—"}\nWorst stock ${report.worst ? `${report.worst.ticker} ${formatPercent(report.worst.mtd)}` : "—"}\n\nPortfolio status ${report.status}\nLast updated ${report.updatedAtLabel}\n\nRead the full report inside ALPHA CORE.\n\nEducational information only — not personalised investment advice.`;
}

export function safeFilePart(value) {
  return String(value || "alpha-core").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "alpha-core";
}
