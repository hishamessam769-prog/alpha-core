import { ArrowRight, BarChart3, CheckCircle2, Layers3, LockKeyhole, RefreshCcw, Search, Target } from "lucide-react";
import { Link } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import { useLanguage } from "../context/LanguageContext";

export default function Methodology() {
  const { t, isArabic } = useLanguage();
  const methods = [
    [<Search/>, "01", t("method1Title"), t("method1Text")],
    [<Layers3/>, "02", t("method2Title"), t("method2Text")],
    [<BarChart3/>, "03", t("method3Title"), t("method3Text")],
    [<RefreshCcw/>, "04", t("method4Title"), t("method4Text")],
    [<Target/>, "05", t("method5Title"), t("method5Text")],
    [<LockKeyhole/>, "06", t("method6Title"), t("method6Text")],
  ];
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="methodology-page-v21">
        <section className="methodology-hero-v21">
          <div>
            <span className="eyebrow">{t("methodologyEyebrow")}</span>
            <h1>{t("methodologyTitle")}</h1>
            <p>{t("methodologyText")}</p>
          </div>
          <div className="methodology-visual">
            <div className="method-orbit"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><b>AC</b></div>
          </div>
        </section>

        <section className="methodology-grid-v21">
          {methods.map(([icon, number, title, text]) => (
            <article key={number} className="method-card-v21">
              <div className="method-card-top"><span>{icon}</span><b>{number}</b></div>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="formula-strip-v21">
          <div><small>01</small><b>{t("formulaPortfolio")}</b><code>Σ (Weight × Stock Return)</code></div>
          <div><small>02</small><b>{t("formulaBenchmark")}</b><code>(Latest − Open) ÷ Open</code></div>
          <div><small>03</small><b>{t("formulaAlpha")}</b><code>Portfolio − Benchmark</code></div>
          <div><small>04</small><b>{t("formulaCumulative")}</b><code>Π (1 + Monthly Return) − 1</code></div>
        </section>

        <section className="methodology-principles">
          <div>
            <span className="eyebrow">REPORTING PRINCIPLES</span>
            <h2>{isArabic ? "السجل أهم من أي توقع منفرد" : "The record matters more than any single forecast."}</h2>
          </div>
          <ul>
            <li><CheckCircle2/>{isArabic ? "نقطة واحدة واضحة لكل شهر على الجراف" : "One clean chart point for each published month"}</li>
            <li><CheckCircle2/>{isArabic ? "الشهر الحالي يتحدث دون تشويه السجل" : "The live month updates without cluttering the record"}</li>
            <li><CheckCircle2/>{isArabic ? "الشهر المقفول يظل ثابتًا" : "Closed months remain frozen in history"}</li>
            <li><CheckCircle2/>{isArabic ? "الأداء التراكمي محسوب بالتركيب" : "Cumulative results use proper compounding"}</li>
          </ul>
        </section>

        <section className="methodology-cta-v21">
          <div><span className="eyebrow">ALPHA CORE</span><h2>{t("ctaTitle")}</h2><p>{t("ctaText")}</p></div>
          <Link className="button gold large" to="/signup">{t("signup")} <ArrowRight size={16}/></Link>
        </section>
      </main>
    </div>
  );
}
