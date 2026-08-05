import { useRef, useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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

const truncate = (value, max = 108) => {
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
          || (isArabic ? "استراتيجية منشورة على منصة ألفا" : "Published ALPHA investment strategy")
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
      ticker: recommendation.ticker,
      company: truncate(recommendation.company_name || recommendation.title || recommendation.ticker, 48),
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
  const latestUpdate = [...portfolioRows.map((row) => row.updatedAt), ...pricesToDates(priceResult.data || [])]
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

function pricesToDates(prices = []) {
  return prices.map((row) => row.price_date).filter(Boolean);
}

function waitForRender(ref, attempts = 20) {
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
  const { isArabic } = useLanguage();
  const { settings } = usePlatformSettings();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [working, setWorking] = useState(false);
  const [report, setReport] = useState(null);
  const reportRef = useRef(null);

  const exportPdf = async () => {
    if (working) return;
    setWorking(true);
    onMessage?.(isArabic ? "جاري تجهيز التقرير التنفيذي…" : "Preparing the executive report…");

    try {
      const nextReport = await loadExecutiveReportData(locale, isArabic);
      setReport(nextReport);
      const root = await waitForRender(reportRef);
      await waitForAssets(root);

      const sourceCanvas = await html2canvas(root, {
        scale: 2.4,
        backgroundColor: "#f4f7fb",
        useCORS: true,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(1120, root.scrollWidth),
        width: root.scrollWidth,
        height: root.scrollHeight,
      });

      const a4Canvas = document.createElement("canvas");
      a4Canvas.width = PAGE_WIDTH;
      a4Canvas.height = PAGE_HEIGHT;
      const context = a4Canvas.getContext("2d");
      if (!context) throw new Error(isArabic ? "تعذر إنشاء صفحة A4" : "Could not create the A4 page.");

      context.fillStyle = "#f4f7fb";
      context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      const marginX = 84;
      const marginY = 78;
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

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      pdf.setProperties({
        title: `ALPHA Platform Executive Summary - ${nextReport.periodLabel}`,
        subject: "Monthly portfolio and active recommendation executive summary",
        author: "ALPHA PLATFORM",
        creator: "ALPHA PLATFORM",
      });
      pdf.addImage(a4Canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 210, 297, undefined, "FAST");
      downloadBlob(pdf.output("blob"), `alpha-platform-executive-summary-${nextReport.periodKey}.pdf`);
      onMessage?.(isArabic ? "تم إنشاء التقرير التنفيذي في صفحة A4 واحدة" : "Single-page A4 executive report generated.");
    } catch (error) {
      onMessage?.(error.message || String(error));
    } finally {
      setWorking(false);
      window.setTimeout(() => setReport(null), 400);
    }
  };

  return (
    <>
      <button className="button primary executive-report-button-v381" onClick={exportPdf} disabled={working}>
        {working ? <LoaderCircle className="spin"/> : <FileDown/>}
        {working
          ? (isArabic ? "جاري التصدير…" : "Exporting…")
          : (isArabic ? "تقرير المنصة الشهري PDF" : "Export monthly platform PDF")}
      </button>
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
    </>
  );
}

function PlatformExecutiveReportDocument({ report, settings, locale, isArabic, reportRef }) {
  const totalRows = report.portfolioRows.length + report.recommendationRows.length;
  const densityClass = totalRows > 22 ? "density-tight" : totalRows > 13 ? "density-compact" : "density-standard";
  const disclaimer = (isArabic ? settings.disclaimer_ar : settings.disclaimer_en)
    || (isArabic ? "الأداء السابق لا يضمن النتائج المستقبلية." : "Past performance does not guarantee future results.");

  return (
    <article className={`platform-executive-report-v381 ${densityClass}`} ref={reportRef} dir={isArabic ? "rtl" : "ltr"}>
      <header className="platform-executive-header-v381">
        <div className="platform-executive-brand-v381">
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
        <div><span>{isArabic ? "ملخص المنصة" : "PLATFORM STATUS"}</span><h1>{isArabic ? "ملخص أداء المحافظ والتوصيات النشطة" : "Portfolio & active calls executive overview"}</h1><p>{isArabic ? "لقطة مختصرة لأداء جميع المحافظ المنشورة والتوصيات المفتوحة على منصة ألفا." : "A concise platform-wide snapshot of every active portfolio and open stock recommendation."}</p></div>
        <div className="platform-executive-generated-v381"><small>{isArabic ? "تم الإنشاء" : "Generated"}</small><b>{dateTimeLabel(report.generatedAt, locale)}</b></div>
      </section>

      <section className="platform-executive-snapshot-v381">
        <ExecutiveMetric label={isArabic ? "المحافظ النشطة" : "Active portfolios"} value={formatNumber(report.snapshot.portfolios, 0, locale)} note={isArabic ? "محافظ منشورة" : "Published strategies"}/>
        <ExecutiveMetric label={isArabic ? "التوصيات المفتوحة" : "Active recommendations"} value={formatNumber(report.snapshot.recommendations, 0, locale)} note={isArabic ? "توصيات قيد المتابعة" : "Calls under active tracking"}/>
        <ExecutiveMetric label={isArabic ? "متوسط ألفا الشهري" : "Average monthly Alpha"} value={formatPercent(report.snapshot.averageAlpha)} note={report.snapshot.bestPortfolio ? `${isArabic ? "الأعلى تراكميًا" : "Top cumulative"}: ${report.snapshot.bestPortfolio.name}` : "—"} tone={report.snapshot.averageAlpha >= 0 ? "positive" : "negative"}/>
        <ExecutiveMetric label={isArabic ? "أفضل توصية نشطة" : "Best active call"} value={report.snapshot.bestRecommendation ? formatPercent(report.snapshot.bestRecommendation.returnPct) : "—"} note={report.snapshot.bestRecommendation ? `${report.snapshot.bestRecommendation.ticker} · ${report.snapshot.bestRecommendation.company}` : "—"} tone={(report.snapshot.bestRecommendation?.returnPct || 0) >= 0 ? "positive" : "negative"}/>
      </section>

      <section className="platform-executive-section-v381 portfolios-section-v381">
        <SectionTitle index="01" title={isArabic ? "نظرة عامة على المحافظ" : "Portfolios overview"} subtitle={isArabic ? "أحدث فترة منشورة لكل استراتيجية نشطة" : "Latest published period for every active strategy"}/>
        <table className="platform-executive-table-v381 portfolios-table-v381">
          <thead><tr><th>{isArabic ? "المحفظة والاستراتيجية" : "Portfolio & primary strategy"}</th><th>{isArabic ? "الفترة" : "Period"}</th><th>{isArabic ? "المحفظة" : "Portfolio"}</th><th>{isArabic ? "المؤشر" : "Benchmark"}</th><th>Alpha</th><th>{isArabic ? "ألفا تراكمية" : "Cumulative Alpha"}</th></tr></thead>
          <tbody>
            {report.portfolioRows.map((row) => <tr key={row.id}>
              <td><b>{row.name}</b><small>{row.strategy}</small></td>
              <td><span className="executive-status-v381">{row.status}</span><small>{row.period}</small></td>
              <td className={row.portfolioReturn >= 0 ? "positive" : "negative"}>{formatPercent(row.portfolioReturn)}</td>
              <td>{formatPercent(row.benchmarkReturn)}</td>
              <td className={row.alpha >= 0 ? "positive" : "negative"}>{formatPercent(row.alpha)}</td>
              <td className={row.cumulativeAlpha >= 0 ? "positive" : "negative"}>{formatPercent(row.cumulativeAlpha)}</td>
            </tr>)}
            {!report.portfolioRows.length && <tr><td colSpan="6" className="platform-executive-empty-v381">{isArabic ? "لا توجد محافظ نشطة منشورة." : "No active published portfolios."}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="platform-executive-section-v381 recommendations-section-v381">
        <SectionTitle index="02" title={isArabic ? "ملخص التوصيات النشطة" : "Active recommendations summary"} subtitle={isArabic ? "الأسعار والعائد حتى الآن لكل توصية مفتوحة" : "Current pricing and return-to-date for every open call"}/>
        <table className="platform-executive-table-v381 recommendations-table-v381">
          <thead><tr><th>{isArabic ? "السهم" : "Ticker"}</th><th>{isArabic ? "الشركة" : "Company"}</th><th>{isArabic ? "الدخول" : "Entry"}</th><th>{isArabic ? "الحالي" : "Current"}</th><th>{isArabic ? "العائد حتى الآن" : "Return so far"}</th><th>{isArabic ? "المستهدف" : "Target"}</th><th>{isArabic ? "المتبقي" : "Upside"}</th><th>{isArabic ? "منذ الإصدار" : "Issued"}</th></tr></thead>
          <tbody>
            {report.recommendationRows.map((row) => <tr key={row.id}>
              <td><b>{row.ticker}</b></td>
              <td>{row.company}</td>
              <td>{formatNumber(row.entryPrice, 2, locale)}</td>
              <td>{formatNumber(row.currentPrice, 2, locale)}</td>
              <td className={row.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(row.returnPct)}</td>
              <td>{formatNumber(row.targetPrice, 2, locale)}</td>
              <td className={row.upsideToTarget >= 0 ? "positive" : "negative"}>{formatPercent(row.upsideToTarget)}</td>
              <td><b>{row.durationDays}</b><small>{isArabic ? " يوم" : " days"}</small></td>
            </tr>)}
            {!report.recommendationRows.length && <tr><td colSpan="8" className="platform-executive-empty-v381">{isArabic ? "لا توجد توصيات مفتوحة حاليًا." : "No active recommendations at this time."}</td></tr>}
          </tbody>
        </table>
      </section>

      <footer className="platform-executive-footer-v381">
        <div><b>ALPHA PLATFORM</b><span>{disclaimer}</span></div>
        <div><span>{isArabic ? "ملخص تنفيذي - لا يحل محل التقارير التفصيلية لكل محفظة" : "Executive summary - individual portfolio factsheets remain the detailed source"}</span><b>{isArabic ? "صفحة 1 من 1" : "Page 1 of 1"}</b></div>
      </footer>
    </article>
  );
}

function ExecutiveMetric({ label, value, note, tone = "neutral" }) {
  return <div className={`platform-executive-metric-v381 ${tone}`}><small>{label}</small><b>{value}</b><span>{note}</span></div>;
}

function SectionTitle({ index, title, subtitle }) {
  return <header className="platform-executive-section-title-v381"><span>{index}</span><div><h2>{title}</h2><p>{subtitle}</p></div></header>;
}
