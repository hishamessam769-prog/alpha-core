import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarClock, Clock3, Filter, LineChart, Newspaper, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import AuthorAttribution from "../components/AuthorAttribution";
import DashboardHeader from "../components/DashboardHeader";
import MarketGraphic from "../components/MarketGraphic";
import Reveal from "../components/Reveal";
import { useLanguage } from "../context/LanguageContext";
import { buildNewsItems, mapProfiles, splitEventLines } from "../lib/content";
import { dateTimeLabel } from "../lib/calculations";
import { supabase } from "../lib/supabase";

async function loadNews() {
  const [reportResult, recommendationResult, updateResult, profileResult] = await Promise.all([
    supabase.from("weekly_reports").select("*").eq("is_published", true).order("week_end", { ascending: false }),
    supabase.from("recommendations").select("*").eq("is_published", true).order("recommendation_date", { ascending: false }),
    supabase.from("recommendation_updates").select("*").order("update_date", { ascending: false }).limit(100),
    supabase.from("profiles").select("*"),
  ]);
  const error = reportResult.error || recommendationResult.error || updateResult.error;
  if (error) throw error;
  return {
    reports: reportResult.data || [],
    recommendations: recommendationResult.data || [],
    updates: updateResult.data || [],
    profiles: profileResult.data || [],
  };
}

export default function NewsAnalysis() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [data, setData] = useState({ reports: [], recommendations: [], updates: [], profiles: [] });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadNews().then(setData).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  const profileMap = useMemo(() => mapProfiles(data.profiles), [data.profiles]);
  const items = useMemo(() => buildNewsItems(data), [data]);
  const featured = items[0] || null;
  const events = useMemo(() => data.reports.flatMap((report) => splitEventLines(report.watch_next).map((title) => ({ title, date: report.week_end, report }))).slice(0, 6), [data.reports]);
  const visible = items.filter((item) => {
    const matchesFilter = filter === "all" || item.kind === filter || (filter === "recommendation" && item.kind === "recommendation");
    const needle = query.trim().toLowerCase();
    return matchesFilter && (!needle || `${item.title} ${item.summary} ${item.category} ${item.ticker || ""} ${item.content || ""}`.toLowerCase().includes(needle));
  });

  return (
    <div className="dashboard-shell news-shell-v32">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="news-page-v32">
        <Reveal as="section" className="news-hero-v32">
          <div>
            <span className="eyebrow">ALPHA NEWSROOM · MARKET INTELLIGENCE</span>
            <h1>{isArabic ? "الأخبار والتحليل في سياق استثماري واحد" : "Market news and analysis, placed in investment context"}</h1>
            <p>{isArabic ? "مركز موحد يجمع التقارير الأسبوعية وتحديثات الشركات والأبحاث المنشورة بدون تغيير أي مصدر بيانات قائم." : "A unified intelligence desk combining weekly reports, company updates and published research without changing any existing data source."}</p>
            <div className="news-hero-metrics-v32"><span><Newspaper/><b>{items.length}</b><small>{isArabic ? "مادة منشورة" : "published items"}</small></span><span><CalendarClock/><b>{events.length}</b><small>{isArabic ? "أحداث تحت المراقبة" : "events to watch"}</small></span><span><Sparkles/><b>24/7</b><small>{isArabic ? "سجل تحليلي" : "intelligence record"}</small></span></div>
          </div>
          <MarketGraphic label="MARKET INTELLIGENCE" />
        </Reveal>

        {featured && <Reveal as="section" className="news-featured-v32" delay={60}>
          <div className={`news-featured-art-v32 ${featured.accent}`}><span>{featured.category}</span><b>{featured.ticker || "ALPHA"}</b><LineChart/></div>
          <div className="news-featured-copy-v32"><span className="eyebrow">FEATURED INTELLIGENCE</span><h2>{featured.title}</h2><p>{featured.summary}</p><div className="article-meta-v32"><span><Clock3/>{featured.readTime} min read</span><span>{dateTimeLabel(featured.publishedAt, locale)}</span></div><AuthorAttribution profile={profileMap[featured.authorId]} authorId={featured.authorId} compact/><Link className="button gold" to={featured.route}>{isArabic ? "قراءة التحليل" : "Read analysis"}<ArrowUpRight size={16}/></Link></div>
        </Reveal>}

        <Reveal as="section" className="economic-events-v32" delay={90}>
          <div className="section-heading-inline-v32"><div><span className="eyebrow">ECONOMIC & MARKET EVENTS</span><h2>{isArabic ? "ما نراقبه الآن" : "What the desk is watching"}</h2></div><Link to="/weekly-reports">{isArabic ? "كل التقارير" : "All reports"}<ArrowUpRight size={15}/></Link></div>
          <div className="event-ticker-v32">
            {(events.length ? events : [{ title: isArabic ? "أضف نقاط الأسبوع القادم داخل آخر تقرير أسبوعي لتظهر هنا تلقائيًا" : "Add watch-next items to the latest weekly report and they will appear here automatically", date: new Date().toISOString().slice(0,10) }]).map((event, index) => <article key={`${event.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{event.date ? new Date(`${event.date}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "WATCH"}</small><b>{event.title}</b></div><CalendarClock/></article>)}
          </div>
        </Reveal>

        <Reveal as="section" className="news-toolbar-v32" delay={100}>
          <div><span className="eyebrow">NEWS INDEX</span><h2>{isArabic ? "آخر الأخبار والأبحاث" : "Latest news and analysis"}</h2></div>
          <div className="news-controls-v32"><label><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "ابحث في الأخبار والشركات" : "Search news, companies or tickers"}/></label><div><Filter/>{[["all", isArabic ? "الكل" : "All"],["report", isArabic ? "تقارير" : "Reports"],["update", isArabic ? "تحديثات" : "Updates"],["recommendation", isArabic ? "توصيات الأسهم" : "Stock Recommendations"]].map(([value,label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
        </Reveal>

        {loading ? <div className="news-grid-v32">{[0,1,2,3,4,5].map((item) => <div key={item} className="news-card-v32 skeleton-card-v32"/>)}</div> : <section className="news-grid-v32">
          {visible.map((item, index) => <Reveal as="article" className={`news-card-v32 ${index === 0 ? "lead" : ""}`} delay={Math.min(index * 55, 260)} key={`${item.kind}-${item.id}`}>
            <Link to={item.route} className={`news-card-visual-v32 ${item.accent}`}><span>{item.category}</span><b>{item.ticker || (item.kind === "report" ? "WEEKLY" : "ALPHA")}</b><LineChart/></Link>
            <div className="news-card-content-v32"><div className="article-meta-v32"><span><Clock3/>{item.readTime} min</span><span>{dateTimeLabel(item.publishedAt, locale)}</span></div><h3><Link to={item.route}>{item.title}</Link></h3><p>{item.summary}</p><footer><AuthorAttribution profile={profileMap[item.authorId]} authorId={item.authorId} compact/><Link to={item.route}>{isArabic ? "فتح" : "Open"}<ArrowUpRight size={15}/></Link></footer></div>
          </Reveal>)}
          {!visible.length && <div className="empty-state-v21"><Search size={44}/><h2>{isArabic ? "لا توجد نتائج مطابقة" : "No matching intelligence"}</h2></div>}
        </section>}
      </main>
    </div>
  );
}
