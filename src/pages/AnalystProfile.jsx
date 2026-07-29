import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Award, BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, Newspaper, PenSquare, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { authorDisplay } from "../components/AuthorAttribution";
import CompanyMark from "../components/CompanyMark";
import DashboardHeader from "../components/DashboardHeader";
import Reveal from "../components/Reveal";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { canAccessCreatorStudio } from "../lib/access";
import { buildMonthlyTrackRecord, dateTimeLabel, formatNumber, formatPercent } from "../lib/calculations";
import { recommendationMetrics } from "../lib/recommendations";
import { supabase } from "../lib/supabase";

async function loadAnalyst(id) {
  const [profileResult, portfolioResult, monthResult, recommendationResult, reportResult, priceResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("portfolios").select("*").eq("created_by", id).eq("is_published", true).order("created_at", { ascending: false }),
    supabase.from("strategy_months").select("*, holdings(*)").eq("is_published", true).order("month_key", { ascending: true }),
    supabase.from("recommendations").select("*").eq("created_by", id).eq("is_published", true).order("recommendation_date", { ascending: false }),
    supabase.from("weekly_reports").select("*").eq("created_by", id).eq("is_published", true).order("week_end", { ascending: false }),
    supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
  ]);
  const error = portfolioResult.error || monthResult.error || recommendationResult.error || reportResult.error || priceResult.error;
  if (error) throw error;
  return {
    profile: profileResult.data || { id, full_name: "ALPHA Platform Author", title: "Investment Analyst" },
    portfolios: portfolioResult.data || [],
    months: monthResult.data || [],
    recommendations: recommendationResult.data || [],
    reports: reportResult.data || [],
    prices: priceResult.data || [],
  };
}

