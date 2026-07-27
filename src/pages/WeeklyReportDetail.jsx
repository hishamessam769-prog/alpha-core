import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, CalendarRange, Coins, Eye, Layers3 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";
import { dateTimeLabel } from "../lib/calculations";

export default function WeeklyReportDetail() {
  const { slug } = useParams();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("weekly_reports").select("*").eq("slug", slug).single();
      if (error) setMessage(error.message);
      setReport(data || null);
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) return <div className="dashboard-shell"><DashboardHeader/><div className="loading-screen"><div className="loader-ring"/></div></div>;
  if (!report) return <div className="dashboard-shell"><DashboardHeader/><div className="empty-state-v21"><h1>{isArabic ? "التقرير غير موجود" : "Report not found"}</h1><Link className="button gold" to="/weekly-reports">{isArabic ? "العودة للتقارير" : "Back to reports"}</Link></div></div>;

  return (
    <div className="dashboard-shell weekly-detail-shell-v23">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="weekly-detail-v23">
        <Link className="back-link" to="/weekly-reports"><BackIcon size={15}/>{isArabic ? "العودة لكل التقارير" : "Back to all reports"}</Link>
        <header className="weekly-detail-header-v23">
          <span className="eyebrow">ALPHA CORE WEEKLY REPORT</span>
          <h1>{report.title}</h1>
          <p>{report.summary}</p>
          <div><CalendarRange size={16}/><span>{new Date(`${report.week_start}T12:00:00`).toLocaleDateString(locale)} — {new Date(`${report.week_end}T12:00:00`).toLocaleDateString(locale)}</span><span>· {isArabic ? "آخر تحديث" : "Last updated"}: {dateTimeLabel(report.updated_at || report.published_at, locale)}</span></div>
        </header>

        <section className="weekly-sections-v23">
          <ReportSection icon={<BarChart3/>} eyebrow="MARKET" title={isArabic ? "ما حدث في السوق" : "What happened in the market"} body={report.market_overview}/>
          <ReportSection icon={<Layers3/>} eyebrow="PORTFOLIOS" title={isArabic ? "تحديث المحافظ" : "Portfolio update"} body={report.portfolio_update}/>
          <ReportSection icon={<Coins/>} eyebrow="GOLD" title={isArabic ? "الذهب والأصول البديلة" : "Gold and alternative assets"} body={report.gold_update}/>
          <ReportSection icon={<Eye/>} eyebrow="NEXT WEEK" title={isArabic ? "ما نراقبه الأسبوع القادم" : "What we are watching next"} body={report.watch_next}/>
        </section>

        <footer className="report-disclaimer-v21">{isArabic ? "هذا التقرير لأغراض تعليمية ومعلوماتية عامة ولا يمثل نصيحة استثمارية شخصية." : "This report is for general educational and informational purposes and is not personalised investment advice."}</footer>
      </main>
    </div>
  );
}

function ReportSection({ icon, eyebrow, title, body }) {
  return <article className="panel-v21 padded-v21 weekly-section-v23"><span className="eyebrow">{eyebrow}</span><h2>{icon}{title}</h2><p>{body || "—"}</p></article>;
}
