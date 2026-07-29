import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarRange, Clock3, FileText, Newspaper, Search, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import AuthorAttribution from "../components/AuthorAttribution";
import DashboardHeader from "../components/DashboardHeader";
import InsightDrawer from "../components/InsightDrawer";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";
import { dateTimeLabel } from "../lib/calculations";

export default function WeeklyReports() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [reports, setReports] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [reportResult, profileResult] = await Promise.all([
        supabase.from("weekly_reports").select("*").eq("is_published", true).order("week_end", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);
      if (reportResult.error) setMessage(reportResult.error.message);
      setReports((reportResult.data || []).filter((item) => !String(item.slug || "").startsWith("market-news-") && !String(item.slug || "").startsWith("economic-update-")));
      setProfiles(Object.fromEntries((profileResult.data || []).map((row) => [row.id, row])));
      setLoading(false);
    };
    load();
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) => !normalized || `${report.title} ${report.summary} ${report.market_overview || ""}`.toLowerCase().includes(normalized));
  }, [reports, query]);
  const featured = visible[0] || reports[0] || null;
  const reportSummary = isArabic
    ? `تحتوي مكتبة التقارير الأسبوعية على ${reports.length} تقرير منشور. أحدث تقرير هو ${featured?.title || "—"} ويغطي الفترة من ${featured?.week_start || "—"} إلى ${featured?.week_end || "—"}.`
    : `The weekly intelligence library contains ${reports.length} published reports. The latest is “${featured?.title || "—"}”, covering ${featured?.week_start || "—"} to ${featured?.week_end || "—"}.`;

  return (
    <div className="dashboard-shell weekly-shell-v23 weekly-shell-v3">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="weekly-page-v23 weekly-page-v3">
        <section className="weekly-hero-v3"><div><span className="eyebrow">ALPHA WEEKLY · MARKET INTELLIGENCE</span><h1>{isArabic ? "السوق في سبعة أيام" : "The market, distilled into seven days"}</h1><p>{isArabic ? "تقرير مؤسسي مختصر يربط حركة السوق بأداء المحافظ والذهب وما نراقبه في الأسبوع التالي." : "A concise institutional report connecting market moves, portfolio performance, gold and the signals we are watching next."}</p><div><InsightDrawer label={isArabic ? "لخّص التقارير" : "Summarise reports"} title={isArabic ? "ملخص مكتبة التقارير" : "Weekly report library brief"} summary={reportSummary}/><span><Clock3 size={15}/>{isArabic ? "تحديث أسبوعي" : "Updated weekly"}</span></div></div><div className="weekly-hero-orbit-v3"><Newspaper/><b>{reports.length}</b><span>{isArabic ? "تقرير منشور" : "PUBLISHED REPORTS"}</span></div></section>

        {featured && <section className="featured-weekly-v3"><div className="featured-week-number-v3"><span>{isArabic ? "الأسبوع" : "WEEK"}</span><b>{getWeekNumber(featured.week_end)}</b><small>{new Date(`${featured.week_end}T12:00:00`).getFullYear()}</small></div><div className="featured-week-copy-v3"><span className="eyebrow">LATEST REPORT</span><h2>{featured.title}</h2><p>{featured.summary}</p><div><span><CalendarRange size={15}/>{new Date(`${featured.week_start}T12:00:00`).toLocaleDateString(locale)} — {new Date(`${featured.week_end}T12:00:00`).toLocaleDateString(locale)}</span><span><Clock3 size={15}/>{dateTimeLabel(featured.updated_at || featured.published_at, locale)}</span></div><AuthorAttribution profile={profiles[featured.created_by]} authorId={featured.created_by} compact/><Link className="button gold" to={`/weekly-reports/${featured.slug}`}>{isArabic ? "قراءة أحدث تقرير" : "Read latest report"}<ArrowUpRight size={15}/></Link></div><div className="featured-week-art-v3"><TrendingUp/><span>MARKET</span><span>PORTFOLIOS</span><span>GOLD</span><span>OUTLOOK</span></div></section>}

        <section className="weekly-library-head-v3"><div><span className="eyebrow">REPORT ARCHIVE</span><h2>{isArabic ? "الخط الزمني للتقارير" : "Weekly intelligence timeline"}</h2></div><label><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "ابحث داخل التقارير" : "Search reports"}/></label></section>

        {loading ? <div className="loading-screen"><div className="loader-ring"/></div> : (
          <section className="weekly-timeline-v3">
            {visible.map((report, index) => <article key={report.id}><div className="weekly-timeline-rail-v3"><span/><b>{getWeekNumber(report.week_end)}</b><i/></div><Link className="weekly-card-v23 weekly-card-v3" to={`/weekly-reports/${report.slug}`}><header><span className="eyebrow">WEEK {getWeekNumber(report.week_end)}</span><em>{index === 0 ? (isArabic ? "الأحدث" : "LATEST") : "REPORT"}</em></header><h2>{report.title}</h2><p>{report.summary}</p><div className="weekly-card-sections-v3"><span><FileText size={14}/> Market recap</span><span><TrendingUp size={14}/> Portfolio update</span><span><Sparkles size={14}/> Outlook</span></div><footer className="weekly-card-author-footer-v32"><AuthorAttribution profile={profiles[report.created_by]} authorId={report.created_by} compact/><b>{isArabic ? "فتح التقرير" : "Open report"}<ArrowUpRight size={15}/></b></footer></Link></article>)}
            {!visible.length && <div className="empty-state-v21"><Search size={44}/><h2>{isArabic ? "لا توجد تقارير مطابقة" : "No matching reports"}</h2></div>}
          </section>
        )}
      </main>
    </div>
  );
}

function getWeekNumber(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  const first = new Date(date.getFullYear(), 0, 1);
  return String(Math.ceil((((date - first) / 86400000) + first.getDay() + 1) / 7)).padStart(2, "0");
}
