import { useRef, useState } from "react";
import { Copy, FileDown, LoaderCircle, Sparkles, X } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { usePlatformSettings } from "../context/SettingsContext";
import {
  buildMonthlyTrackRecord,
  dateTimeLabel,
  formatNumber,
  formatPercent,
  monthLabel,
} from "../lib/calculations";
import { recommendationMetrics } from "../lib/recommendations";
import { supabase } from "../lib/supabase";
import { downloadBlob } from "../lib/zip";

const PAGE_WIDTH = 2480;
const PAGE_HEIGHT = 3508;

const truncate = (value, max = 88) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
};

async function loadExecutiveReportData(locale, isArabic) {
  const [portfolioResult, monthResult, recommendationResult, priceResult] = await Promise.all([
    supabase.from("portfolios").select("*").eq("is_published", true).order("updated_at", { ascending: false }),
    supabase.from("strategy_months").select("*, holdings(*)").eq("is_published", true).order("month_key", { ascending: true }),
    supabase.from("recommendations").select("*").eq("is_published", true).eq("status", "open").order("recommendation_date", { ascending: false }),
    supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
  ]);

  const error = portfolioResult.error || monthResult.error || recommendationResult.error || priceResult.error;
  if (error) throw error;

  const portfolios = (portfolioResult.data || []).filter((item) => String(item.status || "live").toLowerCase() !== "archived");
  const months = monthResult.data || [];
  const recommendations = recommendationResult.data || [];
  const prices = Object.fromEntries((priceResult.data || []).map((row) => [String(row.ticker || "").toUpperCase(), row]));

  const portfolioRows = portfolios.map((portfolio) => {
    const portfolioMonths = months.filter((month) => month.portfolio_id === portfolio.id);
    const track = buildMonthlyTrackRecord(portfolioMonths, locale);
    const latestTrack = track.at(-1) || null;
    const latestMonth = portfolioMonths.find((month) => month.id === latestTrack?.monthId)
      || portfolioMonths.at(-1)
      || null;

    return {
      id: portfolio.id,
      name: isArabic && portfolio.name_ar ? portfolio.name_ar : portfolio.name,
      strategy: truncate(
        latestMonth?.strategy_name
          || (isArabic && portfolio.description_ar ? portfolio.description_ar : portfolio.description)
          || (isArabic ? "استراتيجية استثمارية منشورة" : "Published investment strategy")
      ),
      period: latestTrack?.month ? monthLabel(latestTrack.month, true, locale) : "—",
      status: latestTrack?.isClosed ? (isArabic ? "نهائي" : "Final") : (isArabic ? "مباشر" : "Live"),
      portfolioReturn: latestTrack?.portfolio || 0,
      benchmarkReturn: latestTrack?.benchmark || 0,
      alpha: latestTrack?.alpha || 0,
      cumulativeAlpha: latestTrack?.cumulativeAlpha || 0,
      updatedAt: latestTrack?.updatedAt || latestMonth?.updated_at || portfolio.updated_at,
    };
  });

  const recommendationRows = recommendations.map((recommendation) => {
    const metrics = recommendationMetrics(recommendation, prices);
    return {
      id: recommendation.id,
      ticker: String(recommendation.ticker || "—").toUpperCase(),
      entryPrice: Number(recommendation.entry_price || 0),
      currentPrice: metrics.currentPrice,
      returnPct: metrics.returnPct,
      targetPrice: Number(recommendation.target_price || 0),
      upsideToTarget: metrics.upsideToTarget,
      issuedDate: recommendation.recommendation_date,
      durationDays: metrics.durationDays,
    };
  });

  const latestMonthKey = months.map((month) => month.month_key).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 7);
  const averageAlpha = portfolioRows.length
    ? portfolioRows.reduce((sum, row) => sum + Number(row.alpha || 0), 0) / portfolioRows.length
    : 0;
  const bestPortfolio = portfolioRows.slice().sort((a, b) => b.cumulativeAlpha - a.cumulativeAlpha)[0] || null;
  const bestRecommendation = recommendationRows.slice().sort((a, b) => b.returnPct - a.returnPct)[0] || null;
  const latestUpdate = [...portfolioRows.map((row) => row.updatedAt), ...(priceResult.data || []).map((row) => row.price_date)]
    .filter(Boolean)
    .sort()
    .at(-1) || new Date().toISOString();

  return {
    periodKey: latestMonthKey,
    periodLabel: monthLabel(latestMonthKey, false, locale),
    generatedAt: new Date().toISOString(),
    latestUpdate,
    portfolioRows,
    recommendationRows,
    snapshot: {
      portfolios: portfolioRows.length,
      recommendations: recommendationRows.length,
      averageAlpha,
      bestPortfolio,
      bestRecommendation,
    },
  };
}

