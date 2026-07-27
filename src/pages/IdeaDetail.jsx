import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Clock3, Gauge, PauseCircle, ShieldAlert, Sparkles, Target, TrendingUp } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import KpiCard from "../components/KpiCard";
import { useLanguage } from "../context/LanguageContext";
import { dateTimeLabel, formatNumber, formatPercent } from "../lib/calculations";
import { recommendationActionLabel, recommendationMetrics, recommendationStatusLabel, splitResearchPoints } from "../lib/recommendations";
import { supabase } from "../lib/supabase";

export default function IdeaDetail() {
  const { id } = useParams();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const [item, setItem] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [prices, setPrices] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: rec, error: recError }, { data: updateRows, error: updatesError }, { data: priceRows, error: pricesError }] = await Promise.all([
        supabase.from("recommendations").select("*").eq("id", id).single(),
        supabase.from("recommendation_updates").select("*").eq("recommendation_id", id).order("update_date", { ascending: false }),
        supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
      ]);
      if (recError || updatesError || pricesError) setMessage(recError?.message || updatesError?.message || pricesError?.message || "");
      setItem(rec || null);
      setUpdates(updateRows || []);
      setPrices(Object.fromEntries((priceRows || []).map((row) => [String(row.ticker).toUpperCase(), row])));
      setLoading(false);
    };
    load();
  }, [id]);

  const metrics = useMemo(() => item ? recommendationMetrics(item, prices) : null, [item, prices]);

  if (loading) return <div className="dashboard-shell"><DashboardHeader/><div className="loading-screen"><div className="loader-ring"/></div></div>;
  if (!item) return <div className="dashboard-shell"><DashboardHeader/><div className="empty-state-v21"><h1>{isArabic ? "التوصية غير موجودة" : "Recommendation not found"}</h1><Link className="button gold" to="/recommendations">{isArabic ? "العودة للتوصيات" : "Back to recommendations"}</Link></div></div>;

  const positives = splitResearchPoints(item.positives);
  const risks = splitResearchPoints(item.risks);
  const action = item.action_status || "invest";

  return (
    <div className="dashboard-shell research-detail-shell-v22">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="research-detail-v22">
        <Link className="back-link" to="/recommendations"><BackIcon size={15}/>{isArabic ? "العودة لكل التوصيات" : "Back to all recommendations"}</Link>

        <section className="research-detail-hero-v22 idea-detail-hero-v23">
          <div className="research-detail-title-v22">
            <div className="ticker-orb-v22 large">{item.ticker}</div>
            <div>
              <div className="research-detail-status-row-v22">
                <span className={`action-pill-v23 ${action}`}>{recommendationActionLabel(action, isArabic)}</span>
                <span className={`status-pill ${metrics.isOpen ? "live" : "final"}`}>{recommendationStatusLabel(item.status, isArabic)}</span>
                <span>{item.horizon_months}M {isArabic ? "أفق زمني" : "horizon"}</span>
              </div>
              <h1>{item.company_name}</h1>
              <p>{item.title}</p>
            </div>
          </div>
          <div className="idea-decision-card-v23">
            {action === "invest" ? <TrendingUp/> : <PauseCircle/>}
            <span><small>{isArabic ? "القرار الحالي" : "Current action"}</small><b>{recommendationActionLabel(action, isArabic)}</b><p>{action === "invest" ? (isArabic ? "التوصية مفتوحة ونرى أن مستوى السعر الحالي مناسب للدخول وفق الفرضية المنشورة." : "The idea is open and the current level remains suitable for entry under the published case.") : (isArabic ? "التوصية ما زالت مفتوحة في سجل الأداء لكننا لا نوصي بدخول جديد حاليًا." : "The performance record remains open, but we do not recommend a new entry at present.")}</p></span>
          </div>
          <div className="research-detail-meta-v22">
            <span><CalendarDays size={16}/><small>{isArabic ? "تاريخ التوصية" : "Recommendation date"}</small><b>{new Date(`${item.recommendation_date}T12:00:00`).toLocaleDateString(locale)}</b></span>
            <span><Clock3 size={16}/><small>{isArabic ? "مدة التوصية" : "Duration"}</small><b>{metrics.durationDays} {isArabic ? "يوم" : "days"}</b></span>
            <span><Gauge size={16}/><small>{isArabic ? "آخر تحديث أسعار" : "Last price update"}</small><b>{metrics.priceDate ? new Date(`${metrics.priceDate}T12:00:00`).toLocaleDateString(locale) : "—"}</b></span><span><Clock3 size={16}/><small>{isArabic ? "آخر تحديث للتوصية" : "Recommendation last updated"}</small><b>{dateTimeLabel(item.updated_at, locale)}</b></span>
          </div>
        </section>

        <section className="kpi-grid-v21 research-detail-kpis-v22">
          <KpiCard title={isArabic ? "سعر البداية" : "Entry price"} value={formatNumber(item.entry_price, 2, locale)} note={item.ticker} tone="neutral"/>
          <KpiCard title={metrics.isOpen ? (isArabic ? "السعر الحالي" : "Current price") : (isArabic ? "سعر الإغلاق" : "Exit price")} value={formatNumber(metrics.currentPrice, 2, locale)} note={metrics.priceDate || "—"} tone="blue" icon={<TrendingUp/>}/>
          <KpiCard title={isArabic ? "المتبقي للمستهدف" : "Remaining upside"} value={formatPercent(metrics.upsideToTarget)} note={`${isArabic ? "المستهدف" : "Target"}: ${formatNumber(item.target_price, 2, locale)}`} tone={metrics.upsideToTarget >= 0 ? "gold" : "red"} icon={<Target/>}/>
          <KpiCard title={isArabic ? "العائد الحالي" : "Idea return"} value={formatPercent(metrics.returnPct)} note={isArabic ? "من سعر التوصية" : "From recommendation price"} tone={metrics.returnPct >= 0 ? "green" : "red"}/>
          <KpiCard title="EGX30 Capped" value={formatPercent(metrics.benchmarkReturn)} note={isArabic ? "خلال نفس الفترة" : "Over the same period"} tone={metrics.benchmarkReturn >= 0 ? "gold" : "red"}/>
          <KpiCard title="Alpha" value={formatPercent(metrics.alpha)} note={isArabic ? "عائد السهم ناقص المؤشر" : "Idea return less benchmark"} tone={metrics.alpha >= 0 ? "green" : "red"}/>
        </section>

        <section className="research-story-grid-v22">
          <article className="panel-v21 padded-v21 research-long-card-v22">
            <span className="eyebrow">COMPANY STORY</span>
            <h2><Building2 size={21}/>{isArabic ? "قصة الشركة" : "The company story"}</h2>
            <p>{item.company_story || "—"}</p>
          </article>
          <article className="panel-v21 padded-v21 research-long-card-v22">
            <span className="eyebrow">FUNDAMENTAL CASE</span>
            <h2><Sparkles size={21}/>{isArabic ? "ليه اخترنا السهم" : "Why we selected it"}</h2>
            <p>{item.why_selected || "—"}</p>
          </article>
        </section>

        <section className="research-story-grid-v22">
          <article className="panel-v21 padded-v21 research-points-card-v22 positive-card-v22">
            <span className="eyebrow">UPSIDE CASE</span>
            <h2><TrendingUp size={21}/>{isArabic ? "الإيجابيات ومحركات الصعود" : "Positives and catalysts"}</h2>
            <ul>{positives.length ? positives.map((point, index) => <li key={index}>{point}</li>) : <li>—</li>}</ul>
          </article>
          <article className="panel-v21 padded-v21 research-points-card-v22 risk-card-v22">
            <span className="eyebrow">RISK CASE</span>
            <h2><ShieldAlert size={21}/>{isArabic ? "السلبيات والمخاطر" : "Negatives and risks"}</h2>
            <ul>{risks.length ? risks.map((point, index) => <li key={index}>{point}</li>) : <li>—</li>}</ul>
          </article>
        </section>

        <section className="panel-v21 padded-v21 valuation-card-v22">
          <span className="eyebrow">VALUATION</span>
          <h2>{isArabic ? "منطق التقييم والسعر المستهدف" : "Valuation and target-price logic"}</h2>
          <p>{item.valuation || "—"}</p>
          <div className="valuation-strip-v22">
            <span><small>{isArabic ? "العائد للمستهدف من البداية" : "Target return from entry"}</small><b>{formatPercent(metrics.targetReturn)}</b></span>
            <span><small>{isArabic ? "المتبقي للمستهدف من السعر الحالي" : "Remaining upside from current price"}</small><b>{formatPercent(metrics.upsideToTarget)}</b></span>
            <span><small>{isArabic ? "الألفا الحالية" : "Current Alpha"}</small><b className={metrics.alpha >= 0 ? "positive" : "negative"}>{formatPercent(metrics.alpha)}</b></span>
          </div>
        </section>

        <section className="research-updates-v22 panel-v21 padded-v21">
          <div className="panel-heading-v21"><div><span className="eyebrow">UPDATES</span><h2>{isArabic ? "سجل تحديثات الشركة" : "Company update timeline"}</h2><p>{isArabic ? "أي تغيير في الفرضية أو النتائج أو القرار الحالي يظل محفوظًا بالتاريخ." : "Every change to the case, results or current action remains permanently dated."}</p></div></div>
          <div className="timeline-v22">
            {updates.map((update) => <article key={update.id}>
              <span className="timeline-dot-v22"/>
              <div><small>{new Date(`${update.update_date}T12:00:00`).toLocaleDateString(locale)}</small><h3>{update.title}</h3><p>{update.body}</p></div>
            </article>)}
            {!updates.length && <p className="muted-copy-v21">{isArabic ? "لا توجد تحديثات منشورة بعد." : "No updates have been published yet."}</p>}
          </div>
        </section>

        <footer className="report-disclaimer-v21">{isArabic ? "هذه التوصية مبنية على تحليل أساسي عام ولا تمثل نصيحة استثمارية شخصية. السعر المستهدف تقديري وقد لا يتحقق." : "This idea is based on general fundamental analysis and is not personalised investment advice. The target price is an estimate and may not be achieved."}</footer>
      </main>
    </div>
  );
}
