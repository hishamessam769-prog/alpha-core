import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, BriefcaseBusiness, CalendarDays, Layers3, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import AuthorAttribution from "../components/AuthorAttribution";
import DashboardHeader from "../components/DashboardHeader";
import MarketGraphic from "../components/MarketGraphic";
import Reveal from "../components/Reveal";
import { useLanguage } from "../context/LanguageContext";
import { buildMonthlyTrackRecord, calculateMonth, dateTimeLabel, formatPercent, monthLabel } from "../lib/calculations";
import { mapProfiles } from "../lib/content";
import { supabase } from "../lib/supabase";

async function loadPortfolioIndex() {
  const [portfolioResult, monthResult, profileResult] = await Promise.all([
    supabase.from("portfolios").select("*").eq("is_published", true).order("created_at", { ascending: true }),
    supabase.from("strategy_months").select("*, holdings(*), portfolio_events(*, portfolio_event_allocations(*))").eq("is_published", true).order("month_key", { ascending: true }),
    supabase.from("profiles").select("*"),
  ]);
  const error = portfolioResult.error || monthResult.error;
  if (error) throw error;
  return { portfolios: portfolioResult.data || [], months: monthResult.data || [], profiles: profileResult.data || [] };
}

export default function PortfoliosIndex() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [data, setData] = useState({ portfolios: [], months: [], profiles: [] });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPortfolioIndex().then(setData).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  const profileMap = useMemo(() => mapProfiles(data.profiles), [data.profiles]);
  const cards = useMemo(() => data.portfolios.map((portfolio) => {
    const months = data.months.filter((month) => month.portfolio_id === portfolio.id);
    const track = buildMonthlyTrackRecord(months, locale);
    const latest = track.at(-1) || {};
    const latestMonth = months.at(-1) || null;
    return {
      portfolio,
      months,
      track,
      latest,
      latestMonth,
      author: profileMap[portfolio.created_by],
      holdings: latestMonth ? calculateMonth(latestMonth).rows.filter((row) => !row.is_cash).length : 0,
    };
  }), [data.portfolios, data.months, profileMap, locale]);

  const visible = cards.filter(({ portfolio }) => {
    const haystack = `${portfolio.name || ""} ${portfolio.name_ar || ""} ${portfolio.description || ""} ${portfolio.strategy_name || ""}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  });

  const totalAlpha = cards.reduce((sum, card) => sum + Number(card.latest.cumulativeAlpha || 0), 0);
  const best = [...cards].sort((a, b) => Number(b.latest.cumulativePortfolio || 0) - Number(a.latest.cumulativePortfolio || 0))[0];

  return (
    <div className="dashboard-shell portfolios-index-shell-v32">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="portfolios-index-v32">
        <Reveal as="section" className="portfolios-index-hero-v32">
          <div className="portfolios-hero-copy-v32">
            <span className="eyebrow">INSTITUTIONAL PORTFOLIO LIBRARY</span>
            <h1>{isArabic ? "كل استراتيجية. سجل كامل. نتيجة واضحة." : "Every strategy. A complete record. A clear result."}</h1>
            <p>{isArabic ? "استعرض المحافظ المنشورة في بطاقات أداء سريعة ثم افتح التقرير الكامل لكل شهر وقرار." : "Scan published portfolios through high-signal performance cards, then open the complete monthly factsheet and decision history."}</p>
            <div className="portfolio-hero-stats-v32">
              <span><BriefcaseBusiness/><small>{isArabic ? "محافظ منشورة" : "Published portfolios"}</small><b>{cards.length}</b></span>
              <span><Sparkles/><small>{isArabic ? "إجمالي الألفا" : "Combined Alpha"}</small><b className={totalAlpha >= 0 ? "positive" : "negative"}>{formatPercent(totalAlpha)}</b></span>
              <span><TrendingUp/><small>{isArabic ? "الأفضل أداءً" : "Top performer"}</small><b>{best?.portfolio?.name || "—"}</b></span>
            </div>
          </div>
          <MarketGraphic compact label="PORTFOLIO INTELLIGENCE" />
        </Reveal>

        <Reveal as="section" className="portfolio-index-toolbar-v32" delay={60}>
          <div><span className="eyebrow">PORTFOLIOS</span><h2>{isArabic ? "المحافظ المنشورة" : "Published portfolio strategies"}</h2></div>
          <label><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "ابحث باسم المحفظة أو الاستراتيجية" : "Search portfolio or strategy"}/></label>
        </Reveal>

        {loading ? <div className="portfolio-card-grid-v32">{[0,1,2].map((item) => <div className="portfolio-card-v32 skeleton-card-v32" key={item}/>)}</div> : (
          <section className="portfolio-card-grid-v32">
            {visible.map((card, index) => {
              const name = isArabic && card.portfolio.name_ar ? card.portfolio.name_ar : card.portfolio.name;
              const positive = Number(card.latest.cumulativePortfolio || 0) >= 0;
              return (
                <Reveal as="article" className="portfolio-card-v32" delay={Math.min(index * 70, 280)} key={card.portfolio.id}>
                  <div className="portfolio-card-glow-v32"/>
                  <header>
                    <span className="portfolio-card-icon-v32"><BriefcaseBusiness/></span>
                    <div><small>{card.portfolio.strategy_name || "EGX EQUITY STRATEGY"}</small><h2>{name}</h2></div>
                    <span className={`portfolio-return-badge-v32 ${positive ? "positive" : "negative"}`}><small>{isArabic ? "منذ الإطلاق" : "SINCE LAUNCH"}</small><b>{formatPercent(card.latest.cumulativePortfolio)}</b></span>
                  </header>
                  <p>{card.portfolio.description || (isArabic ? "محفظة منشورة بسجل أداء وقرارات كامل." : "A published portfolio with a complete performance and decision record.")}</p>
                  <PortfolioSparkline track={card.track}/>
                  <div className="portfolio-card-metrics-v32">
                    <Metric icon={<BarChart3/>} label={isArabic ? "المؤشر" : "Benchmark"} value={formatPercent(card.latest.cumulativeBenchmark)}/>
                    <Metric icon={<Sparkles/>} label="Alpha" value={formatPercent(card.latest.cumulativeAlpha)} tone={Number(card.latest.cumulativeAlpha || 0) >= 0 ? "positive" : "negative"}/>
                    <Metric icon={<Layers3/>} label={isArabic ? "المراكز" : "Holdings"} value={String(card.holdings)}/>
                    <Metric icon={<CalendarDays/>} label={isArabic ? "آخر شهر" : "Latest month"} value={card.latestMonth?.month_key ? monthLabel(card.latestMonth.month_key, true, locale) : "—"}/>
                  </div>
                  <div className="portfolio-card-status-v32"><ShieldCheck size={15}/><span>{isArabic ? "سجل منشور وقابل للمراجعة" : "Published, auditable track record"}</span><em>{dateTimeLabel(card.latestMonth?.updated_at || card.portfolio.updated_at, locale)}</em></div>
                  <footer>
                    <AuthorAttribution profile={card.author} authorId={card.portfolio.created_by} compact />
                    <Link className="portfolio-open-v32" to={`/portfolio/${card.portfolio.slug}`}>{isArabic ? "فتح المحفظة" : "Open portfolio"}<ArrowUpRight size={16}/></Link>
                  </footer>
                </Reveal>
              );
            })}
            {!visible.length && <div className="empty-state-v21"><Search size={42}/><h2>{isArabic ? "لا توجد محافظ مطابقة" : "No matching portfolios"}</h2></div>}
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ icon, label, value, tone = "" }) {
  return <span className={tone}>{icon}<small>{label}</small><b>{value}</b></span>;
}

function PortfolioSparkline({ track = [] }) {
  const values = track.map((item) => Number(item.cumulativePortfolio || 0));
  const safe = values.length ? values : [0, 0];
  const min = Math.min(...safe, 0);
  const max = Math.max(...safe, 0);
  const span = max - min || 1;
  const points = safe.map((value, index) => `${(index / Math.max(1, safe.length - 1)) * 100},${44 - ((value - min) / span) * 36}`).join(" ");
  return <div className="portfolio-sparkline-v32"><svg viewBox="0 0 100 48" preserveAspectRatio="none"><polyline points={points} fill="none" vectorEffect="non-scaling-stroke"/></svg><span>LAUNCH</span><span>NOW</span></div>;
}
