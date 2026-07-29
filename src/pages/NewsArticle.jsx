import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Clock3, ExternalLink, LineChart, Newspaper, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import AuthorAttribution from "../components/AuthorAttribution";
import DashboardHeader from "../components/DashboardHeader";
import InsightDrawer from "../components/InsightDrawer";
import RichArticleContent from "../components/RichArticleContent";
import Reveal from "../components/Reveal";
import { useLanguage } from "../context/LanguageContext";
import { articleReadTime } from "../lib/content";
import { dateTimeLabel, formatNumber, formatPercent } from "../lib/calculations";
import { recommendationMetrics } from "../lib/recommendations";
import { supabase } from "../lib/supabase";

async function loadArticle(kind, id) {
  if (kind === "report") {
    const { data, error } = await supabase.from("weekly_reports").select("*").eq("id", id).eq("is_published", true).maybeSingle();
    if (error) throw error;
    return { record: data, parent: null };
  }
  if (kind === "recommendation") {
    const [{ data, error }, { data: prices, error: priceError }] = await Promise.all([
      supabase.from("recommendations").select("*").eq("id", id).eq("is_published", true).maybeSingle(),
      supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
    ]);
    if (error || priceError) throw (error || priceError);
    return { record: data, parent: null, prices: prices || [] };
  }
  if (kind === "update") {
    const { data, error } = await supabase.from("recommendation_updates").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    let parent = null;
    if (data?.recommendation_id) {
      const result = await supabase.from("recommendations").select("*").eq("id", data.recommendation_id).eq("is_published", true).maybeSingle();
      if (result.error) throw result.error;
      parent = result.data;
    }
    return { record: parent ? data : null, parent };
  }
  return { record: null, parent: null };
}

export default function NewsArticle() {
  const { kind, id } = useParams();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [state, setState] = useState({ record: null, parent: null, prices: [] });
  const [author, setAuthor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLoading(true);
    loadArticle(kind, id).then(async (result) => {
      setState(result);
      const authorId = result.record?.created_by || result.parent?.created_by;
      if (authorId) {
        const profileResult = await supabase.from("profiles").select("*").eq("id", authorId).maybeSingle();
        if (!profileResult.error) setAuthor(profileResult.data);
      }
    }).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, [kind, id]);

  const article = useMemo(() => createArticle(kind, state.record, state.parent, state.prices, isArabic), [kind, state, isArabic]);
  if (loading) return <div className="screen-loader skeleton-loader-v3"><div className="loader-ring"/><p>{isArabic ? "جاري تحميل التحليل…" : "Loading analysis…"}</p></div>;

  if (!article) return <div className="dashboard-shell"><DashboardHeader/><main className="empty-state-v21"><Newspaper size={50}/><h1>{isArabic ? "المقال غير موجود" : "Article not found"}</h1><Link className="button gold" to="/news">{isArabic ? "العودة للأخبار" : "Back to news"}</Link></main></div>;

  const authorId = state.record?.created_by || state.parent?.created_by;
  return (
    <div className="dashboard-shell article-shell-v32">
      <DashboardHeader/>
      {message && <div className="notice-bar">{message}</div>}
      <main className="article-page-v32">
        <Link className="back-link" to="/news"><ArrowLeft size={16}/>{isArabic ? "الأخبار والتحليل" : "News & Analysis"}</Link>
        <Reveal as="header" className={`article-hero-v32 ${article.accent}`}>
          <div className="article-hero-grid-v32"/>
          <div className="article-heading-v32">
            <span className="eyebrow">{article.category}</span>
            <h1>{article.title}</h1>
            <p>{article.summary}</p>
            <div className="article-hero-meta-v32"><span><CalendarDays/>{dateTimeLabel(article.publishedAt, locale)}</span><span><Clock3/>{article.readTime} min read</span><span><ShieldCheck/>{isArabic ? "سجل منشور" : "Published record"}</span></div>
            <AuthorAttribution profile={author} authorId={authorId}/>
          </div>
          <div className="article-hero-art-v32"><LineChart/><b>{article.ticker || "ALPHA"}</b><span>{article.category}</span></div>
        </Reveal>

        <div className="article-layout-v32">
          <Reveal as="article" className="article-body-v32" delay={70}>
            {article.metrics?.length > 0 && <div className="article-metric-strip-v32">{article.metrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><b className={metric.tone || ""}>{metric.value}</b></span>)}</div>}
            <RichArticleContent sections={article.sections}/>
            <div className="article-educational-note-v32"><ShieldCheck/><p>{isArabic ? "المحتوى تعليمي ومعلوماتي عام ولا يمثل نصيحة استثمارية شخصية. راجع ملاءمة القرار لأهدافك وقدرتك على تحمل المخاطر." : "This material is educational and informational only and does not constitute personalised investment advice. Assess suitability against your own objectives and risk tolerance."}</p></div>
            <AuthorAttribution profile={author} authorId={authorId} label={isArabic ? "أعده ونشره" : "RESEARCHED & PUBLISHED BY"}/>
          </Reveal>

          <aside className="article-sidebar-v32">
            <InsightDrawer label={isArabic ? "اشرح هذا التحليل" : "Explain this analysis"} title={article.title} summary={article.aiSummary}/>
            <div className="article-side-card-v32"><Sparkles/><span className="eyebrow">KEY TAKEAWAY</span><h3>{article.keyTakeaway}</h3><p>{article.summary}</p></div>
            {article.sourceRoute && <Link className="button subtle full" to={article.sourceRoute}><ExternalLink size={15}/>{isArabic ? "فتح السجل الأصلي" : "Open original record"}</Link>}
            <Link className="button gold full" to="/news"><BookOpen size={15}/>{isArabic ? "المزيد من التحليلات" : "More intelligence"}<ArrowUpRight size={15}/></Link>
          </aside>
        </div>
      </main>
    </div>
  );
}

