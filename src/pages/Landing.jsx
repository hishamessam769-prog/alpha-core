import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, BriefcaseBusiness, Check, FileClock, Globe2, LockKeyhole, Newspaper, ShieldCheck, Sparkles, Target, TrendingUp, UsersRound } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import PlatformFooter from "../components/PlatformFooter";
import PublicHeader from "../components/PublicHeader";
import SetupNotice from "../components/SetupNotice";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { usePlatformSettings } from "../context/SettingsContext";
import { formatPercent } from "../lib/calculations";
import { supabase } from "../lib/supabase";

const previewRows = [
  ["RAYA", "20.00%", "+7.40%", "+1.48%"],
  ["TMGH", "20.00%", "+5.10%", "+1.02%"],
  ["ORAS", "20.00%", "+3.80%", "+0.76%"],
  ["CLHO", "20.00%", "+2.30%", "+0.46%"],
  ["CCAP", "20.00%", "-1.10%", "-0.22%"],
];

const intelligenceCards = [
  { icon: BriefcaseBusiness, tag: "PORTFOLIO", title: "Alpha Core Monthly Factsheet", text: "Current allocation, benchmark-relative performance and the complete decision record.", meta: "Updated monthly" },
  { icon: TrendingUp, tag: "RECOMMENDATION", title: "Independent Equity Recommendations", text: "Clear entry, target, thesis, risks and a permanently dated update history.", meta: "Measured vs benchmark" },
  { icon: Newspaper, tag: "WEEKLY", title: "Egypt Market Weekly", text: "A concise institutional review of the market, portfolios, gold and the week ahead.", meta: "Published weekly" },
];

