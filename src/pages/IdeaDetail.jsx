import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Award, BarChart3, BookOpen, Building2, CalendarDays, CheckCircle2, Clock3, Gauge, History, PauseCircle, ShieldAlert, Sparkles, Target, TrendingUp, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import AuthorAttribution from "../components/AuthorAttribution";
import CompanyMark from "../components/CompanyMark";
import DashboardHeader from "../components/DashboardHeader";
import InsightDrawer from "../components/InsightDrawer";
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
  const [related, setRelated] = useState([]);
  const [prices, setPrices] = useState({});
  const [author, setAuthor] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [recommendationResult, updatesResult, pricesResult, relatedResult, profilesResult] = await Promise.all([
        supabase.from("recommendations").select("*").eq("id", id).single(),
        supabase.from("recommendation_updates").select("*").eq("recommendation_id", id).order("update_date", { ascending: false }),
        supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
        supabase.from("recommendations").select("*").eq("is_published", true).neq("id", id).order("recommendation_date", { ascending: false }).limit(3),
        supabase.from("profiles").select("*"),
      ]);
      const error = recommendationResult.error || updatesResult.error || pricesResult.error || relatedResult.error;
      if (error) setMessage(error.message || "");
      setItem(recommendationResult.data || null);
      setUpdates(updatesResult.data || []);
      setRelated(relatedResult.data || []);
      setPrices(Object.fromEntries((pricesResult.data || []).map((row) => [String(row.ticker).toUpperCase(), row])));
      setAuthor((profilesResult.data || []).find((row) => row.id === recommendationResult.data?.created_by) || null);
      setLoading(false);
    };
    load();
  }, [id]);

  const metrics = useMemo(() => item ? recommendationMetrics(item, prices) : null, [item, prices]);

  if (loading) return <div className="dashboard-shell"><DashboardHeader/><div className="loading-screen recommendation-skeleton-v3"><div className="loader-ring"/><div><i/><i/><i/></div></div></div>;
  if (!item) return <div className="dashboard-shell"><DashboardHeader/><div className="empty-state-v21"><h1>{isArabic ? "التوصية غير موجودة" : "Recommendation not found"}</h1><Link className="button gold" to="/recommendations">{isArabic ? "العودة للتوصيات" : "Back to recommendations"}</Link></div></div>;

  const positives = splitResearchPoints(item.positives);
  const risks = splitResearchPoints(item.risks);
  const catalysts = splitResearchPoints(item.catalysts || item.positives);
  const action = item.action_status || "invest";
  const analystName = author?.full_name || item.analyst_name || (isArabic ? "فريق أبحاث ALPHA CORE" : "ALPHA CORE Research Desk");
  const analystTitle = author?.title || author?.position || item.analyst_title || (isArabic ? "تحليل الأسهم المصرية" : "Egyptian Equities Research");
  const analystBio = author?.bio || item.analyst_bio || (isArabic ? "فريق بحثي يركز على التحليل الأساسي والتقييم وقياس أداء الفكرة مقابل المؤشر طوال فترة التوصية." : "An independent research desk focused on fundamental analysis, valuation and benchmark-relative measurement throughout the life of each recommendation.");
  const egx70Alpha = item.egx70_alpha ?? item.alpha_vs_egx70 ?? null;
  const progress = Math.min(100, Math.max(0, ((Number(metrics.currentPrice) - Number(item.entry_price)) / Math.max(0.0001, Number(item.target_price) - Number(item.entry_price))) * 100));
  const aiSummary = isArabic
    ? `${item.company_name} (${item.ticker}) في حالة ${recommendationActionLabel(action, true)}. سعر البداية ${formatNumber(item.entry_price, 2, locale)} والسعر الحالي ${formatNumber(metrics.currentPrice, 2, locale)} والمستهدف ${formatNumber(item.target_price, 2, locale)}، ما يعني عائدًا حاليًا ${formatPercent(metrics.returnPct)} ومتبقيًا للمستهدف ${formatPercent(metrics.upsideToTarget)}. حققت الفكرة ألفا ${formatPercent(metrics.alpha)} مقابل EGX30 Capped. الفرضية الرئيسية: ${item.why_selected || item.title}. أهم المخاطر: ${risks.slice(0, 2).join("، ") || "غير مذكورة"}. آخر تحديث ${dateTimeLabel(item.updated_at, locale)}.`
    : `${item.company_name} (${item.ticker}) is currently rated ${recommendationActionLabel(action, false)}. Entry price is ${formatNumber(item.entry_price, 2, locale)}, current price is ${formatNumber(metrics.currentPrice, 2, locale)} and the target is ${formatNumber(item.target_price, 2, locale)}, implying a current return of ${formatPercent(metrics.returnPct)} and remaining upside of ${formatPercent(metrics.upsideToTarget)}. The idea has generated ${formatPercent(metrics.alpha)} of Alpha versus EGX30 Capped. Core thesis: ${item.why_selected || item.title}. Key risks: ${risks.slice(0, 2).join("; ") || "not stated"}. Last updated ${dateTimeLabel(item.updated_at, locale)}.`;

  return (
    <div className="dashboard-shell research-detail-shell-v22 recommendation-detail-v3">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="research-detail-v22 recommendation-page-v3">
        <div className="recommendation-breadcrumb-v3"><Link className="back-link" to="/recommendations"><BackIcon size={15}/>{isArabic ? "كل التوصيات" : "All recommendations"}</Link><span>/</span><b>{item.ticker}</b></div>

        <section className="recommendation-hero-v3">
          <div className="recommendation-company-v3">
            <CompanyMark ticker={item.ticker} name={item.company_name} image={item.company_logo_url} size="xlarge"/>
            <div><div className="research-detail-status-row-v22"><span className={`action-pill-v23 ${action}`}>{recommendationActionLabel(action, isArabic)}</span><span className={`status-pill ${metrics.isOpen ? "live" : "final"}`}>{recommendationStatusLabel(item.status, isArabic)}</span><span>{item.sector || (isArabic ? "أسهم مصرية" : "Egyptian equities")}</span></div><h1>{item.company_name}</h1><p>{item.title}</p><div className="recommendation-meta-inline-v3"><span><CalendarDays size={15}/>{new Date(`${item.recommendation_date}T12:00:00`).toLocaleDateString(locale)}</span><span><Clock3 size={15}/>{metrics.durationDays} {isArabic ? "يوم" : "days"}</span><span><UserRound size={15}/>{analystName}</span></div></div>
          </div>
          <div className="recommendation-hero-actions-v3"><InsightDrawer label={isArabic ? "اشرح التوصية" : "Explain this recommendation"} title={`${item.ticker} · ${isArabic ? "ملخص القرار" : "Decision brief"}`} summary={aiSummary}/><span className="last-update-chip-v3"><i/><small>{isArabic ? "آخر تحديث" : "LAST UPDATE"}</small><b>{dateTimeLabel(item.updated_at, locale)}</b></span></div>
        </section>

        <section className="decision-terminal-v3">
          <article className={`decision-call-v3 ${action}`}><div>{action === "invest" ? <TrendingUp/> : <PauseCircle/>}<span><small>{isArabic ? "قرار المحلل" : "ANALYST ACTION"}</small><b>{recommendationActionLabel(action, isArabic)}</b></span></div><p>{action === "invest" ? (isArabic ? "التوصية مفتوحة والسعر الحالي ما زال ضمن نطاق الفرضية المنشورة." : "The recommendation is open and the current price remains within the published investment case.") : (isArabic ? "السجل ما زال مفتوحًا لكن لا ننصح بدخول جديد عند المستوى الحالي." : "The record remains open, but a new entry is not currently recommended.")}</p></article>
          <article className="price-ladder-v3"><div className="price-ladder-labels-v3"><span><small>{isArabic ? "دخول" : "Entry"}</small><b>{formatNumber(item.entry_price, 2, locale)}</b></span><span><small>{isArabic ? "حالي" : "Current"}</small><b>{formatNumber(metrics.currentPrice, 2, locale)}</b></span><span><small>{isArabic ? "مستهدف" : "Target"}</small><b>{formatNumber(item.target_price, 2, locale)}</b></span></div><div className="price-track-v3"><i/><em style={{ left: `${progress}%` }}/></div><footer><span>{isArabic ? "التقدم نحو المستهدف" : "Progress to target"}</span><b>{formatPercent(metrics.upsideToTarget)} {isArabic ? "متبقي" : "remaining"}</b></footer></article>
        </section>

        <section className="kpi-grid-v21 recommendation-kpis-v3">
          <KpiCard title={isArabic ? "سعر البداية" : "Entry price"} value={formatNumber(item.entry_price, 2, locale)} note={item.ticker} tone="neutral"/>
          <KpiCard title={metrics.isOpen ? (isArabic ? "السعر الحالي" : "Current price") : (isArabic ? "سعر الإغلاق" : "Exit price")} value={formatNumber(metrics.currentPrice, 2, locale)} note={metrics.priceDate || "—"} tone="blue" icon={<TrendingUp/>}/>
          <KpiCard title={isArabic ? "السعر المستهدف" : "Target price"} value={formatNumber(item.target_price, 2, locale)} note={`${item.horizon_months || 12}M`} tone="gold" icon={<Target/>}/>
          <KpiCard title={isArabic ? "العائد الحالي" : "Current return"} value={formatPercent(metrics.returnPct)} note={isArabic ? "من سعر البداية" : "From entry price"} tone={metrics.returnPct >= 0 ? "green" : "red"}/>
          <KpiCard title="Alpha vs EGX30" value={formatPercent(metrics.alpha)} note={isArabic ? "خلال نفس الفترة" : "Same holding period"} tone={metrics.alpha >= 0 ? "green" : "red"} icon={<Sparkles/>}/>
          <KpiCard title="Alpha vs EGX70" value={egx70Alpha == null ? "—" : formatPercent(egx70Alpha)} note={egx70Alpha == null ? (isArabic ? "غير متاح في البيانات الحالية" : "Not available in current data") : (isArabic ? "خلال نفس الفترة" : "Same holding period")} tone={egx70Alpha == null ? "neutral" : egx70Alpha >= 0 ? "green" : "red"}/>
        </section>

        <section className="recommendation-layout-v3">
          <div className="recommendation-main-v3">
            <article className="panel-v21 padded-v21 thesis-card-v3"><span className="eyebrow">INVESTMENT THESIS</span><h2><BookOpen size={21}/>{isArabic ? "الفرضية الاستثمارية" : "Investment thesis"}</h2><p>{item.why_selected || item.company_story || "—"}</p><div className="thesis-highlights-v3"><span><CheckCircle2/><small>{isArabic ? "الأفق الزمني" : "Horizon"}</small><b>{item.horizon_months || 12} {isArabic ? "شهر" : "months"}</b></span><span><Target/><small>{isArabic ? "عائد المستهدف" : "Target return"}</small><b>{formatPercent(metrics.targetReturn)}</b></span><span><Gauge/><small>{isArabic ? "الحالة" : "Status"}</small><b>{recommendationStatusLabel(item.status, isArabic)}</b></span></div></article>

            <section className="research-story-grid-v22 research-story-grid-v3"><article className="panel-v21 padded-v21 research-long-card-v22"><span className="eyebrow">COMPANY</span><h2><Building2 size={21}/>{isArabic ? "قصة الشركة" : "Company overview"}</h2><p>{item.company_story || "—"}</p></article><article className="panel-v21 padded-v21 research-long-card-v22"><span className="eyebrow">WHY NOW</span><h2><Sparkles size={21}/>{isArabic ? "لماذا الآن" : "Why now"}</h2><p>{item.why_selected || "—"}</p></article></section>

            <section className="four-case-grid-v3">
              <CaseCard tone="positive" eyebrow="PROS" title={isArabic ? "الإيجابيات" : "Pros"} icon={<TrendingUp/>} points={positives}/>
              <CaseCard tone="gold" eyebrow="CATALYSTS" title={isArabic ? "المحفزات" : "Catalysts"} icon={<Sparkles/>} points={catalysts}/>
              <CaseCard tone="risk" eyebrow="CONS" title={isArabic ? "السلبيات" : "Cons"} icon={<ShieldAlert/>} points={risks.slice(0, Math.max(1, Math.ceil(risks.length / 2)))}/>
              <CaseCard tone="risk" eyebrow="RISKS" title={isArabic ? "المخاطر" : "Risks"} icon={<ShieldAlert/>} points={risks.slice(Math.max(1, Math.ceil(risks.length / 2)))}/>
            </section>

            <article className="panel-v21 padded-v21 valuation-card-v22 valuation-card-v3"><span className="eyebrow">VALUATION</span><h2>{isArabic ? "منطق التقييم والسعر المستهدف" : "Valuation and target-price framework"}</h2><p>{item.valuation || "—"}</p><div className="valuation-strip-v22"><span><small>{isArabic ? "العائد للمستهدف من البداية" : "Target return from entry"}</small><b>{formatPercent(metrics.targetReturn)}</b></span><span><small>{isArabic ? "المتبقي من السعر الحالي" : "Remaining upside"}</small><b>{formatPercent(metrics.upsideToTarget)}</b></span><span><small>{isArabic ? "الألفا الحالية" : "Current Alpha"}</small><b className={metrics.alpha >= 0 ? "positive" : "negative"}>{formatPercent(metrics.alpha)}</b></span></div></article>

            <section className="research-updates-v22 panel-v21 padded-v21 recommendation-timeline-v3"><div className="panel-heading-v21"><div><span className="eyebrow">UPDATE HISTORY</span><h2><History size={20}/>{isArabic ? "الخط الزمني للتوصية" : "Recommendation timeline"}</h2><p>{isArabic ? "كل تغيير في الفرضية أو النتائج أو القرار محفوظ بالتاريخ." : "Every change to the thesis, results or action remains permanently dated."}</p></div></div><div className="timeline-v22">{updates.map((update, index) => <article key={update.id}><span className="timeline-dot-v22"/><div><small>{new Date(`${update.update_date}T12:00:00`).toLocaleDateString(locale)} {index === 0 && <em>{isArabic ? "أحدث تحديث" : "LATEST"}</em>}</small><h3>{update.title}</h3><p>{update.body}</p></div></article>)}{!updates.length && <p className="muted-copy-v21">{isArabic ? "لا توجد تحديثات منشورة بعد." : "No updates have been published yet."}</p>}</div></section>
          </div>

          <aside className="recommendation-side-v3">
            <article className="analyst-profile-v3 panel-v21"><div className="analyst-cover-v3"><span className="analyst-avatar-v3">{(author?.avatar_url || author?.photo_url || item.analyst_photo_url) ? <img src={author?.avatar_url || author?.photo_url || item.analyst_photo_url} alt=""/> : <UserRound/>}</span><i>ALPHA RESEARCH</i></div><div className="analyst-body-v3"><span className="eyebrow">ANALYST PROFILE</span><h3>{analystName}</h3><small>{analystTitle}</small><p>{analystBio}</p><div className="analyst-stats-v3"><span><b>{item.analyst_experience_years || "—"}</b><small>{isArabic ? "سنوات خبرة" : "Years experience"}</small></span><span><b>{item.analyst_success_rate == null ? "—" : formatPercent(item.analyst_success_rate)}</b><small>{isArabic ? "نسبة نجاح" : "Success rate"}</small></span><span><b>{item.analyst_average_return == null ? "—" : formatPercent(item.analyst_average_return)}</b><small>{isArabic ? "متوسط عائد" : "Average return"}</small></span><span><b>{item.analyst_alpha_generated == null ? "—" : formatPercent(item.analyst_alpha_generated)}</b><small>{isArabic ? "ألفا مولدة" : "Alpha generated"}</small></span></div><div className="analyst-badge-v3"><Award size={16}/>{isArabic ? "تحليل مستقل قائم على البيانات" : "Independent, data-led research"}</div>{item.created_by && <Link className="analyst-profile-link-v32" to={`/analysts/${item.created_by}`}>{isArabic ? "فتح الملف الكامل" : "Open full profile"}<ArrowUpRight size={14}/></Link>}</div></article>

            <article className="panel-v21 latest-update-v3"><span className="eyebrow">LATEST UPDATE</span>{updates[0] ? <><h3>{updates[0].title}</h3><small>{new Date(`${updates[0].update_date}T12:00:00`).toLocaleDateString(locale)}</small><p>{updates[0].body}</p></> : <p>{isArabic ? "لم يتم نشر تحديث بعد." : "No update has been published yet."}</p>}</article>

            <article className="panel-v21 performance-score-v3"><span className="eyebrow">PERFORMANCE SCORECARD</span><div><BarChart3/><span><small>{isArabic ? "عائد الفكرة" : "Idea return"}</small><b className={metrics.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(metrics.returnPct)}</b></span></div><div><Sparkles/><span><small>Alpha</small><b className={metrics.alpha >= 0 ? "positive" : "negative"}>{formatPercent(metrics.alpha)}</b></span></div><div><Clock3/><span><small>{isArabic ? "فترة الاحتفاظ" : "Holding period"}</small><b>{metrics.durationDays} {isArabic ? "يوم" : "days"}</b></span></div></article>
          </aside>
        </section>

        {related.length > 0 && <section className="related-research-v3"><div className="panel-heading-v21"><div><span className="eyebrow">RELATED RESEARCH</span><h2>{isArabic ? "أبحاث أخرى قد تهمك" : "More research you may find useful"}</h2></div></div><div>{related.map((relatedItem) => { const relatedMetrics = recommendationMetrics(relatedItem, prices); return <Link to={`/recommendations/${relatedItem.id}`} key={relatedItem.id}><CompanyMark ticker={relatedItem.ticker}/><span><b>{relatedItem.company_name}</b><small>{relatedItem.title}</small></span><em className={relatedMetrics.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(relatedMetrics.returnPct)}</em><ArrowUpRight size={15}/></Link>; })}</div></section>}

        <AuthorAttribution profile={author} authorId={item.created_by} label={isArabic ? "أعدها ونشرها" : "RESEARCHED & PUBLISHED BY"}/>
        <footer className="report-disclaimer-v21"><ShieldAlert size={14}/>{isArabic ? "هذه التوصية مبنية على تحليل أساسي عام ولا تمثل نصيحة استثمارية شخصية. السعر المستهدف تقديري وقد لا يتحقق." : "This idea is based on general fundamental analysis and is not personalised investment advice. The target price is an estimate and may not be achieved."}</footer>
      </main>
    </div>
  );
}

function CaseCard({ tone, eyebrow, title, icon, points }) {
  return <article className={`panel-v21 padded-v21 case-card-v3 ${tone}`}><span className="eyebrow">{eyebrow}</span><h2>{icon}{title}</h2><ul>{points?.length ? points.map((point, index) => <li key={index}>{point}</li>) : <li>—</li>}</ul></article>;
}
