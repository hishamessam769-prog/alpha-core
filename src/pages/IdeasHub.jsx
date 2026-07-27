import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BadgeCheck, Clock3, Crosshair, Gauge, PauseCircle, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
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
    if (filter === "closed") return !["open", "draft"].includes(item.status);
    return item.status === "open" && (item.action_status || "invest") === filter;
  }), [recommendations, filter]);

  return (
    <div className="dashboard-shell research-shell-v22">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}

      <main className="research-page-v22">
        <section className="research-hero-v22 ideas-hero-v23">
          <div>
            <span className="eyebrow">ALPHA CORE INDEPENDENT RECOMMENDATIONS</span>
            <h1>{isArabic ? "توصيات مستقلة مبنية على التحليل الأساسي" : "Independent recommendations built on fundamental analysis"}</h1>
            <p>{isArabic
              ? "كل توصية لها قرار واضح للمستثمر وسعر بداية ومستهدف واحد خلال 12 شهر وأداء مقارن مع EGX30 Capped وسجل تحديثات دائم."
              : "Every idea has a clear investor action, one entry price, one 12-month target, an EGX30 Capped comparison and a permanent update history."}</p>
          </div>
          <div className="research-hero-badge"><BadgeCheck/><span>{isArabic ? "قرار + مستهدف + أداء" : "Action + target + performance"}</span></div>
        </section>

        <section className="kpi-grid-v21 research-kpis-v22">
          <KpiCard title={isArabic ? "استثمر الآن" : "Invest now"} value={String(summary.invest)} note={isArabic ? "توصيات مفتوحة ومناسبة للدخول" : "Open recommendations currently suitable for entry"} tone="green" icon={<TrendingUp/>}/>
          <KpiCard title={isArabic ? "احتفظ / انتظر" : "Hold / wait"} value={String(summary.hold)} note={isArabic ? "السجل مفتوح لكن لا ننصح بدخول جديد" : "Record remains open but no new entry"} tone="gold" icon={<PauseCircle/>}/>
          <KpiCard title={isArabic ? "إجمالي المفتوح" : "Open record"} value={String(summary.open)} note={isArabic ? "كل التوصيات التي لم تُغلق" : "All recommendations not yet closed"} tone="blue" icon={<Crosshair/>}/>
          <KpiCard title={isArabic ? "المغلق" : "Closed record"} value={String(summary.closed)} note={isArabic ? "نتائج نهائية ثابتة" : "Frozen final outcomes"} tone="neutral" icon={<Gauge/>}/>
          <KpiCard title={isArabic ? "نسبة النجاح" : "Success rate"} value={formatPercent(summary.successRate)} note={isArabic ? "من التوصيات المغلقة" : "Across closed ideas"} tone={summary.successRate >= 50 ? "green" : "red"}/>
          <KpiCard title={isArabic ? "متوسط العائد المغلق" : "Average closed return"} value={formatPercent(summary.averageClosedReturn)} note={`${isArabic ? "متوسط المدة" : "Average duration"}: ${Math.round(summary.averageClosedDays)} ${isArabic ? "يوم" : "days"}`} tone={summary.averageClosedReturn >= 0 ? "green" : "red"} icon={<Clock3/>}/>
        </section>

        <section className="research-toolbar-v22">
          <div>
            <span className="eyebrow">IDEAS LIBRARY</span>
            <h2>{isArabic ? "سجل التوصيات المستقلة" : "Independent recommendations record"}</h2>
          </div>
          <div className="range-switch ideas-filter-v23">
            {[
              ["all", isArabic ? "الكل" : "All"],
              ["invest", isArabic ? "استثمر" : "Invest"],
              ["hold", isArabic ? "احتفظ / انتظر" : "Hold / wait"],
              ["closed", isArabic ? "مغلقة" : "Closed"],
            ].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
        </section>

        {loading ? <div className="loading-screen"><div className="loader-ring"/><p>{isArabic ? "جاري تحميل التوصيات…" : "Loading recommendations…"}</p></div> : (
          <section className="research-grid-v22">
            {visible.map((item) => {
              const metrics = recommendationMetrics(item, prices);
              const action = item.action_status || "invest";
              return (
                <Link className="research-card-v22 idea-card-v23" to={`/recommendations/${item.id}`} key={item.id}>
                  <div className="research-card-top-v22">
                    <span className={`action-pill-v23 ${action}`}>{recommendationActionLabel(action, isArabic)}</span>
                    <span className={`status-pill small ${metrics.isOpen ? "live" : "final"}`}>{recommendationStatusLabel(item.status, isArabic)}</span>
                  </div>
                  <div className="research-company-v22">
                    <div className="ticker-orb-v22">{item.ticker}</div>
                    <div><h3>{item.company_name}</h3><p>{item.title}</p></div>
                  </div>

                  <div className="potential-hero-v23">
                    <span><small>{isArabic ? "المتبقي للمستهدف" : "Remaining upside"}</small><b className={metrics.upsideToTarget >= 0 ? "positive" : "negative"}>{formatPercent(metrics.upsideToTarget)}</b></span>
                    <Target size={26}/>
                  </div>

                  <div className="research-card-metrics-v22">
                    <Metric label={isArabic ? "سعر البداية" : "Entry"} value={formatNumber(item.entry_price, 2, locale)}/>
                    <Metric label={isArabic ? "السعر الحالي" : "Current"} value={formatNumber(metrics.currentPrice, 2, locale)}/>
                    <Metric label={isArabic ? "مستهدف 12 شهر" : "12M target"} value={formatNumber(item.target_price, 2, locale)}/>
                  </div>
                  <div className="research-return-strip-v22">
                    <span><small>{isArabic ? "العائد" : "Return"}</small><b className={metrics.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(metrics.returnPct)}</b></span>
                    <span><small>EGX30 Capped</small><b className={metrics.benchmarkReturn >= 0 ? "gold-text" : "negative"}>{formatPercent(metrics.benchmarkReturn)}</b></span>
                    <span><small>Alpha</small><b className={metrics.alpha >= 0 ? "positive" : "negative"}>{formatPercent(metrics.alpha)}</b></span>
                  </div>
                  <footer><span>{metrics.durationDays} {isArabic ? "يوم" : "days"} · {isArabic ? "آخر تحديث" : "Updated"} {dateTimeLabel(item.updated_at, locale)}</span><b>{isArabic ? "عرض التوصية" : "Open recommendation"}<ArrowUpRight size={14}/></b></footer>
                </Link>
              );
            })}
            {!visible.length && <div className="empty-state-v21"><Target size={44}/><h2>{isArabic ? "لا توجد توصيات منشورة في هذا القسم" : "No published ideas in this section"}</h2></div>}
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return <span><small>{label}</small><b>{value}</b></span>;
}
