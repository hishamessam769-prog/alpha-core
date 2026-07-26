import { ArrowRight, BarChart3, CheckCircle2, FileClock, LockKeyhole, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import SetupNotice from "../components/SetupNotice";
import { useLanguage } from "../context/LanguageContext";

const previewRows = [
  ["RAYA", "20.00%", "+7.40%", "+1.48%"],
  ["TMGH", "20.00%", "+5.10%", "+1.02%"],
  ["ORAS", "20.00%", "+3.80%", "+0.76%"],
  ["CLHO", "20.00%", "+2.30%", "+0.46%"],
  ["CCAP", "20.00%", "-1.10%", "-0.22%"],
];

export default function Landing() {
  const { t, isArabic } = useLanguage();
  const arrow = isArabic ? "←" : "→";
  return (
    <div className="public-page">
      <PublicHeader />
      <SetupNotice />

      <main>
        <section className="hero-v21">
          <div className="hero-copy-v21">
            <span className="eyebrow">{t("heroEyebrow")}</span>
            <h1>
              {t("heroTitle1")}<br />
              {t("heroTitle2")}<br />
              <em>{t("heroTitle3")}</em>
            </h1>
            <p>{t("heroText")}</p>
            <div className="hero-actions">
              <Link className="button gold large" to="/signup">{t("heroPrimary")} <span>{arrow}</span></Link>
              <Link className="button ghost large" to="/methodology">{t("heroSecondary")}</Link>
            </div>
            <div className="trust-line">
              <span><CheckCircle2 size={15}/>{t("trust1")}</span>
              <span><CheckCircle2 size={15}/>{t("trust2")}</span>
              <span><CheckCircle2 size={15}/>{t("trust3")}</span>
            </div>
          </div>

          <div className="terminal-showcase" aria-label="ALPHA CORE product preview">
            <div className="terminal-window-top">
              <div className="window-dots"><i/><i/><i/></div>
              <span>ALPHA CORE / MEMBER TERMINAL</span>
              <b>LIVE</b>
            </div>
            <div className="preview-kpis">
              <PreviewKpi label={t("portfolioMtd")} value="+5.00%" tone="blue" />
              <PreviewKpi label={t("benchmarkMtd")} value="+3.10%" tone="gold" />
              <PreviewKpi label={t("monthlyAlpha")} value="+1.90%" tone="green" />
            </div>
            <div className="preview-chart-v21">
              <div className="preview-chart-labels"><span>9%</span><span>6%</span><span>3%</span><span>0%</span></div>
              <svg viewBox="0 0 600 230" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1ec8e5" stopOpacity=".25"/>
                    <stop offset="100%" stopColor="#1ec8e5" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path className="grid-line" d="M0 45H600 M0 95H600 M0 145H600 M0 195H600"/>
                <path className="area-line" d="M0 195 C95 183 150 150 220 156 S340 104 410 112 S525 78 600 58 L600 230 L0 230 Z"/>
                <path className="portfolio-line" d="M0 195 C95 183 150 150 220 156 S340 104 410 112 S525 78 600 58"/>
                <path className="benchmark-line" d="M0 195 C105 185 165 172 230 169 S350 142 420 148 S520 121 600 112"/>
                <path className="alpha-line" d="M0 195 C100 192 165 173 225 181 S345 154 415 162 S520 137 600 126"/>
              </svg>
              <div className="chart-legend"><span className="blue-dot">Portfolio</span><span className="gold-dot">EGX30 Capped</span><span className="white-dot">Alpha</span></div>
            </div>
            <div className="preview-table-wrap">
              <div className="preview-table-title"><span>OFFICIAL PORTFOLIO</span><small>{t("sampleData")}</small></div>
              <table className="preview-table">
                <thead><tr><th>{t("ticker")}</th><th>{t("weight")}</th><th>{t("return")}</th><th>{t("contribution")}</th></tr></thead>
                <tbody>{previewRows.map((row) => <tr key={row[0]}>{row.map((cell, i) => <td key={i} className={i > 1 ? (cell.startsWith("-") ? "negative" : "positive") : ""}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="preview-security"><LockKeyhole size={14}/><span>Member-only live data</span></div>
          </div>
        </section>

        <section className="product-proof-section">
          <div className="section-heading centered">
            <span className="eyebrow">{t("liveSection")}</span>
            <h2>{t("liveTitle")}</h2>
            <p>{t("liveText")}</p>
          </div>
          <div className="six-metric-preview">
            <PreviewKpi label={t("portfolioMtd")} value="+5.00%" tone="blue" />
            <PreviewKpi label={t("benchmarkMtd")} value="+3.10%" tone="gold" />
            <PreviewKpi label={t("monthlyAlpha")} value="+1.90%" tone="green" />
            <PreviewKpi label={t("cumulativePortfolio")} value="+13.40%" tone="blue" />
            <PreviewKpi label={t("cumulativeBenchmark")} value="+8.20%" tone="gold" />
            <PreviewKpi label={t("cumulativeAlpha")} value="+5.20%" tone="green" />
          </div>
        </section>

        <section className="why-section-v21">
          <div className="section-heading">
            <span className="eyebrow">{t("whyEyebrow")}</span>
            <h2>{t("whyTitle")}</h2>
            <p>{t("whyText")}</p>
          </div>
          <div className="why-grid-v21">
            <Feature icon={<Target/>} number="01" title={t("why1Title")} text={t("why1Text")} />
            <Feature icon={<BarChart3/>} number="02" title={t("why2Title")} text={t("why2Text")} />
            <Feature icon={<FileClock/>} number="03" title={t("why3Title")} text={t("why3Text")} />
            <Feature icon={<TrendingUp/>} number="04" title={t("why4Title")} text={t("why4Text")} />
          </div>
        </section>

        <section className="journey-section">
          <div className="section-heading centered">
            <span className="eyebrow">{t("journeyEyebrow")}</span>
            <h2>{t("journeyTitle")}</h2>
          </div>
          <div className="journey-grid">
            {[t("journey1"), t("journey2"), t("journey3"), t("journey4")].map((item, index) => (
              <article key={item}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item}</h3>{index < 3 && <ArrowRight className="journey-arrow"/>}</article>
            ))}
          </div>
        </section>

        <section className="faq-section-v21">
          <div className="section-heading">
            <span className="eyebrow">{t("faqEyebrow")}</span>
            <h2>{t("faqTitle")}</h2>
          </div>
          <div className="faq-list">
            <details open><summary>{t("faq1q")}</summary><p>{t("faq1a")}</p></details>
            <details><summary>{t("faq2q")}</summary><p>{t("faq2a")}</p></details>
            <details><summary>{t("faq3q")}</summary><p>{t("faq3a")}</p></details>
          </div>
        </section>

        <section className="cta-v21">
          <div><ShieldCheck size={30}/><span className="eyebrow">ALPHA CORE V2.1</span><h2>{t("ctaTitle")}</h2><p>{t("ctaText")}</p></div>
          <Link className="button gold large" to="/signup">{t("signup")} <span>{arrow}</span></Link>
        </section>
      </main>

      <footer className="public-footer"><span className="footer-brand">ALPHA CORE</span><p>{t("footer")}</p><span>© 2026</span></footer>
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
