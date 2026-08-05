import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  LineChart,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import AuthorAttribution from "../components/AuthorAttribution";
import CompanyMark from "../components/CompanyMark";
import DashboardHeader from "../components/DashboardHeader";
import Reveal from "../components/Reveal";
import { useLanguage } from "../context/LanguageContext";
import {
  buildMonthlyTrackRecord,
  dateTimeLabel,
  formatNumber,
  formatPercent,
  monthLabel,
} from "../lib/calculations";
import { buildNewsItems, mapProfiles } from "../lib/content";
import { recommendationMetrics, recommendationSummary } from "../lib/recommendations";
import { RECOMMENDATION_IMAGE_TITLE } from "../lib/recommendationMedia";
import { supabase } from "../lib/supabase";

async function loadPortalData() {
  const [portfolioResult, monthResult, recommendationResult, reportResult, priceResult, profileResult, updateResult, peakResult] = await Promise.all([
    supabase.from("portfolios").select("*").eq("is_published", true).order("updated_at", { ascending: false }),
    supabase.from("strategy_months").select("*, holdings(*)").eq("is_published", true).order("month_key", { ascending: true }),
    supabase.from("recommendations").select("*").eq("is_published", true).order("recommendation_date", { ascending: false }),
    supabase.from("weekly_reports").select("*").eq("is_published", true).order("week_end", { ascending: false }).limit(12),
    supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
    supabase.from("profiles").select("*"),
    supabase.from("recommendation_updates").select("*").order("update_date", { ascending: false }).limit(80),
    supabase.from("portfolio_peak_alpha").select("*"),
  ]);

  const error = portfolioResult.error || monthResult.error || recommendationResult.error || reportResult.error || priceResult.error;
  if (error) throw error;

  return {
    portfolios: portfolioResult.data || [],
    months: monthResult.data || [],
    recommendations: recommendationResult.data || [],
    reports: reportResult.data || [],
    prices: Object.fromEntries((priceResult.data || []).map((row) => [String(row.ticker || "").toUpperCase(), row])),
    profiles: profileResult.data || [],
    updates: (updateResult.data || []).filter((row) => row.title !== RECOMMENDATION_IMAGE_TITLE),
    peaks: Object.fromEntries((peakResult.data || []).map((row) => [row.portfolio_id, row])),
  };
}

