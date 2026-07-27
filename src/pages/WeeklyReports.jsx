import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarRange, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

export default function WeeklyReports() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("is_published", true)
        .order("week_end", { ascending: false });
      if (error) setMessage(error.message);
      setReports(data || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="dashboard-shell weekly-shell-v23">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="weekly-page-v23">
        <section className="weekly-hero-v23">
          <div>
            <span className="eyebrow">ALPHA CORE WEEKLY</span>
            <h1>{isArabic ? "التقارير الأسبوعية" : "Weekly reports"}</h1>
            <p>{isArabic ? "مراجعة مركزة لما حدث في السوق والمحافظ والذهب وما نراقبه في الأسبوع التالي." : "A focused review of the market, portfolios, gold and what we are watching next week."}</p>
          </div>
          <div className="research-hero-badge"><Newspaper/><span>{isArabic ? "سوق + محافظ + رؤية" : "Market + portfolios + outlook"}</span></div>
        </section>

        {loading ? <div className="loading-screen"><div className="loader-ring"/></div> : (
          <section className="weekly-grid-v23">
            {reports.map((report) => (
              <Link className="weekly-card-v23" to={`/weekly-reports/${report.slug}`} key={report.id}>
                <div className="weekly-card-date-v23"><CalendarRange size={16}/><span>{new Date(`${report.week_start}T12:00:00`).toLocaleDateString(locale)} — {new Date(`${report.week_end}T12:00:00`).toLocaleDateString(locale)}</span></div>
                <span className="eyebrow">{isArabic ? "تقرير أسبوعي" : "WEEKLY REPORT"}</span>
                <h2>{report.title}</h2>
                <p>{report.summary}</p>
                <footer><span>{isArabic ? "منشور" : "Published"} {report.published_at ? new Date(report.published_at).toLocaleDateString(locale) : ""}</span><b>{isArabic ? "قراءة التقرير" : "Read report"}<ArrowUpRight size={15}/></b></footer>
              </Link>
            ))}
            {!reports.length && <div className="empty-state-v21"><Newspaper size={44}/><h2>{isArabic ? "أول تقرير أسبوعي قيد الإعداد" : "The first weekly report is being prepared"}</h2></div>}
          </section>
        )}
      </main>
    </div>
  );
}
