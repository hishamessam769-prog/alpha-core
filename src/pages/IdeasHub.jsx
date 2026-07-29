import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BadgeCheck, Clock3, Crosshair, Filter, Gauge, PauseCircle, Search, SlidersHorizontal, Sparkles, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import AuthorAttribution from "../components/AuthorAttribution";
import CompanyMark from "../components/CompanyMark";
import DashboardHeader from "../components/DashboardHeader";
import InsightDrawer from "../components/InsightDrawer";
import KpiCard from "../components/KpiCard";
import { useLanguage } from "../context/LanguageContext";
import { dateTimeLabel, formatNumber, formatPercent } from "../lib/calculations";
import { recommendationActionLabel, recommendationMetrics, recommendationStatusLabel, recommendationSummary } from "../lib/recommendations";
import { supabase } from "../lib/supabase";

export default function IdeasHub() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [recommendations, setRecommendations] = useState([]);
  const [prices, setPrices] = useState({});
  const [profiles, setProfiles] = useState({});
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("latest");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: recs, error: recError }, { data: priceRows, error: priceError }, profileResult] = await Promise.all([
      supabase.from("recommendations").select("*").eq("is_published", true).order("recommendation_date", { ascending: false }),
      supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
      supabase.from("profiles").select("*"),
    ]);
    if (recError || priceError) setMessage(recError?.message || priceError?.message || "");
    setRecommendations(recs || []);
    setPrices(Object.fromEntries((priceRows || []).map((row) => [String(row.ticker).toUpperCase(), row])));
    setProfiles(Object.fromEntries((profileResult.data || []).map((row) => [row.id, row])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => recommendationSummary(recommendations, prices), [recommendations, prices]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = recommendations.filter((item) => {
      const matchesFilter = filter === "all" || (filter === "closed" ? !["open", "draft"].includes(item.status) : item.status === "open" && (item.action_status || "invest") === filter);
      const matchesQuery = !normalized || `${item.ticker} ${item.company_name} ${item.title} ${item.sector || ""}`.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
    return [...filtered].sort((a, b) => {
      const aMetrics = recommendationMetrics(a, prices);
      const bMetrics = recommendationMetrics(b, prices);
      if (sort === "upside") return bMetrics.upsideToTarget - aMetrics.upsideToTarget;
      if (sort === "return") return bMetrics.returnPct - aMetrics.returnPct;
      if (sort === "alpha") return bMetrics.alpha - aMetrics.alpha;
      return String(b.recommendation_date || "").localeCompare(String(a.recommendation_date || ""));
    });
  }, [recommendations, prices, filter, query, sort]);

  const featured = visible[0] || recommendations[0] || null;
  const featuredMetrics = featured ? recommendationMetrics(featured, prices) : null;
  const librarySummary = isArabic
    ? `تضم مكتبة التوصيات ${recommendations.length} توصية منشورة، منها ${summary.open} مفتوحة و${summary.closed} مغلقة. توجد ${summary.invest} توصية مناسبة للدخول حاليًا و${summary.hold} في حالة احتفاظ أو انتظار. نسبة النجاح للتوصيات المغلقة ${formatPercent(summary.successRate)} ومتوسط العائد المغلق ${formatPercent(summary.averageClosedReturn)}.`
    : `The recommendation library contains ${recommendations.length} published ideas, including ${summary.open} open and ${summary.closed} closed calls. ${summary.invest} are currently rated Invest and ${summary.hold} are rated Hold or Wait. The closed-call success rate is ${formatPercent(summary.successRate)}, with an average closed return of ${formatPercent(summary.averageClosedReturn)}.`;

  return (
    <div className="dashboard-shell research-shell-v22 research-shell-v3">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}

      <main className="research-page-v22 research-page-v3">
        <section className="research-magazine-hero-v3">
          <div className="research-hero-copy-v3"><span className="eyebrow">ALPHA STOCK RECOMMENDATIONS · DECISION INTELLIGENCE</span><h1>{isArabic ? "توصيات أسهم تقود إلى قرار واضح" : "Stock recommendations with a clear decision and track record"}</h1><p>{isArabic ? "كل توصية تعرض السعر والفرضية والتقييم والمحفزات والمخاطر والأداء مقابل المؤشر في صفحة واحدة واضحة." : "Every stock call brings price, thesis, valuation, catalysts, risks and benchmark-relative performance into one decision page."}</p><div className="research-hero-actions-v3"><InsightDrawer label={isArabic ? "ملخص المكتبة" : "Summarise the library"} title={isArabic ? "ملخص التوصيات" : "Recommendation library brief"} summary={librarySummary}/><span><BadgeCheck size={16}/>{isArabic ? "سجل زمني غير قابل للمحو" : "Permanent dated record"}</span></div></div>
          <div className="research-hero-art-v3"><div className="research-ring-v3"><Sparkles/><b>{summary.open}</b><span>{isArabic ? "توصية مفتوحة" : "OPEN CALLS"}</span></div><div className="research-mini-stats-v3"><span><small>SUCCESS RATE</small><b>{formatPercent(summary.successRate)}</b></span><span><small>AVG. RETURN</small><b>{formatPercent(summary.averageClosedReturn)}</b></span></div></div>
        </section>

        <section className="kpi-grid-v21 research-kpis-v22 research-kpis-v3">
          <KpiCard title={isArabic ? "استثمر الآن" : "Invest now"} value={String(summary.invest)} note={isArabic ? "مفتوحة ومناسبة للدخول" : "Open and suitable for entry"} tone="green" icon={<TrendingUp/>}/>
          <KpiCard title={isArabic ? "احتفظ / انتظر" : "Hold / wait"} value={String(summary.hold)} note={isArabic ? "لا دخول جديد حاليًا" : "No new entry at present"} tone="gold" icon={<PauseCircle/>}/>
          <KpiCard title={isArabic ? "إجمالي المفتوح" : "Open record"} value={String(summary.open)} note={isArabic ? "غير مغلقة" : "Not yet closed"} tone="blue" icon={<Crosshair/>}/>
          <KpiCard title={isArabic ? "المغلق" : "Closed record"} value={String(summary.closed)} note={isArabic ? "نتائج نهائية" : "Final frozen outcomes"} tone="neutral" icon={<Gauge/>}/>
          <KpiCard title={isArabic ? "نسبة النجاح" : "Success rate"} value={formatPercent(summary.successRate)} note={isArabic ? "من المغلق" : "Across closed calls"} tone={summary.successRate >= 50 ? "green" : "red"}/>
          <KpiCard title={isArabic ? "متوسط العائد" : "Average return"} value={formatPercent(summary.averageClosedReturn)} note={`${Math.round(summary.averageClosedDays)} ${isArabic ? "يوم متوسط احتفاظ" : "average holding days"}`} tone={summary.averageClosedReturn >= 0 ? "green" : "red"} icon={<Clock3/>}/>
        </section>

        {featured && featuredMetrics && <section className="featured-recommendation-v3">
          <div className="featured-visual-v3"><CompanyMark ticker={featured.ticker} name={featured.company_name} image={featured.company_logo_url} size="large"/><span>{featured.sector || (isArabic ? "أسهم مصرية" : "Egyptian equities")}</span><i>FEATURED</i></div>
          <div className="featured-copy-v3"><div className="featured-status-v3"><span className={`action-pill-v23 ${featured.action_status || "invest"}`}>{recommendationActionLabel(featured.action_status || "invest", isArabic)}</span><span className={`status-pill small ${featuredMetrics.isOpen ? "live" : "final"}`}>{recommendationStatusLabel(featured.status, isArabic)}</span></div><h2>{featured.company_name}</h2><h3>{featured.title}</h3><p>{featured.why_selected || featured.company_story || (isArabic ? "افتح التوصية لقراءة الفرضية الاستثمارية والتقييم والمخاطر." : "Open the recommendation to read the full investment thesis, valuation and risk case.")}</p><div className="featured-metrics-v3"><span><small>{isArabic ? "سعر الدخول" : "Entry"}</small><b>{formatNumber(featured.entry_price, 2, locale)}</b></span><span><small>{isArabic ? "السعر الحالي" : "Current"}</small><b>{formatNumber(featuredMetrics.currentPrice, 2, locale)}</b></span><span><small>{isArabic ? "المستهدف" : "Target"}</small><b>{formatNumber(featured.target_price, 2, locale)}</b></span><span><small>{isArabic ? "المتبقي" : "Upside"}</small><b className={featuredMetrics.upsideToTarget >= 0 ? "positive" : "negative"}>{formatPercent(featuredMetrics.upsideToTarget)}</b></span></div><AuthorAttribution profile={profiles[featured.created_by]} authorId={featured.created_by} compact/><Link className="button gold" to={`/recommendations/${featured.id}`}>{isArabic ? "فتح توصية السهم" : "Open stock recommendation"}<ArrowUpRight size={15}/></Link></div>
        </section>}

        <section className="research-toolbar-v22 research-toolbar-v3" id="research-library">
          <div><span className="eyebrow">STOCK RECOMMENDATION LIBRARY</span><h2>{isArabic ? "كل توصيات الأسهم المنشورة" : "All published stock recommendations"}</h2></div>
          <div className="research-controls-v3"><label className="research-search-v3"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "ابحث باسم الشركة أو رمز السهم" : "Search company or ticker"}/></label><label className="research-sort-v3"><SlidersHorizontal size={15}/><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">{isArabic ? "الأحدث" : "Latest"}</option><option value="upside">{isArabic ? "أعلى مستهدف" : "Highest upside"}</option><option value="return">{isArabic ? "أفضل عائد" : "Best return"}</option><option value="alpha">{isArabic ? "أعلى ألفا" : "Highest Alpha"}</option></select></label></div>
          <div className="range-switch ideas-filter-v23"><Filter size={14}/>{[["all", isArabic ? "الكل" : "All"],["invest", isArabic ? "استثمر" : "Invest"],["hold", isArabic ? "احتفظ" : "Hold"],["closed", isArabic ? "مغلقة" : "Closed"]].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
        </section>

        {loading ? <div className="loading-screen"><div className="loader-ring"/><p>{isArabic ? "جاري تحميل التوصيات…" : "Loading recommendations…"}</p></div> : (
          <section className="research-grid-v22 research-magazine-grid-v3">
            {visible.map((item, index) => {
              const metrics = recommendationMetrics(item, prices);
              const action = item.action_status || "invest";
              return <Link className={`research-card-v22 idea-card-v23 research-card-v3 ${index % 5 === 0 ? "wide-card" : ""}`} to={`/recommendations/${item.id}`} key={item.id}>
                <div className="research-card-cover-v3"><CompanyMark ticker={item.ticker} name={item.company_name} image={item.company_logo_url}/><span>{item.sector || "EGX"}</span><em>{String(index + 1).padStart(2, "0")}</em></div>
                <div className="research-card-top-v22"><span className={`action-pill-v23 ${action}`}>{recommendationActionLabel(action, isArabic)}</span><span className={`status-pill small ${metrics.isOpen ? "live" : "final"}`}>{recommendationStatusLabel(item.status, isArabic)}</span></div>
                <div className="research-company-v22"><div><h3>{item.company_name}</h3><p>{item.title}</p></div></div>
                <div className="potential-hero-v23"><span><small>{isArabic ? "المتبقي للمستهدف" : "Remaining upside"}</small><b className={metrics.upsideToTarget >= 0 ? "positive" : "negative"}>{formatPercent(metrics.upsideToTarget)}</b></span><Target size={24}/></div>
                <div className="research-card-metrics-v22"><Metric label={isArabic ? "دخول" : "Entry"} value={formatNumber(item.entry_price, 2, locale)}/><Metric label={isArabic ? "حالي" : "Current"} value={formatNumber(metrics.currentPrice, 2, locale)}/><Metric label={isArabic ? "مستهدف" : "Target"} value={formatNumber(item.target_price, 2, locale)}/></div>
                <div className="research-return-strip-v22"><span><small>{isArabic ? "العائد" : "Return"}</small><b className={metrics.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(metrics.returnPct)}</b></span><span><small>EGX30</small><b className={metrics.benchmarkReturn >= 0 ? "gold-text" : "negative"}>{formatPercent(metrics.benchmarkReturn)}</b></span><span><small>Alpha</small><b className={metrics.alpha >= 0 ? "positive" : "negative"}>{formatPercent(metrics.alpha)}</b></span></div>
                <footer className="research-card-author-footer-v32"><AuthorAttribution profile={profiles[item.created_by]} authorId={item.created_by} compact/><b>{isArabic ? "عرض" : "Open"}<ArrowUpRight size={14}/></b></footer>
              </Link>;
            })}
            {!visible.length && <div className="empty-state-v21 research-empty-v3"><Search size={44}/><h2>{isArabic ? "لا توجد نتائج مطابقة" : "No matching recommendations"}</h2><p>{isArabic ? "جرّب تغيير الفلتر أو البحث باسم آخر." : "Try another filter or search term."}</p></div>}
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return <span><small>{label}</small><b>{value}</b></span>;
}