export default function HomePortal() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [data, setData] = useState({ portfolios: [], months: [], recommendations: [], reports: [], prices: {}, profiles: [], updates: [], peaks: {} });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setData(await loadPortalData());
      setMessage("");
    } catch (error) {
      setMessage(error.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("alpha-home-portal-v38")
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolios" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "strategy_months" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "recommendations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_reports" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_prices" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const profileMap = useMemo(() => mapProfiles(data.profiles), [data.profiles]);
  const recommendationSummaryData = useMemo(() => recommendationSummary(data.recommendations, data.prices), [data.recommendations, data.prices]);
  const newsItems = useMemo(() => buildNewsItems({ reports: data.reports, recommendations: data.recommendations, updates: data.updates }), [data.reports, data.recommendations, data.updates]);

  const portfolioCards = useMemo(() => data.portfolios.map((portfolio) => {
    const months = data.months.filter((month) => month.portfolio_id === portfolio.id);
    const track = buildMonthlyTrackRecord(months, locale);
    const latest = track.at(-1) || null;
    const latestMonth = months.find((month) => month.month_key === latest?.month) || months.at(-1) || null;
    return {
      portfolio,
      latest,
      latestMonth,
      holdingsCount: latestMonth?.holdings?.length || 0,
      peak: data.peaks[portfolio.id] || null,
      author: profileMap[portfolio.created_by],
    };
  }), [data.portfolios, data.months, data.peaks, profileMap, locale]);

  const latestPublications = newsItems.slice(0, 6);
  const marketNews = newsItems.filter((item) => item.kind === "report" || item.kind === "update").slice(0, 4);
  const activeRecommendations = data.recommendations.filter((item) => item.status === "open").slice(0, 6);
  const leadingPortfolio = portfolioCards[0];

  return (
    <div className="dashboard-shell home-portal-shell-v38">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="home-portal-v38">
        <Reveal as="section" className="home-portal-hero-v38">
          <div className="home-portal-hero-copy-v38">
            <span className="eyebrow">ALPHA PLATFORM · MEMBER INTELLIGENCE</span>
            <h1>{isArabic ? "كل ما تحتاجه لاتخاذ القرار في شاشة واحدة" : "Your complete investment intelligence portal"}</h1>
            <p>{isArabic ? "المحافظ والتوصيات والتقارير وأخبار السوق مرتبة في رحلة واضحة وسريعة، بدون الحاجة للبحث داخل صفحات متعددة." : "Portfolios, recommendations, publications and market updates organised into one clear, fast decision journey."}</p>
            <div className="home-portal-hero-actions-v38">
              <Link className="button primary" to="/portfolios"><WalletCards size={16}/>{isArabic ? "استعراض المحافظ" : "Explore portfolios"}</Link>
              <Link className="button subtle" to="/recommendations"><TrendingUp size={16}/>{isArabic ? "متابعة التوصيات" : "Track recommendations"}</Link>
            </div>
          </div>
          <div className="home-portal-pulse-v38" aria-label={isArabic ? "ملخص المنصة" : "Platform summary"}>
            <div className="home-portal-pulse-ring-v38"><Sparkles/><b>{formatPercent(leadingPortfolio?.latest?.cumulativeAlpha || 0)}</b><span>{isArabic ? "ألفا تراكمية للمحفظة الأحدث" : "Latest portfolio cumulative Alpha"}</span></div>
            <div className="home-portal-pulse-stats-v38">
              <span><small>{isArabic ? "محافظ منشورة" : "Published portfolios"}</small><b>{portfolioCards.length}</b></span>
              <span><small>{isArabic ? "توصيات مفتوحة" : "Open calls"}</small><b>{recommendationSummaryData.open}</b></span>
              <span><small>{isArabic ? "إصدارات حديثة" : "Recent publications"}</small><b>{latestPublications.length}</b></span>
            </div>
          </div>
        </Reveal>

        <Reveal as="section" className="home-section-v38" delay={50}>
          <SectionHeading
            eyebrow="PORTFOLIO OVERVIEW"
            title={isArabic ? "نظرة سريعة على المحافظ الرئيسية" : "Main portfolio performance at a glance"}
            copy={isArabic ? "كل بطاقة تعرض أداء الشهر الحالي والألفا التراكمية وآخر فترة منشورة." : "Each card surfaces current-month performance, cumulative Alpha and the latest published period."}
            link="/portfolios"
            linkLabel={isArabic ? "كل المحافظ" : "All portfolios"}
          />
          {loading ? <CardSkeletons count={3}/> : <div className="home-portfolio-grid-v38">
            {portfolioCards.slice(0, 4).map(({ portfolio, latest, latestMonth, holdingsCount, peak, author }) => (
              <article className="home-portfolio-card-v38" key={portfolio.id}>
                <div className="home-portfolio-card-top-v38"><span className={`status-pill small ${latest?.isClosed ? "final" : "live"}`}>{latest?.isClosed ? (isArabic ? "نهائي" : "Final") : (isArabic ? "مباشر" : "Live")}</span><Activity size={18}/></div>
                <h2>{portfolio.name}</h2>
                <p>{portfolio.description || portfolio.strategy_name || (isArabic ? "محفظة استثمارية منشورة على ALPHA." : "Published ALPHA investment strategy.")}</p>
                <div className="home-portfolio-metrics-v38">
                  <Metric label={isArabic ? "أداء الشهر" : "Current month"} value={formatPercent(latest?.portfolio || 0)} tone={(latest?.portfolio || 0) >= 0 ? "positive" : "negative"}/>
                  <Metric label={isArabic ? "المؤشر" : "Benchmark"} value={formatPercent(latest?.benchmark || 0)} tone="benchmark"/>
                  <Metric label={isArabic ? "ألفا تراكمية" : "Cumulative Alpha"} value={formatPercent(latest?.cumulativeAlpha || 0)} tone={(latest?.cumulativeAlpha || 0) >= 0 ? "positive" : "negative"}/>
                </div>
                <div className="home-portfolio-meta-v38"><span><CalendarDays size={14}/>{latest?.month ? monthLabel(latest.month, false, locale) : "—"}</span><span><WalletCards size={14}/>{holdingsCount} {isArabic ? "أسهم" : "holdings"}</span>{peak && <span><Target size={14}/>{isArabic ? "أعلى ألفا" : "Peak Alpha"} {formatPercent(peak.peak_alpha || 0)}</span>}</div>
                <footer><AuthorAttribution profile={author} authorId={portfolio.created_by} compact/><Link to={`/portfolio/${portfolio.slug}`}>{isArabic ? "فتح المحفظة" : "Open portfolio"}<ArrowUpRight size={15}/></Link></footer>
              </article>
            ))}
            {!portfolioCards.length && <EmptyCard text={isArabic ? "لا توجد محافظ منشورة حتى الآن." : "No published portfolios yet."}/>} 
          </div>}
        </Reveal>

        <Reveal as="section" className="home-section-v38" delay={80}>
          <SectionHeading
            eyebrow="LATEST PUBLICATIONS"
            title={isArabic ? "أحدث الإصدارات" : "Latest publications & insights"}
            copy={isArabic ? "تقارير وتحليلات وتحديثات مرتبة حسب تاريخ النشر مع وقت القراءة المتوقع." : "Reports, analysis and platform updates ordered by publication date with estimated reading time."}
            link="/news"
            linkLabel={isArabic ? "كل الإصدارات" : "View all publications"}
          />
          <div className="home-publications-track-v38">
            {latestPublications.map((item) => <Link className={`home-publication-card-v38 ${item.accent}`} to={item.route} key={`${item.kind}-${item.id}`}>
              <div className="home-publication-icon-v38">{item.kind === "report" ? <FileText/> : item.kind === "update" ? <LineChart/> : <BookOpen/>}</div>
              <span>{item.category}</span>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div><small><Clock3 size={13}/>{item.readTime} {isArabic ? "دقائق" : "min"}</small><small>{dateTimeLabel(item.publishedAt, locale)}</small></div>
              <b>{isArabic ? "فتح الإصدار" : "Open publication"}<ArrowUpRight size={14}/></b>
            </Link>)}
            {!latestPublications.length && <EmptyCard text={isArabic ? "لا توجد إصدارات منشورة." : "No publications available."}/>} 
          </div>
        </Reveal>

        <Reveal as="section" className="home-section-v38" delay={110}>
          <SectionHeading
            eyebrow="MARKET NEWS"
            title={isArabic ? "نشرتنا الإخبارية" : "Market news & daily intelligence"}
            copy={isArabic ? "أهم الأخبار والتحديثات المالية في بطاقات قصيرة وسهلة المتابعة." : "The most relevant market and financial updates in concise, easy-to-scan cards."}
            link="/news"
            linkLabel={isArabic ? "غرفة الأخبار" : "Open newsroom"}
          />
          <div className="home-news-grid-v38">
            {marketNews.map((item, index) => <Link className={`home-news-card-v38 ${index === 0 ? "lead" : ""}`} to={item.route} key={`${item.kind}-${item.id}`}>
              <div><Newspaper/><span>{item.category}</span></div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <footer><small>{dateTimeLabel(item.publishedAt, locale)}</small><ArrowUpRight size={16}/></footer>
            </Link>)}
            {!marketNews.length && <EmptyCard text={isArabic ? "لا توجد أخبار منشورة." : "No market news available."}/>} 
          </div>
        </Reveal>

        <Reveal as="section" className="home-section-v38" delay={140}>
          <SectionHeading
            eyebrow="ACTIVE RECOMMENDATIONS"
            title={isArabic ? "ملخص التوصيات" : "Active recommendation summary"}
            copy={isArabic ? "العائد الحالي والمتبقي للمستهدف وعمر التوصية ظاهر مباشرة بدون فتح التفاصيل." : "Current return, remaining upside and recommendation age are visible before opening the full research."}
            link="/recommendations"
            linkLabel={isArabic ? "كل التوصيات" : "All recommendations"}
          />
          <div className="home-recommendations-grid-v38">
            {activeRecommendations.map((item) => {
              const metrics = recommendationMetrics(item, data.prices);
              return <Link className="home-recommendation-card-v38" to={`/recommendations/${item.id}`} key={item.id}>
                <header><CompanyMark ticker={item.ticker} name={item.company_name} image={item.company_logo_url}/><div><b>{item.ticker}</b><small>{item.company_name}</small></div><span>{item.action_status === "hold" ? (isArabic ? "احتفظ" : "Hold") : (isArabic ? "استثمر" : "Invest")}</span></header>
                <div className="home-recommendation-return-v38"><span><small>{isArabic ? "العائد حتى الآن" : "Return so far"}</small><b className={metrics.returnPct >= 0 ? "positive" : "negative"}>{formatPercent(metrics.returnPct)}</b></span><span><small>{isArabic ? "المتبقي للمستهدف" : "Remaining upside"}</small><b className={metrics.upsideToTarget >= 0 ? "positive" : "negative"}>{formatPercent(metrics.upsideToTarget)}</b></span></div>
                <div className="home-recommendation-prices-v38"><Metric label={isArabic ? "دخول" : "Entry"} value={formatNumber(item.entry_price, 2, locale)}/><Metric label={isArabic ? "حالي" : "Current"} value={formatNumber(metrics.currentPrice, 2, locale)}/><Metric label={isArabic ? "مستهدف" : "Target"} value={formatNumber(item.target_price, 2, locale)}/></div>
                <footer><span><Clock3 size={14}/>{isArabic ? `صدرت منذ ${metrics.durationDays} يوم` : `Issued ${metrics.durationDays} day${metrics.durationDays === 1 ? "" : "s"} ago`}</span><b>{isArabic ? "فتح" : "Open"}<ArrowUpRight size={14}/></b></footer>
              </Link>;
            })}
            {!activeRecommendations.length && <EmptyCard text={isArabic ? "لا توجد توصيات مفتوحة حاليًا." : "No active recommendations at present."}/>} 
          </div>
        </Reveal>

        <section className="home-trust-strip-v38"><ShieldCheck/><div><b>{isArabic ? "سجل استثماري مؤرخ وشفاف" : "A transparent, time-stamped investment record"}</b><p>{isArabic ? "جميع الأرقام مأخوذة من نفس مصادر البيانات والحسابات المستخدمة في صفحات المحافظ والتوصيات الحالية." : "Every number uses the same existing portfolio and recommendation calculations already used across the platform."}</p></div></section>
      </main>
    </div>
  );
}

function SectionHeading({ eyebrow, title, copy, link, linkLabel }) {
  return <div className="home-section-heading-v38"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{copy}</p></div><Link to={link}>{linkLabel}<ArrowUpRight size={15}/></Link></div>;
}

function Metric({ label, value, tone = "" }) {
  return <span className={tone}><small>{label}</small><b>{value}</b></span>;
}

function EmptyCard({ text }) {
  return <div className="home-empty-card-v38"><Sparkles/><p>{text}</p></div>;
}

function CardSkeletons({ count = 3 }) {
  return <div className="home-portfolio-grid-v38">{Array.from({ length: count }, (_, index) => <div className="home-card-skeleton-v38" key={index}/>)}</div>;
}
