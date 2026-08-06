export const ROBO_QUESTIONS = [
  {
    id: "q1",
    title: {
      en: "What is your primary investment time horizon?",
      ar: "ما هو الأفق الزمني الأساسي لاستثمارك؟",
    },
    options: [
      { key: "A", score: 1, en: "Less than 1 year", ar: "أقل من سنة", helperEn: "Short-term liquidity", helperAr: "سيولة قصيرة الأجل" },
      { key: "B", score: 2, en: "1 to 3 years", ar: "من سنة إلى 3 سنوات", helperEn: "Medium-term growth", helperAr: "نمو متوسط الأجل" },
      { key: "C", score: 3, en: "3 to 5+ years", ar: "من 3 إلى 5 سنوات أو أكثر", helperEn: "Long-term wealth compounding", helperAr: "تنمية الثروة على المدى الطويل" },
    ],
  },
  {
    id: "q2",
    title: {
      en: "What is your main financial goal?",
      ar: "ما هو هدفك المالي الأساسي؟",
    },
    options: [
      { key: "A", score: 1, en: "Capital Preservation", ar: "الحفاظ على رأس المال", helperEn: "Protect money against inflation with minimum risk", helperAr: "حماية الأموال من التضخم بأقل قدر من المخاطر" },
      { key: "B", score: 2, en: "Balanced Growth", ar: "نمو متوازن", helperEn: "Steady capital growth with controlled risk", helperAr: "نمو منتظم مع مخاطر محسوبة" },
      { key: "C", score: 3, en: "Wealth Maximization", ar: "تعظيم الثروة", helperEn: "Aggressive long-term growth while accepting volatility", helperAr: "نمو قوي طويل الأجل مع تقبّل تقلبات السوق" },
    ],
  },
  {
    id: "q3",
    title: {
      en: "How would you react if your portfolio dropped 20% in one month?",
      ar: "كيف ستتصرف إذا انخفضت محفظتك 20% خلال شهر واحد؟",
    },
    options: [
      { key: "A", score: 1, en: "Sell immediately", ar: "أبيع فورًا", helperEn: "Prevent any further loss", helperAr: "لمنع أي خسائر إضافية" },
      { key: "B", score: 2, en: "Hold and wait", ar: "أحتفظ وأنتظر", helperEn: "Feel anxious, but allow the market to recover", helperAr: "أشعر بالقلق لكن أنتظر تعافي السوق" },
      { key: "C", score: 3, en: "Buy more at lower prices", ar: "أستغل الانخفاض للشراء", helperEn: "Treat the correction as an opportunity", helperAr: "أعتبر التصحيح فرصة استثمارية" },
    ],
  },
  {
    id: "q4",
    title: {
      en: "What is your preferred balance regarding liquidity?",
      ar: "ما احتياجك للسيولة وسحب الأموال؟",
    },
    options: [
      { key: "A", score: 1, en: "Immediate access at any time", ar: "أحتاج الوصول الفوري للأموال", helperEn: "No lock-up or withdrawal delay", helperAr: "من دون تجميد أو تأخير في السحب" },
      { key: "B", score: 2, en: "Possible partial withdrawal", ar: "قد أحتاج سحبًا جزئيًا", helperEn: "Within 6 to 12 months", helperAr: "خلال 6 إلى 12 شهرًا" },
      { key: "C", score: 3, en: "No withdrawal expected", ar: "لا أتوقع سحب الأموال", helperEn: "Capital can remain invested for the full horizon", helperAr: "يمكن إبقاء رأس المال مستثمرًا طوال المدة" },
    ],
  },
  {
    id: "q5",
    title: {
      en: "What is your experience with stock-market fluctuations?",
      ar: "ما مستوى خبرتك وارتياحك لتقلبات سوق الأسهم؟",
    },
    options: [
      { key: "A", score: 1, en: "Beginner", ar: "مبتدئ", helperEn: "Prefer passive managed funds and lower volatility", helperAr: "أفضل الصناديق المدارة وتقلبات أقل" },
      { key: "B", score: 2, en: "Intermediate", ar: "متوسط الخبرة", helperEn: "Understand basic equity risks and managed funds", helperAr: "أفهم مخاطر الأسهم الأساسية والصناديق" },
      { key: "C", score: 3, en: "Advanced / High Conviction", ar: "متقدم / قناعة مرتفعة", helperEn: "Comfortable with concentrated portfolios", helperAr: "مرتاح للمحافظ المركزة طويلة الأجل" },
    ],
  },
];