export default function Landing() {
  const { session, profile, loading } = useAuth();
  const { t, isArabic } = useLanguage();
  const { settings } = usePlatformSettings();
  const [publicStats, setPublicStats] = useState(null);
  const arrow = isArabic ? "←" : "→";

  useEffect(() => {
    if (!supabase) return;
    supabase.rpc("get_public_performance_highlights").then(({ data }) => {
      if (data && typeof data === "object") setPublicStats(data);
    });
  }, []);

  const highlights = useMemo(() => {
    if (publicStats?.has_data) {
      return [
        { value: formatPercent(publicStats.portfolio_return), label_en: "Latest portfolio return", label_ar: "أحدث عائد للمحفظة", detail_en: "Latest published portfolio snapshot", detail_ar: "أحدث لقطة أداء منشورة" },
        { value: formatPercent(publicStats.alpha), label_en: "Latest Alpha", label_ar: "أحدث ألفا", detail_en: `Versus ${publicStats.benchmark_ticker || "benchmark"}`, detail_ar: `مقابل ${publicStats.benchmark_ticker || "المؤشر"}` },
        { value: String(publicStats.open_recommendations || 0), label_en: "Open recommendations", label_ar: "توصيات مفتوحة", detail_en: `${publicStats.portfolios_count || 0} published portfolio(s)`, detail_ar: `${publicStats.portfolios_count || 0} محفظة منشورة` },
      ];
    }
    return settings.landing_highlights || [];
  }, [publicStats, settings.landing_highlights]);

  if (loading) return <div className="screen-loader"><div className="loader-ring"/><p>{t("loading")}</p></div>;
  if (session) return <Navigate to={profile?.is_admin ? "/admin" : "/dashboard"} replace />;

  const priceFeatures = isArabic
    ? (Array.isArray(settings.pricing_features_ar) ? settings.pricing_features_ar : [])
    : (Array.isArray(settings.pricing_features) ? settings.pricing_features : []);
  const previewPortfolio = publicStats?.has_data ? formatPercent(publicStats.portfolio_return) : "+5.00%";
  const previewBenchmark = publicStats?.has_data ? formatPercent(publicStats.benchmark_return) : "+3.10%";
  const previewAlpha = publicStats?.has_data ? formatPercent(publicStats.alpha) : "+1.90%";

  return (
    <div className="public-page landing-v3">
      <PublicHeader />
      <SetupNotice />
      <main>
        <section className="hero-v3">
          <div className="hero-grid-glow"/>
          <div className="hero-copy-v3">
            <div className="institutional-badge"><span className="live-dot"/>{isArabic ? "منصة ذكاء استثماري للأسهم المصرية" : "EGYPTIAN EQUITY INTELLIGENCE PLATFORM"}</div>
            <h1>{isArabic ? <>قرارات استثمارية أوضح.<br/>أداء قابل للقياس.<br/><em>ألفا حقيقية.</em></> : <>Institutional clarity.<br/>Measurable decisions.<br/><em>Real Alpha.</em></>}</h1>
            <p>{isArabic ? "تابع المحافظ والتوصيات والأبحاث والتقارير الأسبوعية في منصة واحدة تعرض النتائج مقابل المؤشر وتحفظ كل قرار وتحديث بشفافية." : "Track portfolios, recommendations, research and weekly market intelligence in one platform that measures every result against its benchmark and preserves every decision."}</p>
            <div className="hero-actions"><Link className="button gold large" to="/signup">{isArabic ? "ابدأ مجانًا" : "Enter the platform"}<span>{arrow}</span></Link><Link className="button glass large" to="/methodology">{isArabic ? "استكشف المنهجية" : "Explore methodology"}</Link></div>
            <div className="hero-trust-v3"><span><ShieldCheck size={15}/>{isArabic ? "سجل أداء دائم" : "Permanent track record"}</span><span><BarChart3 size={15}/>{isArabic ? "قياس مقابل المؤشر" : "Benchmark-relative"}</span><span><LockKeyhole size={15}/>{isArabic ? "صلاحيات مؤسسية" : "Institutional permissions"}</span></div>
          </div>

          <div className="terminal-showcase terminal-v3" aria-label="ALPHA PLATFORM product preview">
            <div className="terminal-window-top"><div className="window-dots"><i/><i/><i/></div><span>ALPHA PLATFORM / PORTFOLIO TERMINAL</span><b><i/> LIVE</b></div>
            <div className="terminal-command-row"><span>ALPHA CORE</span><small>{publicStats?.benchmark_ticker || "EGX30 CAPPED"} · LIVE</small><em>FACTSHEET</em></div>
            <div className="preview-kpis"><PreviewKpi label={t("portfolioMtd")} value={previewPortfolio} tone="blue"/><PreviewKpi label={t("benchmarkMtd")} value={previewBenchmark} tone="gold"/><PreviewKpi label={t("monthlyAlpha")} value={previewAlpha} tone="green"/></div>
            <div className="preview-chart-v21 preview-chart-v3"><div className="preview-chart-labels"><span>12%</span><span>8%</span><span>4%</span><span>0%</span></div><svg viewBox="0 0 600 230" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="areaBlueV3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#37b7ff" stopOpacity=".28"/><stop offset="100%" stopColor="#37b7ff" stopOpacity="0"/></linearGradient></defs><path className="grid-line" d="M0 45H600 M0 95H600 M0 145H600 M0 195H600"/><path className="area-line" d="M0 195 C95 183 150 150 220 156 S340 104 410 112 S525 78 600 58 L600 230 L0 230 Z"/><path className="portfolio-line" d="M0 195 C95 183 150 150 220 156 S340 104 410 112 S525 78 600 58"/><path className="benchmark-line" d="M0 195 C105 185 165 172 230 169 S350 142 420 148 S520 121 600 112"/><path className="alpha-line" d="M0 195 C100 192 165 173 225 181 S345 154 415 162 S520 137 600 126"/></svg><div className="chart-legend"><span className="blue-dot">Portfolio</span><span className="gold-dot">Benchmark</span><span className="white-dot">Alpha</span></div></div>
            <div className="preview-table-wrap"><div className="preview-table-title"><span>CURRENT ALLOCATION</span><small>{isArabic ? "عرض توضيحي للمنصة" : "Platform preview"}</small></div><table className="preview-table"><thead><tr><th>{t("ticker")}</th><th>{t("weight")}</th><th>{t("return")}</th><th>{t("contribution")}</th></tr></thead><tbody>{previewRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index} className={index > 1 ? (cell.startsWith("-") ? "negative" : "positive") : ""}>{cell}</td>)}</tr>)}</tbody></table></div>
            <div className="terminal-statusbar"><span><LockKeyhole size={13}/> INSTITUTIONAL MEMBER VIEW</span><span>{publicStats?.last_updated ? new Date(publicStats.last_updated).toLocaleDateString(isArabic ? "ar-EG" : "en-GB") : "LIVE DATA"}</span></div>
          </div>
        </section>

        <section className="landing-highlight-strip-v31" aria-label={isArabic ? "أبرز نتائج المنصة" : "Platform performance highlights"}>{highlights.slice(0, 3).map((item, index) => <article className="landing-highlight-v31" key={`${item.label_en}-${index}`}><span>0{index + 1}</span><div><b>{item.value}</b><h3>{isArabic ? item.label_ar : item.label_en}</h3><p>{isArabic ? item.detail_ar : item.detail_en}</p></div></article>)}</section>

        <section className="market-tape-v3" aria-label="Platform capabilities"><span>PORTFOLIO INTELLIGENCE</span><i/><span>INDEPENDENT RESEARCH</span><i/><span>BENCHMARK ALPHA</span><i/><span>WEEKLY MARKET REPORTS</span><i/><span>PERMANENT AUDIT TRAIL</span></section>

        <section className="product-proof-section product-proof-v3"><div className="section-heading centered"><span className="eyebrow">INSTITUTIONAL PERFORMANCE VIEW</span><h2>{isArabic ? "كل رقم في مكانه. كل قرار له تاريخ." : "Every number in context. Every decision on record."}</h2><p>{isArabic ? "لوحة أداء واحدة تربط عائد المحفظة بالمؤشر والألفا والتوزيع والقرارات الشهرية." : "One performance view connects portfolio return, benchmark, Alpha, allocation and every monthly decision."}</p></div><div className="six-metric-preview"><PreviewKpi label={t("portfolioMtd")} value={previewPortfolio} tone="blue"/><PreviewKpi label={t("benchmarkMtd")} value={previewBenchmark} tone="gold"/><PreviewKpi label={t("monthlyAlpha")} value={previewAlpha} tone="green"/><PreviewKpi label={t("cumulativePortfolio")} value="+13.40%" tone="blue"/><PreviewKpi label={t("cumulativeBenchmark")} value="+8.20%" tone="gold"/><PreviewKpi label={t("cumulativeAlpha")} value="+5.20%" tone="green"/></div></section>

        <section className="intelligence-section-v3"><div className="section-heading"><span className="eyebrow">LATEST INTELLIGENCE</span><h2>{isArabic ? "الأبحاث والتقارير في تجربة تشبه المجلة الاستثمارية" : "Research and reporting built like a premium investment journal"}</h2><p>{isArabic ? "اقرأ الفرضية والمخاطر والتقييم والتحديثات من غير تشتيت أو مبالغة." : "Read the thesis, risks, valuation and updates without noise or promotional clutter."}</p></div><div className="intelligence-grid-v3">{intelligenceCards.map(({ icon: Icon, tag, title, text, meta }, index) => <article className={index === 0 ? "featured" : ""} key={tag}><div className="magazine-visual"><Icon/><span>0{index + 1}</span></div><span className="eyebrow">{tag}</span><h3>{isArabic ? ["تقرير المحفظة الشهري", "التوصيات المستقلة", "تقرير السوق الأسبوعي"][index] : title}</h3><p>{isArabic ? ["التوزيع الحالي والأداء مقابل المؤشر وسجل القرارات الكامل.", "سعر بداية ومستهدف وفرضية ومخاطر وتاريخ تحديثات دائم.", "مراجعة مؤسسية مختصرة للسوق والمحافظ والذهب والأسبوع القادم."][index] : text}</p><footer><small>{meta}</small><ArrowRight size={16}/></footer></article>)}</div></section>

        <section className="why-section-v21 why-v3" id="about"><div className="section-heading"><span className="eyebrow">BUILT FOR TRUST</span><h2>{isArabic ? "الاحتراف يبدأ من الشفافية" : "Professional investing starts with transparent evidence"}</h2><p>{isArabic ? "المنصة مصممة لتقليل الضوضاء وإظهار ما يحتاجه المستثمر لاتخاذ قرار واعٍ." : "The platform removes noise and surfaces the evidence an investor needs to make an informed decision."}</p></div><div className="why-grid-v21"><Feature icon={<Target/>} number="01" title={isArabic ? "قرارات قابلة للقياس" : "Measurable decisions"} text={isArabic ? "كل قرار مرتبط بسعر وتاريخ ومؤشر مقارنة." : "Every decision is tied to a price, date and benchmark."}/><Feature icon={<BarChart3/>} number="02" title={isArabic ? "أداء مؤسسي" : "Institutional performance"} text={isArabic ? "عائد شهري وتراكمي وألفا واضحة." : "Monthly, cumulative and Alpha performance in context."}/><Feature icon={<FileClock/>} number="03" title={isArabic ? "سجل دائم" : "Permanent record"} text={isArabic ? "التغييرات والتحديثات محفوظة زمنيًا." : "Changes and updates remain permanently timestamped."}/><Feature icon={<Sparkles/>} number="04" title={isArabic ? "ملخصات ذكية" : "Intelligent summaries"} text={isArabic ? "شرح واضح للمحفظة والتوصيات والتقارير." : "Clear explanations of portfolios, recommendations and reports."}/><Feature icon={<UsersRound/>} number="05" title={isArabic ? "صلاحيات منظمة" : "Governed access"} text={isArabic ? "تجربة منفصلة للعضو والإدارة وSuper Admin." : "Purpose-built member, admin and Super Admin experiences."}/><Feature icon={<Globe2/>} number="06" title={isArabic ? "متجاوب بالكامل" : "Responsive everywhere"} text={isArabic ? "تجربة سريعة على الكمبيوتر والموبايل والتابلت." : "A fast, consistent experience across desktop, tablet and mobile."}/></div></section>

        <section className="pricing-section-v3" id="pricing"><div className="section-heading centered"><span className="eyebrow">{isArabic ? settings.pricing_eyebrow_ar : settings.pricing_eyebrow_en}</span><h2>{isArabic ? settings.pricing_title_ar : settings.pricing_title_en}</h2><p>{isArabic ? settings.pricing_description_ar : settings.pricing_description_en}</p></div><article className="pricing-card-v3"><div><span className="eyebrow">ALPHA MEMBER</span><h3>{isArabic ? settings.pricing_plan_name_ar : settings.pricing_plan_name_en}</h3><p>{isArabic ? settings.pricing_plan_description_ar : settings.pricing_plan_description_en}</p></div><div className="price-v3"><b>{settings.pricing_price}</b><span>{isArabic ? settings.pricing_period_ar : settings.pricing_period_en}</span></div><ul>{priceFeatures.map((feature) => <li key={feature}><Check/>{feature}</li>)}</ul><Link className="button gold large" to="/signup">{isArabic ? settings.pricing_cta_ar : settings.pricing_cta_en}<ArrowRight size={16}/></Link></article></section>

        <section className="cta-v21 cta-v3"><div><ShieldCheck size={31}/><span className="eyebrow">ALPHA PLATFORM V3.1</span><h2>{isArabic ? "ادخل منصة استثمارية مصممة للقرار" : "Enter an investment platform designed for decisions"}</h2><p>{isArabic ? "محافظ وأبحاث وتوصيات وتقارير في تجربة مؤسسية واحدة." : "Portfolios, research, recommendations and reports in one institutional experience."}</p></div><Link className="button gold large" to="/signup">{isArabic ? "ابدأ الآن" : "Get started"}<span>{arrow}</span></Link></section>
      </main>
      <PlatformFooter />
    </div>
  );
}

function PreviewKpi({ label, value, tone }) {
  const { isArabic } = useLanguage();
  return <article className={`preview-kpi ${tone}`}><small>{label}</small><b>{value}</b><span>{isArabic ? "منذ النشر الرسمي" : "Since official publication"}</span></article>;
}

function Feature({ icon, number, title, text }) {
  return <article className="feature-card-v21"><div><span className="feature-icon">{icon}</span><b>{number}</b></div><h3>{title}</h3><p>{text}</p></article>;
}
