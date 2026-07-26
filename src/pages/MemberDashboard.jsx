import { useEffect, useMemo, useRef, useState } from "react";
import { Download, LogOut, RefreshCw } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Link } from "react-router-dom";
import Brand from "../components/Brand";
import KpiCard from "../components/KpiCard";
import PerformanceChart from "../components/PerformanceChart";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  buildMonthlyTrackRecord,
  buildPerformanceSeries,
  calculateMonth,
  formatNumber,
  formatPercent,
  monthLabel,
} from "../lib/calculations";

async function loadPublishedMonths() {
  const { data, error } = await supabase
    .from("strategy_months")
    .select("*, holdings(*), swaps(*), snapshots(*)")
    .eq("is_published", true)
    .order("month_key", { ascending: true });
  if (error) throw error;
  return data || [];
}

export default function MemberDashboard() {
  const reportRef = useRef(null);
  const { profile, signOut } = useAuth();
  const [months, setMonths] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await loadPublishedMonths();
      setMonths(data);
      setSelectedKey((current) => current || data.at(-1)?.month_key || "");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("alpha-core-members")
      .on("postgres_changes", { event: "*", schema: "public", table: "strategy_months" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "holdings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "swaps" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "snapshots" }, refresh)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const selected = months.find((month) => month.month_key === selectedKey) || months.at(-1);
  const metrics = calculateMonth(selected);
  const trackRecord = useMemo(() => buildMonthlyTrackRecord(months), [months]);
  const chartData = useMemo(() => buildPerformanceSeries(months), [months]);
  const latestCumulative = trackRecord.at(-1) || {};

  const exportPdf = async () => {
    if (!reportRef.current) return;
    setMessage("Preparing your report…");
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#0F1115",
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, pageWidth, Math.min(imageHeight, pageHeight));
      pdf.save(`ALPHA-CORE-${selected?.month_key || "REPORT"}.pdf`);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (loading) return <div className="screen-loader">Loading your dashboard…</div>;

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <Brand to="/dashboard" />
        <nav>
          <Link to="/methodology">Methodology</Link>
          <span className="member-name">{profile?.full_name || profile?.email}</span>
          <button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={17}/></button>
        </nav>
      </header>

      {message && <div className="notice-bar">{message}</div>}

      {!selected ? (
        <div className="empty-state">
          <h1>The first report is being prepared.</h1>
          <p>You will see the live launch month as soon as the administrator publishes it.</p>
        </div>
      ) : (
        <main ref={reportRef} className="member-report">
          <section className="report-header">
            <div>
              <span className="eyebrow">MEMBER PERFORMANCE TERMINAL</span>
              <h1>{monthLabel(selected.month_key)}</h1>
              <p>{selected.public_commentary || "Live portfolio performance versus EGX30 Capped."}</p>
            </div>
            <div className="report-controls">
              <select value={selected.month_key} onChange={(e) => setSelectedKey(e.target.value)}>
                {months.map((month) => (
                  <option value={month.month_key} key={month.id}>{monthLabel(month.month_key)}</option>
                ))}
              </select>
              <button className="button subtle" onClick={refresh}><RefreshCw size={15}/> Refresh</button>
              <button className="button gold" onClick={exportPdf}><Download size={15}/> Export PDF</button>
            </div>
          </section>

          <section className="kpi-grid">
            <KpiCard title="Portfolio MTD" value={formatPercent(metrics.portfolioReturn)} note="Weighted strategy return" tone="blue"/>
            <KpiCard title="EGX30 Capped MTD" value={formatPercent(metrics.benchmarkReturn)} note="Official benchmark" tone="gold"/>
            <KpiCard title="Monthly Alpha" value={formatPercent(metrics.alpha)} note="Portfolio less benchmark" tone={metrics.alpha >= 0 ? "green" : "red"}/>
            <KpiCard title="Cumulative Alpha" value={formatPercent(latestCumulative.cumulativeAlpha)} note="Compounded since launch" tone={Number(latestCumulative.cumulativeAlpha || 0) >= 0 ? "green" : "red"}/>
          </section>

          <section className="member-main-grid">
            <div className="panel">
              <div className="panel-heading">
                <div><h2>Official Portfolio</h2><p>Published positions and their contribution to return.</p></div>
                <span className={`status-badge ${selected.is_closed ? "final" : "live"}`}>{selected.is_closed ? "FINAL MONTH" : "LIVE MTD"}</span>
              </div>

              <div className="table-scroll">
                <table>
                  <thead><tr><th>Ticker</th><th>Weight</th><th>Open</th><th>Latest</th><th>Return</th><th>Contribution</th></tr></thead>
                  <tbody>
                    {metrics.rows.map((row) => (
                      <tr key={row.id}>
                        <td><b>{row.ticker}</b></td>
                        <td>{formatNumber(row.weight)}%</td>
                        <td>{formatNumber(row.open_price)}</td>
                        <td>{formatNumber(row.close_price)}</td>
                        <td className={row.mtd >= 0 ? "blue-text" : "red-text"}><b>{formatPercent(row.mtd)}</b></td>
                        <td className={row.contribution >= 0 ? "green-text" : "red-text"}><b>{formatPercent(row.contribution)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel chart-panel">
              <div className="panel-heading"><div><h2>Cumulative Performance</h2><p>Portfolio, benchmark and resulting Alpha.</p></div></div>
              <PerformanceChart data={chartData}/>
            </div>
          </section>

          <section className="panel track-record-panel">
            <div className="panel-heading"><div><h2>Transparent Track Record</h2><p>Every published month remains in permanent history.</p></div></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Month</th><th>Status</th><th>Portfolio</th><th>Benchmark</th><th>Alpha</th><th>Cum. Portfolio</th><th>Cum. Benchmark</th><th>Cum. Alpha</th></tr></thead>
                <tbody>
                  {[...trackRecord].reverse().map((row) => (
                    <tr key={row.month}>
                      <td><button className="month-button" onClick={() => setSelectedKey(row.month)}>{monthLabel(row.month)}</button></td>
                      <td><span className={`status-badge ${row.isClosed ? "final" : "live"}`}>{row.isClosed ? "Final" : "Live"}</span></td>
                      <td className={row.portfolio >= 0 ? "blue-text" : "red-text"}>{formatPercent(row.portfolio)}</td>
                      <td className="gold-text">{formatPercent(row.benchmark)}</td>
                      <td className={row.alpha >= 0 ? "green-text" : "red-text"}><b>{formatPercent(row.alpha)}</b></td>
                      <td>{formatPercent(row.cumulativePortfolio)}</td>
                      <td>{formatPercent(row.cumulativeBenchmark)}</td>
                      <td className={row.cumulativeAlpha >= 0 ? "green-text" : "red-text"}>{formatPercent(row.cumulativeAlpha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="member-bottom-grid">
            <div className="panel padded">
              <span className="eyebrow">MONTHLY UPDATE</span>
              <h2>{selected.update_title || `${monthLabel(selected.month_key)} Strategy Update`}</h2>
              <p className="long-copy">{selected.public_commentary || "The administrator will publish the monthly commentary with the next update."}</p>
              <div className="objective-box">
                <small>MONTHLY OBJECTIVE</small>
                <p>{selected.monthly_objective || "Outperform EGX30 Capped through disciplined stock selection."}</p>
              </div>
            </div>

            <div className="panel padded">
              <span className="eyebrow">DECISION LOG</span>
              <h2>What changed and why</h2>
              <div className="decision-list">
                {selected.swaps?.length ? selected.swaps.map((swap) => (
                  <article className="decision-card" key={swap.id}>
                    <div><b className="removed">{swap.removed_ticker}</b><span>→</span><b className="added">{swap.added_ticker}</b></div>
                    <p>{swap.reason || "Monthly portfolio rebalance."}</p>
                  </article>
                )) : <p className="muted-copy">No stock changes were recorded for this month.</p>}
              </div>
            </div>
          </section>

          <section className="guidance-panel">
            <div>
              <span className="eyebrow">CURRENT INVESTOR GUIDANCE</span>
              <h2>{selected.investor_guidance_title || "Published Target Allocation"}</h2>
              <p>{selected.investor_guidance || "Existing investors should rebalance to the published target weights. New investors should allocate according to the current portfolio."}</p>
            </div>
            <div className="allocation-grid">
              {metrics.rows.map((row) => <div key={row.id}><b>{row.ticker}</b><span>{formatNumber(row.weight)}%</span></div>)}
            </div>
          </section>

          <footer className="report-disclaimer">
            ALPHA CORE performance is presented for transparency and educational purposes. It is not personalised investment advice.
          </footer>
        </main>
      )}
    </div>
  );
}