function buildLinkedInPost(report, isArabic) {
  const bestPortfolio = report.snapshot.bestPortfolio;
  const bestCall = report.snapshot.bestRecommendation;
  const portfolioLine = bestPortfolio
    ? `${bestPortfolio.name}: ${formatPercent(bestPortfolio.alpha)} ${isArabic ? "ألفا شهرية" : "monthly Alpha"}، ${formatPercent(bestPortfolio.cumulativeAlpha)} ${isArabic ? "ألفا تراكمية" : "cumulative Alpha"}`
    : (isArabic ? "لا توجد محافظ منشورة خلال الفترة." : "No published portfolios in the period.");
  const callLine = bestCall
    ? `${bestCall.ticker}: ${formatPercent(bestCall.returnPct)} ${isArabic ? "عائد حتى الآن" : "return so far"}، ${formatPercent(bestCall.upsideToTarget)} ${isArabic ? "متبقٍ للمستهدف" : "remaining upside"}`
    : (isArabic ? "لا توجد توصيات مفتوحة حاليًا." : "No active recommendations at this time.");

  if (isArabic) {
    return `تحديث ALPHA PLATFORM الشهري | ${report.periodLabel}\n\n` +
      `• ${report.snapshot.portfolios} محافظ نشطة على المنصة\n` +
      `• ${report.snapshot.recommendations} توصيات مفتوحة قيد المتابعة\n` +
      `• متوسط الألفا الشهرية: ${formatPercent(report.snapshot.averageAlpha)}\n` +
      `• أبرز محفظة: ${portfolioLine}\n` +
      `• أبرز توصية نشطة: ${callLine}\n\n` +
      `التقرير التنفيذي يعرض لقطة مختصرة للمنصة، بينما تظل التقارير التفصيلية لكل محفظة هي المرجع الكامل للمنهجية والأوزان والقرارات.\n\n` +
      `للاطلاع على المنصة: ${window.location.origin}\n\n` +
      `تنويه: المحتوى تعليمي ولا يمثل توصية شخصية بالشراء أو البيع.\n\n` +
      `#ALPHAPlatform #EGX #InvestmentResearch #PortfolioManagement`;
  }

  return `ALPHA PLATFORM Monthly Update | ${report.periodLabel}\n\n` +
    `• ${report.snapshot.portfolios} active portfolios across the platform\n` +
    `• ${report.snapshot.recommendations} open recommendations under active tracking\n` +
    `• Average monthly Alpha: ${formatPercent(report.snapshot.averageAlpha)}\n` +
    `• Leading portfolio: ${portfolioLine}\n` +
    `• Leading active call: ${callLine}\n\n` +
    `The executive report provides a concise platform-wide snapshot, while each portfolio factsheet remains the detailed source for methodology, allocations and decisions.\n\n` +
    `Explore the platform: ${window.location.origin}\n\n` +
    `Educational content only. This is not personalised investment advice.\n\n` +
    `#ALPHAPlatform #EGX #InvestmentResearch #PortfolioManagement`;
}

function waitForRender(ref, attempts = 24) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      if (ref.current) return resolve(ref.current);
      if (remaining <= 0) return reject(new Error("Could not prepare the executive report."));
      requestAnimationFrame(() => check(remaining - 1));
    };
    check(attempts);
  });
}