export const PERSONA_MODELS = {
  conservative: {
    range: "5–7",
    title: { en: "Conservative", ar: "محافظ" },
    subtitle: { en: "Capital Preservation", ar: "الحفاظ على رأس المال" },
    mindset: {
      en: "You prioritise liquidity and capital stability, and you are highly sensitive to sharp market volatility.",
      ar: "أنت تعطي الأولوية للسيولة واستقرار رأس المال، وتتأثر بدرجة كبيرة بالتقلبات الحادة في السوق.",
    },
    allocations: [
      { key: "money_market", weight: 70, labelEn: "Money Market & Fixed Income Funds", labelAr: "صناديق سوق النقد والدخل الثابت", typeEn: "Daily-liquidity cash and debt funds", typeAr: "صناديق سيولة يومية وأدوات دين" },
      { key: "gold", weight: 20, labelEn: "Gold Funds", labelAr: "صناديق الذهب", typeEn: "Inflation and currency protection", typeAr: "تحوط من التضخم وتقلب العملة" },
      { key: "equity_funds", weight: 10, labelEn: "Equity Funds", labelAr: "صناديق الأسهم", typeEn: "Low-beta managed equity exposure", typeAr: "تعرض مُدار لأسهم منخفضة التقلب" },
    ],
  },
  balanced: {
    range: "8–11",
    title: { en: "Balanced", ar: "متوازن" },
    subtitle: { en: "Balanced Growth", ar: "نمو متوازن" },
    mindset: {
      en: "You accept short-term market noise in exchange for disciplined compounding, while retaining meaningful stability and hedging.",
      ar: "أنت تتقبل ضوضاء السوق قصيرة الأجل مقابل نمو منضبط، مع الاحتفاظ بجزء مهم للاستقرار والتحوط.",
    },
    allocations: [
      { key: "equity_index", weight: 50, labelEn: "Equity Index / Accumulative Funds", labelAr: "صناديق الأسهم والمؤشرات التراكمية", typeEn: "Fund 1000 or broad managed equity funds", typeAr: "Fund 1000 أو صناديق أسهم واسعة ومدارة" },
      { key: "money_market", weight: 30, labelEn: "Money Market & Debt Funds", labelAr: "صناديق سوق النقد والدين", typeEn: "Portfolio stability anchor", typeAr: "مرساة استقرار للمحفظة" },
      { key: "gold", weight: 20, labelEn: "Gold Funds", labelAr: "صناديق الذهب", typeEn: "FX and inflation hedge", typeAr: "تحوط من العملة والتضخم" },
    ],
  },
  aggressive: {
    range: "12–15",
    title: { en: "Aggressive / High Conviction", ar: "هجومي / قناعة مرتفعة" },
    subtitle: { en: "Long-Term Wealth Maximisation", ar: "تعظيم الثروة طويلة الأجل" },
    mindset: {
      en: "You can tolerate severe drawdowns and maintain a concentrated, long-term strategy targeting substantial capital expansion.",
      ar: "يمكنك تحمّل انخفاضات حادة والالتزام باستراتيجية مركزة طويلة الأجل تستهدف نموًا كبيرًا لرأس المال.",
    },
    allocations: [
      { key: "high_conviction", weight: 70, labelEn: "Concentrated High-Conviction Equities", labelAr: "أسهم مركزة مرتفعة القناعة", typeEn: "Alpha Apex 7X / Core 5 sector strategy", typeAr: "استراتيجية Alpha Apex 7X / الخمسة الأقوى قطاعيًا" },
      { key: "equity_funds", weight: 20, labelEn: "Equity Accumulative Funds", labelAr: "صناديق أسهم تراكمية", typeEn: "Broad-market diversification", typeAr: "تنويع واسع عبر السوق" },
      { key: "tactical_reserve", weight: 10, labelEn: "Gold / Tactical Cash Reserve", labelAr: "ذهب / احتياطي نقدي تكتيكي", typeEn: "Reserve for buying market corrections", typeAr: "احتياطي لاستغلال تصحيحات السوق" },
    ],
  },
};

export function scoreAnswers(answers = {}) {
  return ROBO_QUESTIONS.reduce((total, question) => {
    const option = question.options.find((item) => item.key === answers[question.id]);
    return total + Number(option?.score || 0);
  }, 0);
}

export function personaKeyFromScore(score) {
  if (score <= 7) return "conservative";
  if (score <= 11) return "balanced";
  return "aggressive";
}

export function buildAdvisorResult(answers = {}) {
  const score = scoreAnswers(answers);
  if (score < 5 || score > 15) return null;
  const personaKey = personaKeyFromScore(score);
  return { score, personaKey, model: PERSONA_MODELS[personaKey] };
}

export function answerBreakdown(answers = {}, isArabic = false) {
  return ROBO_QUESTIONS.map((question) => {
    const selected = question.options.find((option) => option.key === answers[question.id]);
    return {
      id: question.id,
      question: question.title[isArabic ? "ar" : "en"],
      answer: selected?.[isArabic ? "ar" : "en"] || "—",
      score: selected?.score || 0,
    };
  });
}

export function strategicReason(answers = {}, personaKey, isArabic = false) {
  const horizon = ROBO_QUESTIONS[0].options.find((option) => option.key === answers.q1);
  const reaction = ROBO_QUESTIONS[2].options.find((option) => option.key === answers.q3);
  const liquidity = ROBO_QUESTIONS[3].options.find((option) => option.key === answers.q4);
  const model = PERSONA_MODELS[personaKey];
  if (isArabic) {
    return `${model.mindset.ar} الاختيار يعكس أفقًا زمنيًا (${horizon?.ar || "غير محدد"})، ورد فعل متوقع تجاه الهبوط (${reaction?.ar || "غير محدد"})، واحتياج سيولة (${liquidity?.ar || "غير محدد"}).`;
  }
  return `${model.mindset.en} The proposal reflects your stated horizon (${horizon?.en || "not specified"}), correction response (${reaction?.en || "not specified"}) and liquidity need (${liquidity?.en || "not specified"}).`;
}