export default function AnalystProfile() {
  const { id } = useParams();
  const { profile: currentProfile } = useAuth();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAnalyst(id).then(setData).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, [id]);

  const analytics = useMemo(() => {
    if (!data) return null;
    const priceMap = Object.fromEntries(data.prices.map((row) => [String(row.ticker).toUpperCase(), row]));
    const evaluated = data.recommendations.map((item) => ({ item, metrics: recommendationMetrics(item, priceMap) }));
    const open = evaluated.filter((row) => row.metrics.isOpen);
    const closed = evaluated.filter((row) => !row.metrics.isOpen);
    const averageReturn = evaluated.length ? evaluated.reduce((sum, row) => sum + Number(row.metrics.returnPct || 0), 0) / evaluated.length : 0;
    const averageDays = evaluated.length ? evaluated.reduce((sum, row) => sum + Number(row.metrics.durationDays || 0), 0) / evaluated.length : 0;
    const successRate = closed.length ? closed.filter((row) => Number(row.metrics.returnPct || 0) > 0).length / closed.length * 100 : 0;
    const alpha = evaluated.reduce((sum, row) => sum + Number(row.metrics.alpha || 0), 0);
    const portfolioCards = data.portfolios.map((portfolio) => {
      const months = data.months.filter((month) => month.portfolio_id === portfolio.id);
      const track = buildMonthlyTrackRecord(months, locale);
      return { portfolio, latest: track.at(-1) || {}, months };
    });
    return { evaluated, open, closed, averageReturn, averageDays, successRate, alpha, portfolioCards };
  }, [data, locale]);

  if (loading) return <div className="screen-loader"><div className="loader-ring"/></div>;
  if (!data?.profile) return <div className="dashboard-shell"><DashboardHeader/><main className="empty-state-v21"><ShieldCheck size={50}/><h1>{isArabic ? "الملف غير موجود" : "Analyst profile not found"}</h1><Link className="button gold" to="/portfolios">{isArabic ? "العودة للمحافظ" : "Back to portfolios"}</Link></main></div>;

  const author = authorDisplay(data.profile, { title: data.profile.is_admin ? "Platform Administrator" : "Investment Analyst" });
  return (
    <div className="dashboard-shell analyst-shell-v32">
      <DashboardHeader/>
      {message && <div className="notice-bar">{message}</div>}
      <main className="analyst-page-v32">
        <Link className="back-link" to="/portfolios"><ArrowLeft size={16}/>{isArabic ? "المحافظ" : "Portfolios"}</Link>
        <Reveal as="section" className="analyst-hero-v32">
          <div className="analyst-avatar-v32">{author.avatar ? <img src={author.avatar} alt={author.fullName}/> : author.initials}</div>
          <div className="analyst-identity-v32"><span className="eyebrow">ALPHA PLATFORM · AUTHOR PROFILE</span><h1>{author.fullName}</h1><h2>{author.role}</h2><p>{author.bio}</p><div><span><ShieldCheck/>Verified platform author</span><span><CalendarDays/>Member since {new Date(data.profile.created_at || Date.now()).toLocaleDateString(locale, { month: "short", year: "numeric" })}</span></div>{currentProfile?.id === id && canAccessCreatorStudio(currentProfile) && <Link className="button primary analyst-publish-v33" to="/admin/publishing"><PenSquare/>{isArabic ? "إنشاء ونشر مادة" : "Create & publish"}</Link>}</div>
          <div className="analyst-score-v32"><Award/><small>{isArabic ? "نسبة النجاح" : "SUCCESS RATE"}</small><b>{formatPercent(analytics.successRate)}</b><span>{analytics.closed.length} {isArabic ? "توصية مغلقة" : "closed calls"}</span></div>
        </Reveal>

        <Reveal as="section" className="analyst-kpis-v32" delay={60}>
          <Kpi icon={<BriefcaseBusiness/>} label={isArabic ? "محافظ منشورة" : "Published portfolios"} value={String(data.portfolios.length)}/>
          <Kpi icon={<Target/>} label={isArabic ? "توصيات مفتوحة" : "Open recommendations"} value={String(analytics.open.length)}/>
          <Kpi icon={<CheckCircle2/>} label={isArabic ? "توصيات مغلقة" : "Closed recommendations"} value={String(analytics.closed.length)}/>
          <Kpi icon={<TrendingUp/>} label={isArabic ? "متوسط العائد" : "Average return"} value={formatPercent(analytics.averageReturn)} tone={analytics.averageReturn >= 0 ? "positive" : "negative"}/>
          <Kpi icon={<Clock3/>} label={isArabic ? "متوسط مدة الاحتفاظ" : "Average holding period"} value={`${formatNumber(analytics.averageDays, 0, locale)} ${isArabic ? "يوم" : "days"}`}/>
          <Kpi icon={<Sparkles/>} label={isArabic ? "الألفا المولدة" : "Alpha generated"} value={formatPercent(analytics.alpha)} tone={analytics.alpha >= 0 ? "positive" : "negative"}/>
        </Reveal>

        <Reveal as="section" className="analyst-section-v32" delay={90}>
          <div className="section-heading-inline-v32"><div><span className="eyebrow">MANAGED PORTFOLIOS</span><h2>{isArabic ? "المحافظ التي يديرها" : "Portfolios created and managed"}</h2></div></div>
          <div className="analyst-portfolio-grid-v32">{analytics.portfolioCards.map(({ portfolio, latest }) => <Link to={`/portfolio/${portfolio.slug}`} key={portfolio.id}><span><BriefcaseBusiness/></span><div><small>{portfolio.strategy_name || "PORTFOLIO"}</small><h3>{isArabic && portfolio.name_ar ? portfolio.name_ar : portfolio.name}</h3><p>{portfolio.description || "Published investment portfolio."}</p></div><b className={Number(latest.cumulativePortfolio || 0) >= 0 ? "positive" : "negative"}>{formatPercent(latest.cumulativePortfolio)}</b><ArrowUpRight/></Link>)}{!analytics.portfolioCards.length && <div className="empty-inline-v32">{isArabic ? "لا توجد محافظ منشورة لهذا المحلل." : "No published portfolios for this analyst."}</div>}</div>
        </Reveal>

        <div className="analyst-content-grid-v32">
          <Reveal as="section" className="analyst-section-v32" delay={110}>
            <div className="section-heading-inline-v32"><div><span className="eyebrow">OPEN TRADES</span><h2>{isArabic ? "التوصيات المفتوحة" : "Open recommendation history"}</h2></div><span>{analytics.open.length}</span></div>
            <RecommendationList rows={analytics.open} isArabic={isArabic} locale={locale}/>
          </Reveal>
          <Reveal as="section" className="analyst-section-v32" delay={130}>
            <div className="section-heading-inline-v32"><div><span className="eyebrow">CLOSED TRADES</span><h2>{isArabic ? "السجل المغلق" : "Closed recommendation history"}</h2></div><span>{analytics.closed.length}</span></div>
            <RecommendationList rows={analytics.closed} isArabic={isArabic} locale={locale}/>
          </Reveal>
        </div>

        <Reveal as="section" className="analyst-section-v32" delay={150}>
          <div className="section-heading-inline-v32"><div><span className="eyebrow">PUBLISHED INTELLIGENCE</span><h2>{isArabic ? "الأبحاث والتقارير المنشورة" : "Published research, reports and insights"}</h2></div></div>
          <div className="analyst-publications-v32">
            {data.reports.map((report) => <Link to={`/news/report/${report.id}`} key={report.id}><Newspaper/><span><small>WEEKLY REPORT · {dateTimeLabel(report.published_at || report.week_end, locale)}</small><b>{report.title}</b><p>{report.summary}</p></span><ArrowUpRight/></Link>)}
            {analytics.evaluated.slice(0, 8).map(({ item }) => <Link to={`/news/recommendation/${item.id}`} key={item.id}><BookOpen/><span><small>EQUITY RESEARCH · {item.ticker}</small><b>{item.title}</b><p>{item.thesis || item.why_selected || item.company_story}</p></span><ArrowUpRight/></Link>)}
            {!data.reports.length && !analytics.evaluated.length && <div className="empty-inline-v32">{isArabic ? "لا توجد منشورات بعد." : "No published intelligence yet."}</div>}
          </div>
        </Reveal>
      </main>
    </div>
  );
}

function Kpi({ icon, label, value, tone = "" }) {
  return <article className={tone}><span>{icon}</span><small>{label}</small><b>{value}</b></article>;
}

function RecommendationList({ rows, isArabic, locale }) {
  if (!rows.length) return <div className="empty-inline-v32">{isArabic ? "لا توجد سجلات في هذه الفئة." : "No records in this category."}</div>;
  return <div className="analyst-recommendations-v32">{rows.map(({ item, metrics }) => <Link to={`/recommendations/${item.id}`} key={item.id}><CompanyMark ticker={item.ticker} name={item.company_name}/><span><small>{item.sector || "EGX"}</small><b>{item.company_name}</b><em>{item.ticker} · {dateTimeLabel(item.recommendation_date, locale)}</em></span><strong className={metrics.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(metrics.returnPct)}</strong><ArrowUpRight/></Link>)}</div>;
}
