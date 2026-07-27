import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Clock3, Crosshair, FlaskConical, Gauge, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import KpiCard from "../components/KpiCard";
import { useLanguage } from "../context/LanguageContext";
import { formatNumber, formatPercent } from "../lib/calculations";
import { recommendationMetrics, recommendationStatusLabel, recommendationSummary } from "../lib/recommendations";
import { supabase } from "../lib/supabase";

export default function ResearchHub() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [recommendations, setRecommendations] = useState([]);
  const [prices, setPrices] = useState({});
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: recs, error: recError }, { data: priceRows, error: priceError }] = await Promise.all([
      supabase.from("recommendations").select("*").eq("is_published", true).order("recommendation_date", { ascending: false }),
      supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
    ]);
    if (recError || priceError) setMessage(recError?.message || priceError?.message || "");
    setRecommendations(recs || []);
    setPrices(Object.fromEntries((priceRows || []).map((row) => [String(row.ticker).toUpperCase(), row])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => recommendationSummary(recommendations, prices), [recommendations, prices]);
  const visible = useMemo(() => recommendations.filter((item) => {
    if (filter === "all") return true;
    if (filter === "open") return item.status === "open";
    return item.status !== "open" && item.status !== "draft";
  }), [recommendations, filter]);

  return (
    <div className="dashboard-shell research-shell-v22">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}

      <main className="research-page-v22">
        <section className="research-hero-v22">
          <div>
            <span className="eyebrow">ALPHA CORE RESEARCH</span>
            <h1>{isArabic ? "أبحاث وتوصيات مستقلة قابلة للقياس" : "Independent research with a measurable record"}</h1>
            <p>{isArabic
              ? "كل فكرة استثمارية لها سعر بداية ومستهدف واحد خلال 12 شهر ومقارنة واضحة مع EGX30 Capped وسجل دائم لكل تحديث."
              : "Every investment idea has one entry price, one 12-month target, a clear EGX30 Capped comparison and a permanent update history."}</p>
          </div>
          <div className="research-hero-badge"><FlaskConical/><span>{isArabic ? "منهجية + أداء + تحديثات" : "Thesis + performance + updates"}</span></div>
        </section>

        <section className="kpi-grid-v21 research-kpis-v22">
          <KpiCard title={isArabic ? "التوصيات المفتوحة" : "Open ideas"} value={String(summary.open)} note={isArabic ? "تتحدث مع آخر ملف أسعار" : "Updated by the latest price file"} tone="blue" icon={<Crosshair/>}/>
          <KpiCard title={isArabic ? "التوصيات المغلقة" : "Closed ideas"} value={String(summary.closed)} note={isArabic ? "سجل نهائي لا يتغير" : "Frozen permanent record"} tone="gold" icon={<Gauge/>}/>
          <KpiCard title={isArabic ? "نسبة النجاح" : "Success rate"} value={formatPercent(summary.successRate)} note={isArabic ? "التوصيات المغلقة ذات عائد موجب" : "Closed ideas with a positive return"} tone={summary.successRate >= 50 ? "green" : "red"} icon={<TrendingUp/>}/>
          <KpiCard title={isArabic ? "متوسط العائد المغلق" : "Average closed return"} value={formatPercent(summary.averageClosedReturn)} note={isArabic ? "متوسط الربح أو الخسارة" : "Average realised gain or loss"} tone={summary.averageClosedReturn >= 0 ? "green" : "red"}/>
          <KpiCard title={isArabic ? "متوسط الألفا" : "Average closed Alpha"} value={formatPercent(summary.averageClosedAlpha)} note="Versus EGX30 Capped" tone={summary.averageClosedAlpha >= 0 ? "green" : "red"}/>
          <KpiCard title={isArabic ? "متوسط المدة" : "Average duration"} value={`${Math.round(summary.averageClosedDays)} ${isArabic ? "يوم" : "days"}`} note={isArabic ? "للتوصيات المغلقة" : "Across closed ideas"} tone="neutral" icon={<Clock3/>}/>
        </section>

        <section className="research-toolbar-v22">
          <div>
            <span className="eyebrow">IDEAS LIBRARY</span>
            <h2>{isArabic ? "سجل التوصيات" : "Recommendations record"}</h2>
          </div>
          <div className="range-switch">
            {["all", "open", "closed"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? (isArabic ? "الكل" : "All") : item === "open" ? (isArabic ? "مفتوحة" : "Open") : (isArabic ? "مغلقة" : "Closed")}</button>)}
          </div>
        </section>

        {loading ? <div className="loading-screen"><div className="loader-ring"/><p>{isArabic ? "جاري تحميل الأبحاث…" : "Loading research…"}</p></div> : (
          <section className="research-grid-v22">
            {visible.map((item) => {
              const metrics = recommendationMetrics(item, prices);
              return (
                <Link className="research-card-v22" to={`/research/${item.id}`} key={item.id}>
                  <div className="research-card-top-v22">
                    <span className={`status-pill ${metrics.isOpen ? "live" : "final"}`}>{recommendationStatusLabel(item.status, isArabic)}</span>
                    <span className="price-date-v22">{metrics.priceDate ? new Date(`${metrics.priceDate}T12:00:00`).toLocaleDateString(locale) : "—"}</span>
                  </div>
                  <div className="research-company-v22">
                    <div className="ticker-orb-v22">{item.ticker}</div>
                    <div><h3>{item.company_name}</h3><p>{item.title}</p></div>
                  </div>
                  <div className="research-card-metrics-v22">
                    <Metric label={isArabic ? "سعر البداية" : "Entry"} value={formatNumber(item.entry_price, 2, locale)}/>
                    <Metric label={isArabic ? "السعر الحالي" : "Current"} value={formatNumber(metrics.currentPrice, 2, locale)}/>
                    <Metric label={isArabic ? "مستهدف 12 شهر" : "12M target"} value={formatNumber(item.target_price, 2, locale)} icon={<Target/>}/>
                  </div>
                  <div className="research-return-strip-v22">
                    <span><small>{isArabic ? "العائد" : "Return"}</small><b className={metrics.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(metrics.returnPct)}</b></span>
                    <span><small>EGX30 Capped</small><b className={metrics.benchmarkReturn >= 0 ? "gold-text" : "negative"}>{formatPercent(metrics.benchmarkReturn)}</b></span>
                    <span><small>Alpha</small><b className={metrics.alpha >= 0 ? "positive" : "negative"}>{formatPercent(metrics.alpha)}</b></span>
                  </div>
                  <footer><span>{metrics.durationDays} {isArabic ? "يوم منذ البداية" : "days since launch"}</span><b>{isArabic ? "عرض البحث" : "Open research"}<ArrowUpRight size={14}/></b></footer>
                </Link>
              );
            })}
            {!visible.length && <div className="empty-state-v21"><FlaskConical size={44}/><h2>{isArabic ? "لا توجد توصيات منشورة في هذا القسم" : "No published ideas in this section"}</h2></div>}
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, icon }) {
  return <span><small>{icon}{label}</small><b>{value}</b></span>;
}
