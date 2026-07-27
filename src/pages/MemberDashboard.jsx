import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, BriefcaseBusiness, CalendarClock, Download, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import DashboardHeader from "../components/DashboardHeader";
import KpiCard from "../components/KpiCard";
import PerformanceChart from "../components/PerformanceChart";
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

async function loadPublishedData() {
  const [{ data: portfolios, error: portfolioError }, { data: months, error: monthError }] = await Promise.all([
    supabase.from("portfolios").select("*").eq("is_published", true).order("created_at", { ascending: true }),
    supabase.from("strategy_months").select("*, holdings(*), swaps(*), snapshots(*)").eq("is_published", true).order("month_key", { ascending: true }),
  ]);
  if (portfolioError || monthError) throw portfolioError || monthError;
  return { portfolios: portfolios || [], months: months || [] };
}

export default function MemberDashboard() {
  const reportRef = useRef(null);
  const { t, isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [portfolios, setPortfolios] = useState([]);
  const [allMonths, setAllMonths] = useState([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [range, setRange] = useState("ALL");
  const [exporting, setExporting] = useState(false);

  const refresh = async () => {
    try {
      setLoading(true);
      const { portfolios: nextPortfolios, months: nextMonths } = await loadPublishedData();
      setPortfolios(nextPortfolios);
      setAllMonths(nextMonths);
      setSelectedPortfolioId((current) => {
        const portfolioId = nextPortfolios.some((item) => item.id === current) ? current : nextPortfolios[0]?.id || "";
        const portfolioMonths = nextMonths.filter((month) => month.portfolio_id === portfolioId);
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
      .channel("alpha-core-members-v22")
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolios" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "strategy_months" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "holdings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "swaps" }, refresh)
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

  const changePortfolio = (id) => {
    setSelectedPortfolioId(id);
    const nextMonths = allMonths.filter((month) => month.portfolio_id === id);
    setSelectedKey(nextMonths.at(-1)?.month_key || "");
    setRange("ALL");
  };

  const exportPdf = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    setMessage(isArabic ? "جاري تجهيز التقرير…" : "Preparing your report…");
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 1.7,
        backgroundColor: "#0b0f14",
        useCORS: true,
        logging: false,
        windowWidth: 1600,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL("image/jpeg", 0.94);
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.setFillColor(11, 15, 20);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 2) {
        position -= pageHeight;
        pdf.addPage();
        pdf.setFillColor(11, 15, 20);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`ALPHA-CORE-${currentPortfolio?.slug || "PORTFOLIO"}-${selected?.month_key || "REPORT"}-V2.2.pdf`);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="screen-loader"><div className="loader-ring"/><p>{t("loading")}</p></div>;

  return (
    <div className="dashboard-shell">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}

      {!selected ? (
        <div className="empty-state-v21">
          <Activity size={52}/>
          <h1>{t("firstReport")}</h1>
          <p>{t("firstReportText")}</p>
        </div>
      ) : (
        <main ref={reportRef} className="member-report-v21">
          <section className="portfolio-identity-v22" data-html2canvas-ignore="true">
            <div><BriefcaseBusiness size={18}/><span><small>{isArabic ? "المحفظة" : "PORTFOLIO"}</small><b>{isArabic && currentPortfolio?.name_ar ? currentPortfolio.name_ar : currentPortfolio?.name}</b></span></div>
            <select value={currentPortfolio?.id || ""} onChange={(e) => changePortfolio(e.target.value)}>
              {portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{isArabic && portfolio.name_ar ? portfolio.name_ar : portfolio.name}</option>)}
            </select>
          </section>

          <section className="report-hero-v21">
            <div className="report-title-block">
              <span className="eyebrow">{t("dashboardEyebrow")}</span>
              <h1>{monthLabel(selected.month_key, false, locale)}</h1>
              <p>{selected.public_commentary || currentPortfolio?.description || t("dashboardSubtitle")}</p>
              <div className="report-meta-row">
                <span><CalendarClock size={14}/><small>{t("lastUpdated")}</small><b>{dateTimeLabel(selected.updated_at, locale)}</b></span>
                <span><ShieldCheck size={14}/><small>{t("status")}</small><b className={selected.is_closed ? "final-text" : "live-text"}>{selected.is_closed ? t("final") : t("live")}</b></span>
                <span><BriefcaseBusiness size={14}/><small>{isArabic ? "المؤشر" : "Benchmark"}</small><b>{selected.benchmark_ticker || currentPortfolio?.benchmark_ticker || "EGX30CAP"}</b></span>
              </div>
            </div>
            <div className="report-controls-v21" data-html2canvas-ignore="true">
              <select value={selected.month_key} onChange={(e) => setSelectedKey(e.target.value)}>
                {months.map((month) => <option value={month.month_key} key={month.id}>{monthLabel(month.month_key, false, locale)}</option>)}
              </select>
              <button className="button subtle" onClick={refresh}><RefreshCw size={15}/>{t("refresh")}</button>
              <button className="button gold" onClick={exportPdf} disabled={exporting}><Download size={15}/>{exporting ? t("loading") : t("exportPdf")}</button>
            </div>
          </section>

          <section className="kpi-grid-v21">
            <KpiCard title={t("portfolioMtd")} value={formatPercent(selectedReturns.portfolio)} note={isArabic ? "العائد المرجح للشهر" : "Weighted monthly return"} tone={selectedReturns.portfolio >= 0 ? "blue" : "red"} icon={<TrendingUp/>}/>
            <KpiCard title={t("benchmarkMtd")} value={formatPercent(selectedReturns.benchmark)} note={selected.benchmark_ticker || "EGX30CAP"} tone={selectedReturns.benchmark >= 0 ? "gold" : "red"}/>
            <KpiCard title={t("monthlyAlpha")} value={formatPercent(selectedReturns.portfolio - selectedReturns.benchmark)} note={isArabic ? "المحفظة ناقص المؤشر" : "Portfolio less benchmark"} tone={selectedReturns.portfolio - selectedReturns.benchmark >= 0 ? "green" : "red"}/>
            <KpiCard title={t("cumulativePortfolio")} value={formatPercent(latestCumulative.cumulativePortfolio)} note={isArabic ? "منذ إطلاق هذه المحفظة" : "Compounded since this portfolio launched"} tone={Number(latestCumulative.cumulativePortfolio || 0) >= 0 ? "blue" : "red"}/>
            <KpiCard title={t("cumulativeBenchmark")} value={formatPercent(latestCumulative.cumulativeBenchmark)} note={isArabic ? "منذ إطلاق هذه المحفظة" : "Compounded since this portfolio launched"} tone={Number(latestCumulative.cumulativeBenchmark || 0) >= 0 ? "gold" : "red"}/>
            <KpiCard title={t("cumulativeAlpha")} value={formatPercent(latestCumulative.cumulativeAlpha)} note={isArabic ? "المحفظة ناقص المؤشر منذ الإطلاق" : "Portfolio less benchmark since launch"} tone={Number(latestCumulative.cumulativeAlpha || 0) >= 0 ? "green" : "red"}/>
          </section>

          <section className="dashboard-primary-grid">
            <article className="panel-v21 chart-panel-v21">
              <div className="panel-heading-v21">
                <div><span className="eyebrow">PERFORMANCE</span><h2>{t("performanceOverview")}</h2><p>{t("performanceOverviewText")}</p></div>
                <div className="range-switch" data-html2canvas-ignore="true">
                  {["3M", "6M", "1Y", "ALL"].map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item === "ALL" ? t("all") : item === "3M" ? t("threeMonths") : item === "6M" ? t("sixMonths") : t("oneYear")}</button>)}
                </div>
              </div>
              <PerformanceChart data={chartData}/>
            </article>

            <article className="panel-v21 updates-panel-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">HISTORY</span><h2>{t("recentUpdates")}</h2><p>{t("recentUpdatesText")}</p></div></div>
              <div className="recent-update-list">
                {recentUpdates.map((row) => (
                  <button key={row.month} onClick={() => setSelectedKey(row.month)} className={row.month === selected.month_key ? "active" : ""}>
                    <span><b>{monthLabel(row.month, true, locale)}</b><small>{row.isClosed ? t("final") : t("live")}</small></span>
                    <strong className={row.alpha >= 0 ? "positive" : "negative"}>{formatPercent(row.alpha)}</strong>
                  </button>
                ))}
              </div>
            </article>
          </section>

          <section className="portfolio-section-v21 panel-v21">
            <div className="panel-heading-v21">
              <div><span className="eyebrow">PORTFOLIO</span><h2>{t("officialPortfolio")}</h2><p>{t("officialPortfolioText")}</p></div>
              <span className={`status-pill ${selected.is_closed ? "final" : "live"}`}>{selected.is_closed ? t("final") : t("live")}</span>
            </div>
            <div className="table-scroll">
              <table className="data-table-v21">
                <thead><tr><th>{t("ticker")}</th><th>{t("weight")}</th><th>{t("open")}</th><th>{t("latest")}</th><th>{t("return")}</th><th>{t("contribution")}</th></tr></thead>
                <tbody>
                  {metrics.rows.map((row) => (
                    <tr key={row.id || row.ticker}>
                      <td><b className="ticker-chip">{row.ticker}</b></td>
                      <td>{formatNumber(row.weight, 2, locale)}%</td>
                      <td>{formatNumber(row.open_price, 2, locale)}</td>
                      <td>{formatNumber(row.close_price, 2, locale)}</td>
                      <td className={row.mtd >= 0 ? "positive" : "negative"}><b>{formatPercent(row.mtd)}</b></td>
                      <td className={row.contribution >= 0 ? "positive" : "negative"}><b>{formatPercent(row.contribution)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="track-record-v21 panel-v21">
            <div className="panel-heading-v21"><div><span className="eyebrow">TRACK RECORD</span><h2>{t("trackRecord")}</h2><p>{t("trackRecordText")}</p></div></div>
            <div className="table-scroll">
              <table className="data-table-v21 compact-table">
                <thead><tr><th>{t("month")}</th><th>{t("status")}</th><th>{t("portfolio")}</th><th>{t("benchmark")}</th><th>{t("alpha")}</th><th>{t("cumulativePortfolio")}</th><th>{t("cumulativeBenchmark")}</th><th>{t("cumulativeAlpha")}</th></tr></thead>
                <tbody>
                  {[...trackRecord].reverse().map((row) => (
                    <tr key={row.month}>
                      <td><button className="month-link-v21" onClick={() => setSelectedKey(row.month)}>{monthLabel(row.month, false, locale)}</button></td>
                      <td><span className={`status-pill small ${row.isClosed ? "final" : "live"}`}>{row.isClosed ? t("final") : t("live")}</span></td>
                      <td className={row.portfolio >= 0 ? "positive" : "negative"}>{formatPercent(row.portfolio)}</td>
                      <td className={row.benchmark >= 0 ? "gold-text" : "negative"}>{formatPercent(row.benchmark)}</td>
                      <td className={row.alpha >= 0 ? "positive" : "negative"}><b>{formatPercent(row.alpha)}</b></td>
                      <td>{formatPercent(row.cumulativePortfolio)}</td>
                      <td>{formatPercent(row.cumulativeBenchmark)}</td>
                      <td className={row.cumulativeAlpha >= 0 ? "positive" : "negative"}><b>{formatPercent(row.cumulativeAlpha)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="dashboard-detail-grid">
            <article className="panel-v21 padded-v21">
              <span className="eyebrow">UPDATE</span>
              <h2>{selected.update_title || `${monthLabel(selected.month_key, false, locale)} — ${t("monthlyUpdate")}`}</h2>
              <p className="long-copy-v21">{selected.public_commentary || t("dashboardSubtitle")}</p>
              <div className="objective-card-v21"><small>{t("objective")}</small><p>{selected.monthly_objective || "—"}</p></div>
            </article>
            <article className="panel-v21 padded-v21">
              <span className="eyebrow">DECISIONS</span>
              <h2>{t("decisionLog")}</h2>
              <div className="decision-list-v21">
                {selected.swaps?.length ? selected.swaps.map((swap) => (
                  <article key={swap.id}>
                    <div><b className="removed-chip">{swap.removed_ticker}</b><span>→</span><b className="added-chip">{swap.added_ticker}</b></div>
                    <p>{swap.reason || "—"}</p>
                  </article>
                )) : <p className="muted-copy-v21">{t("noChanges")}</p>}
              </div>
            </article>
          </section>

          <section className="guidance-v21">
            <div><span className="eyebrow">GUIDANCE</span><h2>{selected.investor_guidance_title || t("investorGuidance")}</h2><p>{selected.investor_guidance || "—"}</p></div>
            <div className="allocation-grid-v21">
              {metrics.rows.map((row) => <div key={row.id || row.ticker}><b>{row.ticker}</b><span>{formatNumber(row.weight, 2, locale)}%</span></div>)}
            </div>
          </section>

          <footer className="report-disclaimer-v21">{t("footer")}</footer>
        </main>
      )}
    </div>
  );
}
