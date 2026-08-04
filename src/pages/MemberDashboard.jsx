import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowUpRight, Check, Clock3, Download, FileText, Link2, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Link, useParams } from "react-router-dom";
import Brand from "../components/Brand";
import AuthorAttribution from "../components/AuthorAttribution";
import CompanyMark from "../components/CompanyMark";
import DashboardHeader from "../components/DashboardHeader";
import InsightDrawer from "../components/InsightDrawer";
import MarketNewsWidget from "../components/MarketNewsWidget";
import PerformanceChart from "../components/PerformanceChart";
import PortfolioVisualSuite from "../components/PortfolioVisualSuite";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";
import {
  buildMonthlyPerformanceSeries,
  buildMonthlyTrackRecord,
  calculateMonth,
  effectiveReturns,
  dateTimeLabel,
  filterSeriesByRange,
  formatNumber,
  formatPercent,
  monthLabel,
} from "../lib/calculations";
import { recommendationMetrics } from "../lib/recommendations";
import { RECOMMENDATION_IMAGE_TITLE } from "../lib/recommendationMedia";

const allocationColours = ["#20d3ff", "#8b5cf6", "#2dd4bf", "#60a5fa", "#f97316", "#6366f1", "#ec4899", "#14b8a6", "#a78bfa", "#94a3b8"];

async function loadPublishedData() {
  const [portfolioResult, monthResult, recommendationResult, reportResult, priceResult] = await Promise.all([
    supabase.from("portfolios").select("*").eq("is_published", true).order("created_at", { ascending: true }),
    supabase.from("strategy_months").select("*, holdings(*), swaps(*), snapshots(*)").eq("is_published", true).order("month_key", { ascending: true }),
    supabase.from("recommendations").select("*").eq("is_published", true).order("recommendation_date", { ascending: false }),
    supabase.from("weekly_reports").select("*").eq("is_published", true).order("week_end", { ascending: false }).limit(4),
    supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
  ]);
  const error = portfolioResult.error || monthResult.error || recommendationResult.error || reportResult.error || priceResult.error;
  if (error) throw error;
  const optional = await Promise.allSettled([
    supabase.from("recommendation_updates").select("*").order("update_date", { ascending: false }).limit(50),
    supabase.from("profiles").select("*"),
    supabase.from("portfolio_peak_alpha").select("*"),
  ]);
  return {
    portfolios: portfolioResult.data || [],
    months: monthResult.data || [],
    recommendations: recommendationResult.data || [],
    reports: reportResult.data || [],
    priceRows: priceResult.data || [],
    updates: optional[0].status === "fulfilled" ? (optional[0].value.data || []).filter((item) => item.title !== RECOMMENDATION_IMAGE_TITLE).slice(0, 12) : [],
    profiles: optional[1].status === "fulfilled" ? optional[1].value.data || [] : [],
    peaks: optional[2]?.status === "fulfilled" ? optional[2].value.data || [] : [],
  };
}

