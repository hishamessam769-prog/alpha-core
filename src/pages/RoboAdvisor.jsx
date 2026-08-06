import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  Coins,
  Landmark,
  PieChart,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import Reveal from "../components/Reveal";
import { useLanguage } from "../context/LanguageContext";
import { dateTimeLabel } from "../lib/calculations";
import {
  PERSONA_MODELS,
  ROBO_QUESTIONS,
  answerBreakdown,
  buildAdvisorResult,
  strategicReason,
} from "../lib/roboAdvisor";
import { supabase } from "../lib/supabase";

const DEFAULT_ANSWERS = {};
const ALLOCATION_ICONS = {
  money_market: Landmark,
  gold: Coins,
  equity_funds: TrendingUp,
  equity_index: BarChart3,
  high_conviction: Target,
  tactical_reserve: WalletCards,
};

function normaliseAssessment(row) {
  if (!row) return null;
  const answers = row.answers || {};
  const computed = buildAdvisorResult(answers);
  const personaKey = row.persona || computed?.personaKey;
  const model = PERSONA_MODELS[personaKey] || computed?.model;
  if (!model) return null;
  return {
    ...row,
    score: Number(row.score || computed?.score || 0),
    personaKey,
    model,
    answers,
  };
}

export default function RoboAdvisor() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);
  const [latest, setLatest] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) return setLoading(false);
      const { data, error } = await supabase
        .from("robo_advisor_assessments")
        .select("*")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (!error && data) setLatest(normaliseAssessment(data));
      // A missing migration must never block the rest of the platform.
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, []);

  const currentQuestion = step >= 0 && step < ROBO_QUESTIONS.length ? ROBO_QUESTIONS[step] : null;
  const progress = step < 0 ? 0 : Math.min(100, ((step + 1) / ROBO_QUESTIONS.length) * 100);
  const currentChoice = currentQuestion ? answers[currentQuestion.id] : null;

  const selectedResult = result || latest;
  const breakdown = useMemo(() => selectedResult ? answerBreakdown(selectedResult.answers, isArabic) : [], [selectedResult, isArabic]);

  const start = () => {
    setAnswers({});
    setResult(null);
    setMessage("");
    setStep(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const choose = (key) => {
    if (!currentQuestion) return;
    setAnswers((current) => ({ ...current, [currentQuestion.id]: key }));
  };

  const next = async () => {
    if (!currentQuestion || !currentChoice) return;
    if (step < ROBO_QUESTIONS.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    const computed = buildAdvisorResult(answers);
    if (!computed) return;
    setSaving(true);
    setMessage("");
    let saved = null;
    try {
      const { data, error } = await supabase.rpc("submit_robo_advisor_assessment", { p_answers: answers });
      if (error) throw error;
      saved = normaliseAssessment(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      // The user still receives the deterministic proposal if the additive SQL
      // has not been installed yet; no core platform flow is interrupted.
      saved = normaliseAssessment({
        id: `local-${Date.now()}`,
        answers,
        score: computed.score,
        persona: computed.personaKey,
        completed_at: new Date().toISOString(),
        next_review_at: new Date(Date.now() + 90 * 86400000).toISOString(),
        local_only: true,
      });
      setMessage(isArabic
        ? "تم إنشاء النتيجة على الجهاز، لكن حفظها في الحساب يحتاج تشغيل ملف SQL الخاص بالتحديث."
        : "Your proposal was generated locally. Install the upgrade SQL to save it to your account.");
    }
    setSaving(false);
    setResult(saved);
    if (!saved?.local_only) setLatest(saved);
    setStep(ROBO_QUESTIONS.length);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="dashboard-shell robo-shell-v39">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main className="robo-advisor-v39">
        <section className="robo-hero-v39">
          <div>
            <span className="eyebrow">ALPHA APEX · ROBO-ADVISOR</span>
            <h1>{isArabic ? "حوّل أهدافك وتحملك للمخاطر إلى توزيع استثماري واضح" : "Turn your goals and risk tolerance into a clear allocation"}</h1>
            <p>{isArabic
              ? "خمس أسئلة فقط لبناء نموذج توزيع أصول مؤسسي، شفاف، وقابل للمراجعة ربع سنويًا."
              : "Five focused questions produce a transparent institutional asset-allocation model that can be reviewed quarterly."}</p>
          </div>
          <div className="robo-trust-v39">
            <ShieldCheck />
            <b>{isArabic ? "محرك حتمي ومنضبط" : "Deterministic, rules-based engine"}</b>
            <span>{isArabic ? "لا يغيّر محافظك ولا ينفّذ صفقات تلقائيًا" : "No portfolio changes or automatic trade execution"}</span>
          </div>
        </section>

        {step < 0 && !result && (
          <Reveal as="section" className="robo-intro-grid-v39">
            <article className="robo-start-card-v39">
              <div className="robo-start-icon-v39"><Sparkles /></div>
              <span className="eyebrow">PERSONALISED ALLOCATION PROPOSAL</span>
              <h2>{isArabic ? "ابدأ تقييم ملف المخاطر" : "Build your risk profile"}</h2>
              <p>{isArabic
                ? "نقيّم المدة والهدف ورد فعلك تجاه الهبوط واحتياجك للسيولة وخبرتك، ثم نحدد شخصية المخاطر والتوزيع المناسب."
                : "We assess horizon, goal, drawdown behaviour, liquidity needs and experience before assigning your risk persona and allocation."}</p>
              <div className="robo-model-strip-v39">
                {Object.entries(PERSONA_MODELS).map(([key, model]) => <span key={key}><i />{model.title[isArabic ? "ar" : "en"]}<small>{model.range} {isArabic ? "نقاط" : "points"}</small></span>)}
              </div>
              <button className="button primary large" type="button" onClick={start}><PieChart />{isArabic ? "ابدأ الأسئلة الخمسة" : "Start the 5-question assessment"}</button>
            </article>

            <aside className="robo-latest-card-v39">
              <span className="eyebrow">YOUR LATEST PROFILE</span>
              {loading ? <div className="robo-loading-v39"><i/><i/><i/></div> : latest ? <>
                <PersonaHeader assessment={latest} isArabic={isArabic}/>
                <div className="robo-latest-meta-v39">
                  <span><CalendarClock/><small>{isArabic ? "آخر تقييم" : "Last assessment"}</small><b>{dateTimeLabel(latest.completed_at, locale)}</b></span>
                  <span><RefreshCw/><small>{isArabic ? "المراجعة المقترحة" : "Suggested review"}</small><b>{dateTimeLabel(latest.next_review_at, locale)}</b></span>
                </div>
                <button className="button subtle full" type="button" onClick={() => { setResult(latest); setStep(ROBO_QUESTIONS.length); }}>{isArabic ? "عرض الخطة الحالية" : "View current proposal"}<ArrowRight/></button>
                <button className="text-action-v39" type="button" onClick={start}>{isArabic ? "إعادة التقييم" : "Retake assessment"}</button>
              </> : <div className="robo-empty-v39"><Target/><b>{isArabic ? "لا يوجد تقييم محفوظ بعد" : "No saved assessment yet"}</b><p>{isArabic ? "ابدأ الآن للحصول على نموذجك الأول." : "Complete the five questions to create your first proposal."}</p></div>}
            </aside>
          </Reveal>
        )}

        {currentQuestion && (
          <section className="robo-question-shell-v39">
            <header className="robo-progress-v39">
              <div><span>{isArabic ? `السؤال ${step + 1} من 5` : `Question ${step + 1} of 5`}</span><b>{Math.round(progress)}%</b></div>
              <i><em style={{ width: `${progress}%` }}/></i>
            </header>
            <Reveal key={currentQuestion.id} as="article" className="robo-question-card-v39">
              <span className="robo-question-number-v39">0{step + 1}</span>
              <h2>{currentQuestion.title[isArabic ? "ar" : "en"]}</h2>
              <div className="robo-options-v39">
                {currentQuestion.options.map((option) => {
                  const active = currentChoice === option.key;
                  return <button type="button" key={option.key} className={active ? "active" : ""} onClick={() => choose(option.key)}>
                    <span>{option.key}</span>
                    <div><b>{option[isArabic ? "ar" : "en"]}</b><small>{option[isArabic ? "helperAr" : "helperEn"]}</small></div>
                    <i>{active && <Check/>}</i>
                  </button>;
                })}
              </div>
              <footer>
                <button className="button subtle" type="button" onClick={() => step === 0 ? setStep(-1) : setStep((current) => current - 1)}><ArrowLeft/>{isArabic ? "السابق" : "Back"}</button>
                <button className="button primary" type="button" disabled={!currentChoice || saving} onClick={next}>{saving ? (isArabic ? "جاري إنشاء الخطة…" : "Building proposal…") : step === 4 ? (isArabic ? "إنشاء التوزيع" : "Generate allocation") : (isArabic ? "التالي" : "Continue")}<ArrowRight/></button>
              </footer>
            </Reveal>
          </section>
        )}

        {step >= ROBO_QUESTIONS.length && selectedResult && (
          <AdvisorResult
            assessment={selectedResult}
            isArabic={isArabic}
            locale={locale}
            breakdown={breakdown}
            onRetake={start}
          />
        )}
      </main>
    </div>
  );
}

function PersonaHeader({ assessment, isArabic }) {
  const model = assessment.model;
  return <div className={`robo-persona-header-v39 ${assessment.personaKey}`}>
    <span><Sparkles/></span>
    <div><small>{isArabic ? "شخصية المخاطر" : "RISK PERSONA"}</small><h2>{model.title[isArabic ? "ar" : "en"]}</h2><p>{model.subtitle[isArabic ? "ar" : "en"]}</p></div>
    <b>{assessment.score}<small>/15</small></b>
  </div>;
}

function AdvisorResult({ assessment, isArabic, locale, breakdown, onRetake }) {
  const model = assessment.model;
  const allocationGradient = model.allocations.reduce((state, item, index) => {
    const start = state.total;
    const end = start + item.weight;
    const colors = ["#2bd9ff", "#8b6cff", "#32e6a1"];
    state.parts.push(`${colors[index % colors.length]} ${start}% ${end}%`);
    state.total = end;
    return state;
  }, { total: 0, parts: [] }).parts.join(", ");

  return <section className="robo-results-v39">
    <Reveal as="header" className="robo-result-hero-v39">
      <PersonaHeader assessment={assessment} isArabic={isArabic}/>
      <div className="robo-result-actions-v39">
        <button className="button subtle" type="button" onClick={onRetake}><RefreshCw/>{isArabic ? "إعادة التقييم" : "Retake assessment"}</button>
        <Link className="button primary" to="/portfolios"><WalletCards/>{isArabic ? "استعراض منتجات ALPHA" : "Explore ALPHA products"}</Link>
      </div>
    </Reveal>

    <div className="robo-result-grid-v39">
      <Reveal as="article" className="robo-strategy-card-v39" delay={40}>
        <span className="eyebrow">01 · RISK PROFILE SUMMARY</span>
        <h2>{isArabic ? "ملخص ملف المخاطر" : "Your risk profile"}</h2>
        <p>{model.mindset[isArabic ? "ar" : "en"]}</p>
        <div className="robo-score-scale-v39">
          <i><em style={{ width: `${(assessment.score / 15) * 100}%` }}/></i>
          <div><span>5</span><span>{assessment.score}/15</span><span>15</span></div>
        </div>
        <div className="robo-breakdown-v39">
          {breakdown.map((row, index) => <span key={row.id}><i>{index + 1}</i><div><small>{row.question}</small><b>{row.answer}</b></div><em>+{row.score}</em></span>)}
        </div>
      </Reveal>

      <Reveal as="article" className="robo-allocation-card-v39" delay={80}>
        <span className="eyebrow">02 · ASSET ALLOCATION</span>
        <h2>{isArabic ? "التوزيع الاستراتيجي المقترح" : "Proposed strategic allocation"}</h2>
        <div className="robo-allocation-visual-v39">
          <div className="robo-donut-v39" style={{ background: `conic-gradient(${allocationGradient})` }}><span><PieChart/><b>100%</b><small>{isArabic ? "موزعة" : "allocated"}</small></span></div>
          <div className="robo-allocation-legend-v39">{model.allocations.map((item, index) => <span key={item.key}><i className={`series-${index + 1}`}/><div><b>{item[isArabic ? "labelAr" : "labelEn"]}</b><small>{item[isArabic ? "typeAr" : "typeEn"]}</small></div><em>{item.weight}%</em></span>)}</div>
        </div>
      </Reveal>
    </div>

    <Reveal as="article" className="robo-recommendation-v39" delay={100}>
      <div><span className="eyebrow">03 · STRATEGIC RECOMMENDATION</span><h2>{isArabic ? "لماذا يناسبك هذا التوزيع؟" : "Why this allocation fits you"}</h2><p>{strategicReason(assessment.answers, assessment.personaKey, isArabic)}</p></div>
      <div className="robo-review-date-v39"><CalendarClock/><small>{isArabic ? "إعادة التقييم المقترحة" : "NEXT SUGGESTED REVIEW"}</small><b>{dateTimeLabel(assessment.next_review_at || new Date(Date.now() + 90 * 86400000), locale)}</b><span>{isArabic ? "أو فور تغير الأفق الزمني أو احتياج السيولة" : "Or whenever your horizon or liquidity needs change"}</span></div>
    </Reveal>

    <Reveal as="section" className="robo-next-steps-v39" delay={120}>
      <div><span className="eyebrow">04 · ACTIONABLE NEXT STEPS</span><h2>{isArabic ? "حوّل النموذج إلى خطة قابلة للتنفيذ" : "Turn the model into an actionable plan"}</h2></div>
      <div className="robo-step-grid-v39">
        <Link to="/portfolios"><span>01</span><WalletCards/><b>{isArabic ? "قارن المحافظ" : "Compare portfolios"}</b><small>{isArabic ? "راجع الاستراتيجية والسجل قبل الاختيار" : "Review strategy and track record before choosing"}</small></Link>
        <Link to="/recommendations"><span>02</span><TrendingUp/><b>{isArabic ? "راجع التوصيات" : "Review recommendations"}</b><small>{isArabic ? "لأصحاب الملف الهجومي فقط وبحدود التوزيع" : "For aggressive profiles only and within allocation limits"}</small></Link>
        <Link to="/methodology"><span>03</span><ShieldCheck/><b>{isArabic ? "افهم المنهجية" : "Understand the methodology"}</b><small>{isArabic ? "اعرف كيف نقيس العائد والألفا والمخاطر" : "See how return, Alpha and risk are measured"}</small></Link>
      </div>
    </Reveal>

    <div className="robo-disclaimer-v39"><ShieldCheck/><p>{isArabic ? "هذا النموذج تعليمي وإرشادي ولا يمثل تنفيذًا تلقائيًا أو ضمانًا للعائد. راجع التوزيع ربع سنويًا، واستشر مستشارًا ماليًا مرخصًا قبل اتخاذ قرارات مالية جوهرية." : "This is an educational allocation proposal, not automatic execution or a return guarantee. Reassess quarterly and consult a licensed financial adviser before material financial decisions."}</p></div>
  </section>;
}