function createArticle(kind, record, parent, prices, isArabic) {
  if (!record) return null;
  if (kind === "report") {
    const slug = String(record.slug || "");
    const isMarketNews = slug.startsWith("market-news-");
    const isEconomicUpdate = slug.startsWith("economic-update-");
    const isStandaloneArticle = isMarketNews || isEconomicUpdate;
    const sections = isStandaloneArticle
      ? [
          { eyebrow: isEconomicUpdate ? "ECONOMIC UPDATE" : "MARKET INTELLIGENCE", title: isArabic ? "التحليل الكامل" : "Full analysis", body: record.market_overview },
          { eyebrow: "FORWARD VIEW", title: isArabic ? "ما نراقبه بعد ذلك" : "What to watch next", body: record.watch_next },
        ]
      : [
          { eyebrow: "MARKET RECAP", title: isArabic ? "نظرة السوق" : "Market overview", body: record.market_overview },
          { eyebrow: "PORTFOLIO", title: isArabic ? "تحديث المحافظ" : "Portfolio update", body: record.portfolio_update },
          { eyebrow: "CROSS ASSET", title: isArabic ? "تحديث الذهب" : "Gold update", body: record.gold_update },
          { eyebrow: "FORWARD VIEW", title: isArabic ? "ما نراقبه بعد ذلك" : "What to watch next", body: record.watch_next },
        ];
    const readTime = articleReadTime(record.summary, ...sections.map((section) => section.body));
    return {
      category: isEconomicUpdate ? "ECONOMIC UPDATE" : isMarketNews ? "MARKET NEWS & ANALYSIS" : "RESEARCH REPORT",
      title: record.title,
      summary: record.summary,
      publishedAt: record.published_at || record.updated_at || record.week_end,
      readTime,
      accent: isEconomicUpdate ? "violet" : isMarketNews ? "cyan" : "blue",
      sourceRoute: isStandaloneArticle ? null : `/weekly-reports/${record.slug}`,
      sections,
      keyTakeaway: record.watch_next || record.summary,
      aiSummary: `${record.title}. ${record.summary} Analysis: ${record.market_overview || "Not supplied"}. What to watch: ${record.watch_next || "Not supplied"}.`,
    };
  }
  if (kind === "recommendation") {
    const priceMap = Object.fromEntries((prices || []).map((row) => [String(row.ticker).toUpperCase(), row]));
    const metrics = recommendationMetrics(record, priceMap);
    const sections = [
      { eyebrow: "COMPANY", title: isArabic ? "قصة الشركة" : "Company story", body: record.company_story },
      { eyebrow: "INVESTMENT CASE", title: isArabic ? "لماذا اخترنا السهم" : "Why the stock was selected", body: record.why_selected || record.thesis },
      { eyebrow: "CATALYSTS", title: isArabic ? "الإيجابيات ومحركات الصعود" : "Positives and catalysts", body: record.positives },
      { eyebrow: "RISKS", title: isArabic ? "المخاطر والسلبيات" : "Risks and drawbacks", body: record.risks },
      { eyebrow: "VALUATION", title: isArabic ? "التقييم والسعر المستهدف" : "Valuation and target price", body: record.valuation },
    ];
    return {
      category: record.sector ? `STOCK RECOMMENDATION · ${record.sector}` : "STOCK RECOMMENDATION",
      title: record.title || `${record.company_name} stock recommendation`,
      summary: record.thesis || record.why_selected || record.company_story || `Investment research for ${record.company_name}.`,
      publishedAt: record.recommendation_date || record.published_at || record.updated_at,
      readTime: articleReadTime(...sections.map((section) => section.body)),
      accent: "blue",
      ticker: record.ticker,
      sourceRoute: `/recommendations/${record.id}`,
      metrics: [
        { label: isArabic ? "سعر الدخول" : "Entry", value: formatNumber(record.entry_price, 2, isArabic ? "ar-EG" : "en-GB") },
        { label: isArabic ? "السعر الحالي" : "Current", value: formatNumber(metrics.currentPrice, 2, isArabic ? "ar-EG" : "en-GB") },
        { label: isArabic ? "المستهدف" : "Target", value: formatNumber(record.target_price, 2, isArabic ? "ar-EG" : "en-GB") },
        { label: isArabic ? "العائد" : "Return", value: formatPercent(metrics.returnPct), tone: metrics.returnPct >= 0 ? "positive" : "negative" },
        { label: "Alpha", value: formatPercent(metrics.alpha), tone: metrics.alpha >= 0 ? "positive" : "negative" },
      ],
      sections,
      keyTakeaway: record.why_selected || record.thesis || record.title,
      aiSummary: `${record.company_name} (${record.ticker}) is rated ${record.action_status || "invest"}. Entry ${record.entry_price}, current ${metrics.currentPrice}, target ${record.target_price}, current return ${formatPercent(metrics.returnPct)} and Alpha ${formatPercent(metrics.alpha)}. Thesis: ${record.why_selected || record.thesis || "Not supplied"}. Main risks: ${record.risks || "Not supplied"}.`,
    };
  }
  const title = record.title || `${parent?.company_name || parent?.ticker || "Company"} update`;
  return {
    category: "COMPANY & MARKET UPDATE",
    title,
    summary: record.body || "Published market update.",
    publishedAt: record.update_date || record.created_at || record.updated_at,
    readTime: articleReadTime(record.body),
    accent: "green",
    ticker: parent?.ticker,
    sourceRoute: parent?.id ? `/recommendations/${parent.id}` : "/recommendations",
    sections: [{ eyebrow: parent?.ticker || "UPDATE", title: isArabic ? "تفاصيل التحديث" : "Update details", body: record.body }],
    keyTakeaway: record.body || title,
    aiSummary: `${title}. ${record.body || "No additional details were supplied."}${parent ? ` Related company: ${parent.company_name} (${parent.ticker}).` : ""}`,
  };
}