export default function MemberDashboard() {
  const reportRef = useRef(null);
  const { slug } = useParams();
  const { t, isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [portfolios, setPortfolios] = useState([]);
  const [allMonths, setAllMonths] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [reports, setReports] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [portfolioPeaks, setPortfolioPeaks] = useState({});
  const [prices, setPrices] = useState({});
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [range, setRange] = useState("ALL");
  const [exporting, setExporting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await loadPublishedData();
      setPortfolios(data.portfolios);
      setAllMonths(data.months);
      setRecommendations(data.recommendations);
      setReports(data.reports);
      setUpdates(data.updates || []);
      setProfiles(data.profiles || []);
      setPortfolioPeaks(Object.fromEntries((data.peaks || []).map((row) => [row.portfolio_id, row])));
      setPrices(Object.fromEntries(data.priceRows.map((row) => [String(row.ticker).toUpperCase(), row])));
      setSelectedPortfolioId((current) => {
        const requestedPortfolio = slug ? data.portfolios.find((item) => item.slug === slug) : null;
        const portfolioId = requestedPortfolio?.id || (data.portfolios.some((item) => item.id === current) ? current : data.portfolios[0]?.id || "");
        const portfolioMonths = data.months.filter((month) => month.portfolio_id === portfolioId);
        setSelectedKey((key) => portfolioMonths.some((month) => month.month_key === key) ? key : portfolioMonths.at(-1)?.month_key || "");
        return portfolioId;
      });
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("alpha-platform-members-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolios" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "strategy_months" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "holdings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "swaps" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "recommendations" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_reports" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "recommendation_updates" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolio_peak_alpha" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const currentPortfolio = portfolios.find((item) => item.id === selectedPortfolioId) || portfolios[0] || null;
  const months = useMemo(() => allMonths.filter((month) => month.portfolio_id === currentPortfolio?.id), [allMonths, currentPortfolio?.id]);
  const selected = months.find((month) => month.month_key === selectedKey) || months.at(-1);
  const metrics = useMemo(() => calculateMonth(selected), [selected]);
  const selectedReturns = useMemo(() => effectiveReturns(selected), [selected]);
  const trackRecord = useMemo(() => buildMonthlyTrackRecord(months, locale), [months, locale]);
  const latestCumulative = trackRecord.at(-1) || {};
  const fullSeries = useMemo(() => buildMonthlyPerformanceSeries(months, locale), [months, locale]);
  const chartData = useMemo(() => filterSeriesByRange(fullSeries, range), [fullSeries, range]);
  const recentUpdates = [...trackRecord].reverse().slice(0, 4);
  const recommendationByTicker = useMemo(() => Object.fromEntries(recommendations.map((item) => [String(item.ticker).toUpperCase(), item])), [recommendations]);
  const latestRecommendation = recommendations[0] || null;
  const latestReport = reports[0] || null;
  const bestHolding = [...(metrics.rows || [])].sort((a, b) => Number(b.mtd || 0) - Number(a.mtd || 0))[0];
  const worstHolding = [...(metrics.rows || [])].sort((a, b) => Number(a.mtd || 0) - Number(b.mtd || 0))[0];
  const portfolioTitle = isArabic && currentPortfolio?.name_ar ? currentPortfolio.name_ar : currentPortfolio?.name;
  const portfolioAuthor = profiles.find((item) => item.id === currentPortfolio?.created_by) || null;
  const calculatedPeak = useMemo(() => trackRecord.reduce((best, row) => {
    if (!best || Number(row.cumulativeAlpha) > Number(best.cumulativeAlpha)) return row;
    return best;
  }, null), [trackRecord]);
  const backendPeak = portfolioPeaks[currentPortfolio?.id] || null;
  const peakAlpha = Number(backendPeak?.peak_alpha ?? calculatedPeak?.cumulativeAlpha ?? 0);
  const peakAlphaDate = backendPeak?.achieved_at || calculatedPeak?.updatedAt || null;

  const changePortfolio = (id) => {
    setSelectedPortfolioId(id);
    const nextMonths = allMonths.filter((month) => month.portfolio_id === id);
    setSelectedKey(nextMonths.at(-1)?.month_key || "");
    setRange("ALL");
  };


  const copyDirectLink = async () => {
    if (!currentPortfolio?.slug) return;
    const directUrl = `${window.location.origin}/portfolio/${currentPortfolio.slug}`;
    try {
      await navigator.clipboard.writeText(directUrl);
      setLinkCopied(true);
      setMessage(isArabic ? "تم نسخ الرابط المباشر للمحفظة" : "Direct portfolio link copied.");
      window.dispatchEvent(new CustomEvent("alpha:meaningful-action", { detail: { action: "copy_portfolio_link" } }));
      window.setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      window.prompt(isArabic ? "انسخ رابط المحفظة" : "Copy portfolio link", directUrl);
    }
  };

  const exportPdf = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    setMessage(isArabic ? "جاري تجهيز التقرير…" : "Preparing your report…");
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 1.7, backgroundColor: "#07131f", useCORS: true, logging: false, windowWidth: 1600 });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL("image/jpeg", 0.94);
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.setFillColor(7, 19, 31);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 2) {
        position -= pageHeight;
        pdf.addPage();
        pdf.setFillColor(7, 19, 31);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`ALPHA-PLATFORM-${currentPortfolio?.slug || "PORTFOLIO"}-${selected?.month_key || "REPORT"}-V3.4.pdf`);
      window.dispatchEvent(new CustomEvent("alpha:meaningful-action", { detail: { action: "export_portfolio_pdf" } }));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setExporting(false);
    }
  };

  const aiSummary = selected ? (isArabic
    ? `${portfolioTitle} تحقق عائدًا شهريًا ${formatPercent(selectedReturns.portfolio)} مقابل ${formatPercent(selectedReturns.benchmark)} للمؤشر، بألفا ${formatPercent(selectedReturns.portfolio - selectedReturns.benchmark)}. الأداء التراكمي للمحفظة ${formatPercent(latestCumulative.cumulativePortfolio)} مقابل ${formatPercent(latestCumulative.cumulativeBenchmark)} للمؤشر. أفضل سهم حاليًا ${bestHolding?.ticker || "—"} بعائد ${formatPercent(bestHolding?.mtd)}، وأسوأ سهم ${worstHolding?.ticker || "—"} بعائد ${formatPercent(worstHolding?.mtd)}. المحفظة ${selected.is_closed ? "نهائية" : "مباشرة"} وآخر تحديث ${dateTimeLabel(selected.updated_at, locale)}.`
    : `${portfolioTitle} returned ${formatPercent(selectedReturns.portfolio)} for the selected month versus ${formatPercent(selectedReturns.benchmark)} for the benchmark, generating ${formatPercent(selectedReturns.portfolio - selectedReturns.benchmark)} of Alpha. Cumulative portfolio performance is ${formatPercent(latestCumulative.cumulativePortfolio)} versus ${formatPercent(latestCumulative.cumulativeBenchmark)} for the benchmark. The strongest holding is ${bestHolding?.ticker || "—"} at ${formatPercent(bestHolding?.mtd)}, while the weakest is ${worstHolding?.ticker || "—"} at ${formatPercent(worstHolding?.mtd)}. The portfolio is ${selected.is_closed ? "final" : "live"} and was last updated ${dateTimeLabel(selected.updated_at, locale)}.`) : "";

  if (loading) return <div className="screen-loader skeleton-loader-v3"><div className="loader-ring"/><p>{t("loading")}</p><div className="skeleton-bars"><i/><i/><i/></div></div>;

  return (
    <div className="dashboard-shell member-shell-v3">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}

      {!selected ? (
        <div className="empty-state-v21"><Activity size={52}/><h1>{t("firstReport")}</h1><p>{t("firstReportText")}</p></div>
      ) : (
        <main ref={reportRef} className="member-report-v21 member-report-v3">
          <section className="executive-topbar-v3" data-html2canvas-ignore="true">
            <div><span className="live-dot"/><small>{isArabic ? "بيانات منشورة مباشرة" : "LIVE PUBLISHED DATA"}</small><b>{dateTimeLabel(selected.updated_at, locale)}</b></div>
            <div className="executive-controls-v3">
              <label><span>{isArabic ? "المحفظة" : "Portfolio"}</span><select value={currentPortfolio?.id || ""} onChange={(event) => changePortfolio(event.target.value)}>{portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{isArabic && portfolio.name_ar ? portfolio.name_ar : portfolio.name}</option>)}</select></label>
              <label><span>{isArabic ? "الفترة" : "Period"}</span><select value={selected.month_key} onChange={(event) => setSelectedKey(event.target.value)}>{months.map((month) => <option value={month.month_key} key={month.id}>{monthLabel(month.month_key, false, locale)}</option>)}</select></label>
              <button className="button subtle" onClick={refresh}><RefreshCw size={15}/>{t("refresh")}</button>
            </div>
          </section>

          <div className="pdf-brand-strip-v31"><Brand staticMode/><span><small>{isArabic ? "تقرير محفظة منشور" : "PUBLISHED PORTFOLIO REPORT"}</small><b>{dateTimeLabel(selected.updated_at, locale)}</b></span></div>

          <section className="dashboard-overview-v3">
            <div className="overview-copy-v3">
              <span className="eyebrow">INSTITUTIONAL PORTFOLIO DASHBOARD</span>
              <h1>{isArabic ? "صباح الخير. هذه صورة الأداء الحالية." : "Good morning. Here is the current investment picture."}</h1>
              <p>{isArabic ? "نظرة تنفيذية على المحفظة والتوصيات والأبحاث وأحدث ما تغير." : "An executive view of portfolio performance, recommendations, research and the latest material changes."}</p>
            </div>
            <div className="overview-actions-v3" data-html2canvas-ignore="true">
              <InsightDrawer label={isArabic ? "اشرح الأداء" : "Explain performance"} title={isArabic ? "ملخص أداء المحفظة" : "Portfolio performance brief"} summary={aiSummary}/>
              <button className="button subtle" onClick={copyDirectLink}><span className="copy-link-icon-v31">{linkCopied ? <Check size={15}/> : <Link2 size={15}/>}</span>{linkCopied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ الرابط المباشر" : "Copy direct link")}</button>
              <button className="button gold" onClick={exportPdf} disabled={exporting}><Download size={15}/>{exporting ? t("loading") : t("exportPdf")}</button>
            </div>
          </section>

          <section className="portfolio-hero-metrics-v343" aria-label={isArabic ? "ملخص حالة المحفظة" : "Portfolio status summary"}>
            <div className="portfolio-hero-metric-v343 primary">
              <span>{isArabic ? "أداء الشهر الحالي" : "Current month performance"}</span>
              <b className={selectedReturns.portfolio >= 0 ? "positive" : "negative"}>{formatPercent(selectedReturns.portfolio)}</b>
              <small>{monthLabel(selected.month_key, true, locale)}</small>
            </div>
            <div className="portfolio-hero-metric-v343 alpha">
              <span>{isArabic ? "ألفا الشهر الحالي" : "Current month Alpha"}</span>
              <b className={selectedReturns.portfolio - selectedReturns.benchmark >= 0 ? "positive" : "negative"}>{formatPercent(selectedReturns.portfolio - selectedReturns.benchmark)}</b>
              <small>{isArabic ? "المحفظة ناقص المؤشر" : "Portfolio less benchmark"}</small>
            </div>
            <div className="portfolio-hero-metric-v343 cumulative">
              <span>{isArabic ? "الألفا التاريخية" : "Historical cumulative Alpha"}</span>
              <b className={Number(latestCumulative.cumulativeAlpha || 0) >= 0 ? "positive" : "negative"}>{formatPercent(latestCumulative.cumulativeAlpha)}</b>
              <small>{isArabic ? "منذ الإطلاق" : "Since launch"}</small>
            </div>
            <div className="portfolio-hero-metric-v343 peak">
              <span>{isArabic ? "أعلى ألفا تاريخية" : "Highest historical Alpha"}</span>
              <b>{formatPercent(peakAlpha)}</b>
              <small>{peakAlphaDate ? (isArabic ? `تحققت في ${dateTimeLabel(peakAlphaDate, locale)}` : `Achieved on ${dateTimeLabel(peakAlphaDate, locale)}`) : (isArabic ? "يبدأ التسجيل بعد أول تحديث" : "Tracking starts with the first update")}</small>
            </div>
            <div className="portfolio-hero-metric-v343 benchmark">
              <span>{selected.benchmark_ticker || currentPortfolio?.benchmark_ticker || "EGX30CAP"}</span>
              <b className={selectedReturns.benchmark >= 0 ? "benchmark-positive" : "negative"}>{formatPercent(selectedReturns.benchmark)}</b>
              <small>{isArabic ? "الأثر على الألفا" : "Impact on Alpha"}: <em className={-selectedReturns.benchmark >= 0 ? "positive" : "negative"}>{formatPercent(-selectedReturns.benchmark)}</em></small>
            </div>
          </section>

          <section className="portfolio-analysis-focus-v343">
            <PortfolioVisualSuite
              portfolioReturn={selectedReturns.portfolio}
              benchmarkReturn={selectedReturns.benchmark}
              benchmarkTicker={selected.benchmark_ticker || currentPortfolio?.benchmark_ticker || "EGX30CAP"}
              isArabic={isArabic}
            />

            <article className="panel-v21 chart-panel-v21 chart-panel-v3 portfolio-performance-focus-v343">
              <div className="panel-heading-v21"><div><span className="eyebrow">CUMULATIVE PERFORMANCE</span><h2>{t("performanceOverview")}</h2><p>{isArabic ? "أداء المحفظة والمؤشر والألفا منذ الإطلاق." : "Portfolio, benchmark and Alpha since launch."}</p></div><div className="range-switch" data-html2canvas-ignore="true">{["3M", "6M", "1Y", "ALL"].map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div></div>
              <PerformanceChart data={chartData}/>
              <div className="chart-footnote-v3"><span>{isArabic ? "عائد المحفظة منذ الإطلاق" : "Portfolio since launch"}: <b className={Number(latestCumulative.cumulativePortfolio || 0) >= 0 ? "positive" : "negative"}>{formatPercent(latestCumulative.cumulativePortfolio)}</b></span><span>{isArabic ? "عائد المؤشر منذ الإطلاق" : "Benchmark since launch"}: <b className={Number(latestCumulative.cumulativeBenchmark || 0) >= 0 ? "benchmark-positive" : "negative"}>{formatPercent(latestCumulative.cumulativeBenchmark)}</b></span></div>
            </article>
          </section>

          <section className="smart-holdings-section-v343 panel-v21">
            <div className="panel-heading-v21 smart-holdings-heading-v343"><div><span className="eyebrow">STOCK IMPACT MAP</span><h2>{isArabic ? "تأثير مكونات المحفظة" : "Portfolio impact by holding"}</h2><p>{isArabic ? "كل سهم يظهر مرة واحدة فقط مع السعر الافتتاحي والحالي وتأثيره والفكرة الاستثمارية." : "Each holding appears once, with its opening price, current price, exact contribution and investment thesis."}</p></div><span className={`status-pill ${selected.is_closed ? "final" : "live"}`}>{selected.is_closed ? t("final") : t("live")}</span></div>
            <div className="smart-holdings-grid-v343">{metrics.rows.map((row, index) => {
              const research = recommendationByTicker[String(row.ticker).toUpperCase()];
              const company = prices[String(row.ticker).toUpperCase()]?.company_name || research?.company_name || row.company_name || row.ticker;
              const thesis = row.investment_thesis || research?.thesis || "";
              const positiveImpact = Number(row.contribution || 0) >= 0;
              return <article className={`smart-holding-card-v343 ${positiveImpact ? "positive-impact" : "negative-impact"}`} key={row.id || row.ticker} style={{ "--holding-colour": allocationColours[index % allocationColours.length] }}>
                <header><CompanyMark ticker={row.ticker} name={company}/><div><h3>{row.ticker}</h3><p>{company}</p></div><span className="smart-weight-v343">{formatNumber(row.weight, 1, locale)}%</span></header>
                <div className="smart-holding-prices-v343"><span><small>{isArabic ? "سعر الافتتاح" : "Opening price"}</small><b>{formatNumber(row.open_price, 2, locale)}</b></span><i/><span><small>{isArabic ? "السعر الحالي" : "Current price"}</small><b>{formatNumber(row.close_price, 2, locale)}</b></span></div>
                <div className="smart-impact-row-v343"><span><small>{isArabic ? "عائد السهم" : "Stock return"}</small><b className={row.mtd >= 0 ? "positive" : "negative"}>{formatPercent(row.mtd)}</b></span><span className="smart-impact-value-v343"><small>{isArabic ? "التأثير على المحفظة" : "Portfolio impact"}</small><b className={positiveImpact ? "positive" : "negative"}>{formatPercent(row.contribution)}</b></span></div>
                <div className="smart-thesis-v343"><small>{isArabic ? "الفكرة الاستثمارية" : "Investment thesis"}</small><p>{thesis || (isArabic ? "لم تتم إضافة الفكرة الاستثمارية لهذا السهم بعد." : "No investment thesis has been added for this holding yet.")}</p></div>
                <footer>{research ? <Link to={`/recommendations/${research.id}`}>{isArabic ? "فتح البحث المرتبط" : "Open linked research"}<ArrowUpRight size={14}/></Link> : <span>{isArabic ? "لا يوجد بحث مرتبط" : "No linked research"}</span>}</footer>
              </article>;
            })}</div>
          </section>

          <section className="intelligence-dashboard-grid-v3">
            <article className="panel-v21 latest-intelligence-card-v3"><span className="eyebrow">LATEST RESEARCH</span>{latestRecommendation ? <><div className="latest-company-v3"><CompanyMark ticker={latestRecommendation.ticker}/><div><h3>{latestRecommendation.company_name}</h3><p>{latestRecommendation.title}</p></div></div><div className="latest-stat-v3"><span><small>{isArabic ? "المستهدف" : "Target"}</small><b>{formatNumber(latestRecommendation.target_price, 2, locale)}</b></span><span><small>{isArabic ? "العائد الحالي" : "Current return"}</small><b className={recommendationMetrics(latestRecommendation, prices).returnPct >= 0 ? "positive" : "negative"}>{formatPercent(recommendationMetrics(latestRecommendation, prices).returnPct)}</b></span></div><Link to={`/recommendations/${latestRecommendation.id}`}>{isArabic ? "فتح التوصية" : "Open recommendation"}<ArrowUpRight size={15}/></Link></> : <p className="muted-copy-v21">{isArabic ? "لا توجد توصيات منشورة." : "No published recommendations."}</p>}</article>
            <article className="panel-v21 latest-intelligence-card-v3"><span className="eyebrow">LATEST WEEKLY REPORT</span>{latestReport ? <><div className="report-icon-v3"><FileText size={24}/></div><h3>{latestReport.title}</h3><p>{latestReport.summary}</p><div className="latest-report-meta-v3"><Clock3 size={14}/>{dateTimeLabel(latestReport.updated_at || latestReport.published_at, locale)}</div><Link to={`/weekly-reports/${latestReport.slug}`}>{isArabic ? "قراءة التقرير" : "Read report"}<ArrowUpRight size={15}/></Link></> : <p className="muted-copy-v21">{isArabic ? "لا توجد تقارير منشورة." : "No published reports."}</p>}</article>
            <article className="panel-v21 recent-activity-v3"><span className="eyebrow">RECENT ACTIVITY</span><h3>{isArabic ? "آخر ما تغير" : "What changed recently"}</h3><div>{recentUpdates.map((row) => <button key={row.month} onClick={() => setSelectedKey(row.month)}><span className={row.isClosed ? "final" : "live"}/><div><b>{monthLabel(row.month, false, locale)}</b><small>{row.isClosed ? t("final") : t("live")}</small></div><em className={row.alpha >= 0 ? "positive" : "negative"}>{formatPercent(row.alpha)}</em></button>)}</div></article>
          </section>

          <MarketNewsWidget reports={reports} recommendations={recommendations} updates={updates} isArabic={isArabic} locale={locale}/>

          <section className="factsheet-hero-v3">
            <div className="factsheet-title-v3"><span className="eyebrow">ALPHA CORE · PORTFOLIO FACTSHEET</span><h2>{portfolioTitle}</h2><p>{currentPortfolio?.description || selected.public_commentary || t("dashboardSubtitle")}</p><div className="factsheet-meta-v3"><span><small>{isArabic ? "مدير المحفظة" : "Manager"}</small><b>{currentPortfolio?.manager_name || "ALPHA CORE Investment Committee"}</b></span><span><small>{isArabic ? "الاستراتيجية" : "Strategy"}</small><b>{currentPortfolio?.strategy_name || (isArabic ? "أسهم مصرية مركزة" : "Focused Egyptian equities")}</b></span><span><small>{isArabic ? "تاريخ الإطلاق" : "Launch date"}</small><b>{months[0]?.month_key ? monthLabel(months[0].month_key, false, locale) : "—"}</b></span><span><small>{t("lastUpdated")}</small><b>{dateTimeLabel(selected.updated_at, locale)}</b></span></div><AuthorAttribution profile={portfolioAuthor} authorId={currentPortfolio?.created_by} compact label={isArabic ? "أنشأها ويديرها" : "CREATED & MANAGED BY"}/></div><div className="factsheet-status-v3 factsheet-status-v343"><span className={`status-pill ${selected.is_closed ? "final" : "live"}`}>{selected.is_closed ? t("final") : t("live")}</span><b>{monthLabel(selected.month_key, false, locale)}</b><small>{isArabic ? "الفترة المختارة" : "SELECTED PERIOD"}</small></div>
          </section>

          <section className="track-record-v21 panel-v21 institutional-table-panel-v3">
            <div className="panel-heading-v21"><div><span className="eyebrow">PERFORMANCE HISTORY</span><h2>{t("trackRecord")}</h2><p>{t("trackRecordText")}</p></div></div>
            <div className="table-scroll"><table className="data-table-v21 compact-table"><thead><tr><th>{t("month")}</th><th>{t("status")}</th><th>{t("portfolio")}</th><th>{t("benchmark")}</th><th>{t("alpha")}</th><th>{t("cumulativePortfolio")}</th><th>{t("cumulativeBenchmark")}</th><th>{t("cumulativeAlpha")}</th></tr></thead><tbody>{[...trackRecord].reverse().map((row) => <tr key={row.month}><td><button className="month-link-v21" onClick={() => setSelectedKey(row.month)}>{monthLabel(row.month, false, locale)}</button></td><td><span className={`status-pill small ${row.isClosed ? "final" : "live"}`}>{row.isClosed ? t("final") : t("live")}</span></td><td className={row.portfolio >= 0 ? "positive" : "negative"}>{formatPercent(row.portfolio)}</td><td className={row.benchmark >= 0 ? "gold-text" : "negative"}>{formatPercent(row.benchmark)}</td><td className={row.alpha >= 0 ? "positive" : "negative"}><b>{formatPercent(row.alpha)}</b></td><td>{formatPercent(row.cumulativePortfolio)}</td><td>{formatPercent(row.cumulativeBenchmark)}</td><td className={row.cumulativeAlpha >= 0 ? "positive" : "negative"}><b>{formatPercent(row.cumulativeAlpha)}</b></td></tr>)}</tbody></table></div>
          </section>

          <section className="dashboard-detail-grid commentary-grid-v3">
            <article className="panel-v21 padded-v21"><span className="eyebrow">PORTFOLIO COMMENTARY</span><h2>{selected.update_title || `${monthLabel(selected.month_key, false, locale)} — ${t("monthlyUpdate")}`}</h2><p className="long-copy-v21">{selected.public_commentary || t("dashboardSubtitle")}</p><div className="objective-card-v21"><small>{t("objective")}</small><p>{selected.monthly_objective || "—"}</p></div></article>
            <article className="panel-v21 padded-v21"><span className="eyebrow">DECISION TIMELINE</span><h2>{t("decisionLog")}</h2><div className="decision-list-v21">{selected.swaps?.length ? selected.swaps.map((swap) => <article key={swap.id}><div><b className="removed-chip">{swap.removed_ticker}</b><span>→</span><b className="added-chip">{swap.added_ticker}</b></div><p>{swap.reason || "—"}</p></article>) : <p className="muted-copy-v21">{t("noChanges")}</p>}</div></article>
          </section>

          <section className="guidance-v21 guidance-v3"><div><span className="eyebrow">INVESTOR GUIDANCE</span><h2>{selected.investor_guidance_title || t("investorGuidance")}</h2><p>{selected.investor_guidance || "—"}</p></div><div className="best-worst-v3"><article><TrendingUp/><span><small>{isArabic ? "أفضل سهم" : "Best performer"}</small><b>{bestHolding?.ticker || "—"}</b><em className="positive">{formatPercent(bestHolding?.mtd)}</em></span></article><article><TrendingDown/><span><small>{isArabic ? "أضعف سهم" : "Worst performer"}</small><b>{worstHolding?.ticker || "—"}</b><em className="negative">{formatPercent(worstHolding?.mtd)}</em></span></article></div></section>

          <div className="portfolio-bottom-author-v32"><AuthorAttribution profile={portfolioAuthor} authorId={currentPortfolio?.created_by} label={isArabic ? "أنشأها ويديرها" : "CREATED & MANAGED BY"}/></div>

          <footer className="report-disclaimer-v21"><ShieldCheck size={14}/>{t("footer")}</footer>
        </main>
      )}
    </div>
  );
}