async function waitForAssets(root) {
  if (document.fonts?.ready) await document.fonts.ready;
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((image) => {
    if (image.complete) return image.decode?.().catch(() => undefined) || Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export default function PlatformExecutiveReportExport({ onMessage }) {
  const { profile } = useAuth();
  const { isArabic } = useLanguage();
  const { settings } = usePlatformSettings();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [working, setWorking] = useState(false);
  const [report, setReport] = useState(null);
  const [summary, setSummary] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const reportRef = useRef(null);
  const isSuperAdmin = Boolean(profile?.is_super_admin);

  if (!isSuperAdmin) return null;

  const prepareReport = async () => {
    const nextReport = await loadExecutiveReportData(locale, isArabic);
    setReport(nextReport);
    setSummary(buildLinkedInPost(nextReport, isArabic));
    return nextReport;
  };

  const openSummary = async () => {
    if (working) return;
    setWorking(true);
    try {
      await prepareReport();
      setSummaryOpen(true);
    } catch (error) {
      onMessage?.(error.message || String(error));
    } finally {
      setWorking(false);
    }
  };

  const exportPdf = async () => {
    if (working || !isSuperAdmin) return;
    setWorking(true);
    onMessage?.(isArabic ? "جاري تجهيز التقرير التنفيذي…" : "Preparing the executive report…");

    try {
      const nextReport = await prepareReport();
      const root = await waitForRender(reportRef);
      await waitForAssets(root);

      const sourceCanvas = await html2canvas(root, {
        scale: 3.25,
        backgroundColor: "#f4f7fb",
        useCORS: true,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(1120, root.scrollWidth),
        width: root.scrollWidth,
        height: root.scrollHeight,
        foreignObjectRendering: isArabic,
        removeContainer: true,
      });

      const a4Canvas = document.createElement("canvas");
      a4Canvas.width = PAGE_WIDTH;
      a4Canvas.height = PAGE_HEIGHT;
      const context = a4Canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error(isArabic ? "تعذر إنشاء صفحة A4" : "Could not create the A4 page.");

      context.fillStyle = "#f4f7fb";
      context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      const marginX = 72;
      const marginY = 68;
      const availableWidth = PAGE_WIDTH - marginX * 2;
      const availableHeight = PAGE_HEIGHT - marginY * 2;
      const fitScale = Math.min(availableWidth / sourceCanvas.width, availableHeight / sourceCanvas.height);
      const drawWidth = Math.round(sourceCanvas.width * fitScale);
      const drawHeight = Math.round(sourceCanvas.height * fitScale);
      const drawX = Math.round((PAGE_WIDTH - drawWidth) / 2);
      const drawY = Math.round((PAGE_HEIGHT - drawHeight) / 2);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true, precision: 4 });
      pdf.setProperties({
        title: `ALPHA Platform Executive Summary - ${nextReport.periodLabel}`,
        subject: "Monthly portfolio and active recommendation executive summary",
        author: "ALPHA PLATFORM",
        creator: "ALPHA PLATFORM",
      });
      pdf.addImage(a4Canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "SLOW");
      downloadBlob(pdf.output("blob"), `alpha-platform-executive-summary-${nextReport.periodKey}.pdf`);
      setSummaryOpen(true);
      onMessage?.(isArabic ? "تم إنشاء تقرير A4 عالي الدقة وملخص LinkedIn" : "High-resolution A4 report and LinkedIn summary generated.");
    } catch (error) {
      onMessage?.(error.message || String(error));
    } finally {
      setWorking(false);
      window.setTimeout(() => setReport(null), 700);
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      onMessage?.(isArabic ? "تم نسخ ملخص LinkedIn" : "LinkedIn executive summary copied.");
    } catch {
      onMessage?.(isArabic ? "تعذر النسخ التلقائي. النص ظاهر وجاهز للنسخ." : "Automatic copy failed. The text is visible and ready to copy.");
    }
  };

  return (
    <>
      <div className="executive-report-actions-v382">
        <button className="button primary executive-report-button-v381" onClick={exportPdf} disabled={working}>
          {working ? <LoaderCircle className="spin"/> : <FileDown/>}
          {working
            ? (isArabic ? "جاري التصدير…" : "Exporting…")
            : (isArabic ? "تقرير المنصة الشهري PDF" : "Export monthly platform PDF")}
        </button>
        <button className="button subtle executive-summary-button-v382" onClick={openSummary} disabled={working}>
          <Sparkles/>{isArabic ? "ملخص LinkedIn" : "LinkedIn post"}
        </button>
      </div>

      {report && (
        <div className="platform-executive-export-stage-v381" aria-hidden="true">
          <PlatformExecutiveReportDocument
            report={report}
            settings={settings}
            locale={locale}
            isArabic={isArabic}
            reportRef={reportRef}
          />
        </div>
      )}

      {summaryOpen && (
        <div className="executive-summary-overlay-v382" role="dialog" aria-modal="true" aria-label={isArabic ? "ملخص LinkedIn" : "LinkedIn executive summary"}>
          <section className="executive-summary-modal-v382">
            <header><div><span className="eyebrow">AI EXECUTIVE SUMMARY</span><h2>{isArabic ? "منشور LinkedIn جاهز للنشر" : "LinkedIn-ready monthly post"}</h2><p>{isArabic ? "تم إنشاؤه تلقائيًا من بيانات المحافظ والتوصيات الحالية." : "Automatically generated from the current portfolio and recommendation data."}</p></div><button className="icon-button" onClick={() => setSummaryOpen(false)} aria-label="Close"><X/></button></header>
            <textarea readOnly value={summary}/>
            <footer><button className="button primary" onClick={copySummary}><Copy/>{isArabic ? "نسخ المنشور" : "Copy post"}</button><button className="button subtle" onClick={() => setSummaryOpen(false)}>{isArabic ? "إغلاق" : "Close"}</button></footer>
          </section>
        </div>
      )}
    </>
  );
}

function PlatformExecutiveReportDocument({ report, settings, locale, isArabic, reportRef }) {
  const totalRows = report.portfolioRows.length + report.recommendationRows.length;
  const densityClass = totalRows > 22 ? "density-tight" : totalRows > 13 ? "density-compact" : "density-standard";
  const disclaimer = (isArabic ? settings.disclaimer_ar : settings.disclaimer_en)
    || (isArabic ? "الأداء السابق لا يضمن النتائج المستقبلية." : "Past performance does not guarantee future results.");
  const bestPortfolio = report.snapshot.bestPortfolio;
  const bestRecommendation = report.snapshot.bestRecommendation;

  return (
    <article
      className={`platform-executive-report-v381 platform-executive-report-v382 ${densityClass} ${isArabic ? "is-arabic" : "is-english"}`}
      ref={reportRef}
      dir={isArabic ? "rtl" : "ltr"}
      lang={isArabic ? "ar" : "en"}
    >
      <header className="platform-executive-header-v381">
        <div className="platform-executive-brand-v381" dir="ltr">
          {settings.logo_url
            ? <img src={settings.logo_url} alt="ALPHA PLATFORM" crossOrigin="anonymous"/>
            : <span className="platform-executive-brand-mark-v381">AC</span>}
          <div><b>ALPHA PLATFORM</b><small>{isArabic ? "استخبارات استثمارية مستقلة" : "INDEPENDENT INVESTMENT INTELLIGENCE"}</small></div>
        </div>
        <div className="platform-executive-period-v381">
          <small>{isArabic ? "التقرير التنفيذي الشهري" : "MONTHLY EXECUTIVE SUMMARY"}</small>
          <b>{report.periodLabel}</b>
          <span>{isArabic ? "آخر تحديث" : "Last update"}: {dateTimeLabel(report.latestUpdate, locale)}</span>
        </div>
      </header>

      <section className="platform-executive-title-v381">
        <div><span>{isArabic ? "ملخص المنصة" : "PLATFORM STATUS"}</span><h1>{isArabic ? "ملخص أداء المحافظ والتوصيات النشطة" : "Portfolio & active calls executive overview"}</h1><p>{isArabic ? "لقطة تنفيذية مختصرة لأداء جميع المحافظ المنشورة والتوصيات المفتوحة على منصة ألفا." : "A concise platform-wide snapshot of every active portfolio and open stock recommendation."}</p></div>
        <div className="platform-executive-generated-v381"><small>{isArabic ? "تم الإنشاء" : "Generated"}</small><b>{dateTimeLabel(report.generatedAt, locale)}</b></div>
      </section>

      <section className="platform-executive-snapshot-v381">
        <ExecutiveMetric label={isArabic ? "المحافظ النشطة" : "Active portfolios"} value={formatNumber(report.snapshot.portfolios, 0, locale)} note={isArabic ? "استراتيجيات منشورة" : "Published strategies"}/>
        <ExecutiveMetric label={isArabic ? "التوصيات المفتوحة" : "Active recommendations"} value={formatNumber(report.snapshot.recommendations, 0, locale)} note={isArabic ? "توصيات قيد المتابعة" : "Calls under active tracking"}/>
        <ExecutiveMetric label={isArabic ? "متوسط الألفا الشهرية" : "Average monthly Alpha"} value={formatPercent(report.snapshot.averageAlpha)} note={bestPortfolio ? `${isArabic ? "الأعلى تراكميًا" : "Top cumulative"}: ${bestPortfolio.name}` : "—"} tone={report.snapshot.averageAlpha >= 0 ? "positive" : "negative"}/>
        <ExecutiveMetric label={isArabic ? "أفضل توصية نشطة" : "Best active call"} value={bestRecommendation ? formatPercent(bestRecommendation.returnPct) : "—"} note={bestRecommendation ? bestRecommendation.ticker : "—"} tone={(bestRecommendation?.returnPct || 0) >= 0 ? "positive" : "negative"}/>
      </section>

      <section className="platform-executive-section-v381 portfolios-section-v381">
        <SectionTitle index="01" title={isArabic ? "نظرة عامة على المحافظ" : "Portfolios overview"} subtitle={isArabic ? "أحدث فترة منشورة لكل استراتيجية نشطة" : "Latest published period for every active strategy"}/>
        <table className="platform-executive-table-v381 portfolios-table-v381">
          <thead><tr><th>{isArabic ? "المحفظة والاستراتيجية" : "Portfolio & primary strategy"}</th><th>{isArabic ? "الفترة" : "Period"}</th><th>{isArabic ? "العائد" : "Return"}</th><th>{isArabic ? "المؤشر" : "Benchmark"}</th><th>Alpha</th><th>{isArabic ? "ألفا تراكمية" : "Cumulative Alpha"}</th></tr></thead>
          <tbody>
            {report.portfolioRows.map((row) => <tr key={row.id}>
              <td><b>{row.name}</b><small>{row.strategy}</small></td>
              <td><span className="executive-status-v381">{row.status}</span><small>{row.period}</small></td>
              <td dir="ltr" className={row.portfolioReturn >= 0 ? "positive" : "negative"}>{formatPercent(row.portfolioReturn)}</td>
              <td dir="ltr">{formatPercent(row.benchmarkReturn)}</td>
              <td dir="ltr" className={row.alpha >= 0 ? "positive" : "negative"}>{formatPercent(row.alpha)}</td>
              <td dir="ltr" className={row.cumulativeAlpha >= 0 ? "positive" : "negative"}>{formatPercent(row.cumulativeAlpha)}</td>
            </tr>)}
            {!report.portfolioRows.length && <tr><td colSpan="6" className="platform-executive-empty-v381">{isArabic ? "لا توجد محافظ نشطة منشورة." : "No active published portfolios."}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="platform-executive-section-v381 recommendations-section-v381">
        <SectionTitle index="02" title={isArabic ? "ملخص التوصيات النشطة" : "Active recommendations summary"} subtitle={isArabic ? "أسعار وعوائد كل توصية مفتوحة في جدول مختصر" : "Compact pricing and return-to-date for every open call"}/>
        <table className="platform-executive-table-v381 recommendations-table-v381 recommendations-table-v382">
          <thead><tr><th>{isArabic ? "السهم" : "Ticker"}</th><th>{isArabic ? "الدخول" : "Entry"}</th><th>{isArabic ? "الحالي" : "Current"}</th><th>{isArabic ? "العائد حتى الآن" : "Return so far"}</th><th>{isArabic ? "المستهدف" : "Target"}</th><th>{isArabic ? "المتبقي" : "Upside"}</th><th>{isArabic ? "منذ الإصدار" : "Issued"}</th></tr></thead>
          <tbody>
            {report.recommendationRows.map((row) => <tr key={row.id}>
              <td><b dir="ltr" className="executive-ticker-v382">{row.ticker}</b></td>
              <td dir="ltr">{formatNumber(row.entryPrice, 2, locale)}</td>
              <td dir="ltr">{formatNumber(row.currentPrice, 2, locale)}</td>
              <td dir="ltr" className={row.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(row.returnPct)}</td>
              <td dir="ltr">{formatNumber(row.targetPrice, 2, locale)}</td>
              <td dir="ltr" className={row.upsideToTarget >= 0 ? "positive" : "negative"}>{formatPercent(row.upsideToTarget)}</td>
              <td><b dir="ltr">{row.durationDays}</b><small>{isArabic ? " يوم" : " days"}</small></td>
            </tr>)}
            {!report.recommendationRows.length && <tr><td colSpan="7" className="platform-executive-empty-v381">{isArabic ? "لا توجد توصيات مفتوحة حاليًا." : "No active recommendations at this time."}</td></tr>}
          </tbody>
        </table>
      </section>

      {totalRows <= 14 && (
        <section className="platform-executive-signals-v382">
          <ExecutiveSignal label={isArabic ? "المحفظة الأعلى" : "Portfolio leader"} title={bestPortfolio?.name || "—"} value={bestPortfolio ? formatPercent(bestPortfolio.cumulativeAlpha) : "—"} note={isArabic ? "ألفا تراكمية" : "Cumulative Alpha"}/>
          <ExecutiveSignal label={isArabic ? "التوصية الأبرز" : "Leading active call"} title={bestRecommendation?.ticker || "—"} value={bestRecommendation ? formatPercent(bestRecommendation.returnPct) : "—"} note={isArabic ? "عائد حتى الآن" : "Return so far"}/>
          <ExecutiveSignal label={isArabic ? "تغطية المنصة" : "Platform coverage"} title={`${report.snapshot.portfolios} + ${report.snapshot.recommendations}`} value={report.periodLabel} note={isArabic ? "محافظ + توصيات مفتوحة" : "Portfolios + open calls"}/>
        </section>
      )}

      <footer className="platform-executive-footer-v381">
        <div><b>ALPHA PLATFORM</b><span>{disclaimer}</span></div>
        <div><span>{isArabic ? "ملخص تنفيذي - التقارير التفصيلية لكل محفظة هي المرجع الكامل" : "Executive summary - individual portfolio factsheets remain the detailed source"}</span><b>{isArabic ? "صفحة 1 من 1" : "Page 1 of 1"}</b></div>
      </footer>
    </article>
  );
}

function ExecutiveMetric({ label, value, note, tone = "neutral" }) {
  return <div className={`platform-executive-metric-v381 ${tone}`}><small>{label}</small><b dir="ltr">{value}</b><span>{note}</span></div>;
}

function ExecutiveSignal({ label, title, value, note }) {
  return <div><small>{label}</small><b>{title}</b><strong dir="ltr">{value}</strong><span>{note}</span></div>;
}

function SectionTitle({ index, title, subtitle }) {
  return <header className="platform-executive-section-title-v381"><span>{index}</span><div><h2>{title}</h2><p>{subtitle}</p></div></header>;
}
