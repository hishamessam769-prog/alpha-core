import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Calculator,
  Coins,
  Landmark,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const STORAGE_KEY = "alpha-financial-freedom-planner-v1";

const DEFAULTS = {
  currentCapital: 1_000_000,
  targetMonthlyIncome: 100_000,
  bankRate: 15,
  targetYears: 10,
  expectedCagr: 20,
  inflationRate: 12,
  savingsStartingCapital: 250_000,
  monthlySalary: 50_000,
  monthlySavingsRate: 20,
  annualSalaryGrowth: 10,
  savingsYears: 10,
};

const copy = {
  en: {
    eyebrow: "FINANCIAL FREEDOM SIMULATOR",
    title: "Turn a retirement target into a measurable wealth plan",
    subtitle: "Edit every assumption inline. Required capital, CAGR, purchasing power and long-term savings update instantly without reloading the page.",
    inputs: "Core planning assumptions",
    currentCapital: "Current capital",
    targetMonthlyIncome: "Target monthly income",
    bankRate: "Expected bank rate",
    targetYears: "Target investment horizon",
    expectedCagr: "Expected portfolio CAGR",
    inflationRate: "Expected inflation rate",
    years: "years",
    requiredNestEgg: "Required nest egg capital",
    requiredCagr: "Required annual CAGR",
    timeFreedom: "Time horizon to freedom",
    realPurchasingPower: "Real purchasing power",
    targetCapital: "Capital required to fund the target income at the selected bank rate.",
    cagrNeeded: "Annual compound return needed to reach the target within the selected horizon.",
    expectedTime: "Estimated time using the expected portfolio CAGR.",
    todayMoney: "Future nest egg translated into today's purchasing power.",
    wealthChart: "Wealth accumulation trajectory",
    inflationChart: "Inflation & purchasing power breakdown",
    projectedWealth: "Projected portfolio value",
    targetLine: "Required nest egg",
    nominalIncome: "Nominal target",
    realIncome: "Real buying power",
    adjustedIncome: "Inflation-adjusted need",
    savingsTitle: "Retirement savings & salary growth calculator",
    savingsSubtitle: "Model monthly salary-linked contributions and compound them using the expected portfolio CAGR above.",
    startingCapital: "Starting capital",
    monthlySalary: "Current monthly salary",
    savingsRate: "Monthly savings from salary",
    salaryGrowth: "Expected annual salary increase",
    duration: "Investment duration",
    finalWealth: "Projected final wealth",
    contributions: "Total invested capital",
    investmentGrowth: "Investment growth",
    endingSalary: "Estimated monthly salary at end",
    monthlySavingNow: "Current monthly contribution",
    reset: "Reset assumptions",
    live: "Live calculation",
    privacy: "Inputs stay on this device and are used only for simulation.",
    disclaimer: "Educational planning simulation only. Results depend on assumptions and are not guaranteed investment outcomes.",
    alreadyFunded: "Target already funded",
    unavailable: "Not reachable with current assumptions",
  },
  ar: {
    eyebrow: "محاكي الحرية المالية",
    title: "حوّل هدف التقاعد إلى خطة ثروة قابلة للقياس",
    subtitle: "عدّل أي افتراض مباشرة، وسيتم تحديث رأس المال المطلوب والعائد المركب والقوة الشرائية وخطة الادخار فورًا دون إعادة تحميل الصفحة.",
    inputs: "الافتراضات الأساسية للخطة",
    currentCapital: "رأس المال الحالي",
    targetMonthlyIncome: "الدخل الشهري المستهدف",
    bankRate: "الفائدة البنكية المتوقعة",
    targetYears: "مدة الاستثمار المستهدفة",
    expectedCagr: "العائد المركب المتوقع للمحفظة",
    inflationRate: "معدل التضخم المتوقع",
    years: "سنوات",
    requiredNestEgg: "رأس المال النهائي المطلوب",
    requiredCagr: "العائد المركب السنوي المطلوب",
    timeFreedom: "المدة المتوقعة للحرية المالية",
    realPurchasingPower: "القوة الشرائية الحقيقية",
    targetCapital: "رأس المال اللازم لتوفير الدخل المستهدف وفق الفائدة المختارة.",
    cagrNeeded: "العائد السنوي المركب اللازم للوصول إلى الهدف خلال المدة المحددة.",
    expectedTime: "المدة التقديرية باستخدام العائد المتوقع للمحفظة.",
    todayMoney: "قيمة رأس مال التقاعد المستقبلية محسوبة بقوة شراء اليوم.",
    wealthChart: "مسار تراكم ونمو الثروة",
    inflationChart: "تحليل التضخم والقوة الشرائية",
    projectedWealth: "القيمة المتوقعة للمحفظة",
    targetLine: "رأس المال المطلوب",
    nominalIncome: "الدخل الاسمي",
    realIncome: "القوة الشرائية الفعلية",
    adjustedIncome: "الدخل المطلوب بعد التضخم",
    savingsTitle: "حاسبة الادخار ونمو الراتب للتقاعد",
    savingsSubtitle: "احسب أثر الادخار الشهري المرتبط بالراتب مع استثماره وفق العائد المتوقع للمحفظة أعلاه.",
    startingCapital: "رأس المال المبدئي",
    monthlySalary: "الراتب الشهري الحالي",
    savingsRate: "نسبة الادخار الشهرية من الراتب",
    salaryGrowth: "الزيادة السنوية المتوقعة للراتب",
    duration: "مدة الاستثمار",
    finalWealth: "الثروة النهائية المتوقعة",
    contributions: "إجمالي رأس المال المستثمر",
    investmentGrowth: "النمو الناتج عن الاستثمار",
    endingSalary: "الراتب الشهري المتوقع في النهاية",
    monthlySavingNow: "الادخار الشهري الحالي",
    reset: "إعادة الافتراضات",
    live: "حساب مباشر",
    privacy: "تظل المدخلات على جهازك وتستخدم للمحاكاة فقط.",
    disclaimer: "محاكاة تعليمية للتخطيط فقط. النتائج تعتمد على الافتراضات ولا تمثل عوائد استثمارية مضمونة.",
    alreadyFunded: "الهدف ممول بالفعل",
    unavailable: "لا يمكن الوصول وفق الافتراضات الحالية",
  },
};

function readSavedInputs() {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculatePlanner(inputs) {
  const currentCapital = Math.max(0, safeNumber(inputs.currentCapital));
  const targetMonthlyIncome = Math.max(0, safeNumber(inputs.targetMonthlyIncome));
  const bankRate = clamp(safeNumber(inputs.bankRate), 0, 100) / 100;
  const targetYears = clamp(safeNumber(inputs.targetYears), 0, 80);
  const expectedCagr = clamp(safeNumber(inputs.expectedCagr), -99, 300) / 100;
  const inflationRate = clamp(safeNumber(inputs.inflationRate), -50, 300) / 100;

  const annualTarget = targetMonthlyIncome * 12;
  const requiredNestEgg = bankRate > 0 ? annualTarget / bankRate : 0;
  const multiplier = currentCapital > 0 ? requiredNestEgg / currentCapital : 0;

  let requiredCagr = null;
  if (requiredNestEgg > 0 && currentCapital > 0 && targetYears > 0) {
    requiredCagr = requiredNestEgg <= currentCapital ? 0 : (Math.pow(multiplier, 1 / targetYears) - 1) * 100;
  }

  let yearsToFreedom = null;
  if (requiredNestEgg > 0 && currentCapital > 0) {
    if (requiredNestEgg <= currentCapital) yearsToFreedom = 0;
    else if (expectedCagr > 0) yearsToFreedom = Math.log(multiplier) / Math.log(1 + expectedCagr);
  }

  const inflationFactor = Math.pow(Math.max(0.0001, 1 + inflationRate), targetYears);
  const realNestEgg = inflationFactor ? requiredNestEgg / inflationFactor : requiredNestEgg;
  const realMonthlyIncome = inflationFactor ? targetMonthlyIncome / inflationFactor : targetMonthlyIncome;
  const adjustedMonthlyIncome = targetMonthlyIncome * inflationFactor;

  const chartHorizon = Math.max(5, Math.ceil(targetYears || 0));
  const wealthPoints = Array.from({ length: chartHorizon + 1 }, (_, year) => ({
    year,
    value: Math.max(0, currentCapital * Math.pow(Math.max(0, 1 + expectedCagr), year)),
  }));

  return {
    currentCapital,
    targetMonthlyIncome,
    bankRate,
    targetYears,
    expectedCagr,
    inflationRate,
    requiredNestEgg,
    requiredCagr,
    yearsToFreedom,
    realNestEgg,
    realMonthlyIncome,
    adjustedMonthlyIncome,
    wealthPoints,
  };
}

function calculateSavings(inputs, annualReturn) {
  const startingCapital = Math.max(0, safeNumber(inputs.savingsStartingCapital));
  const monthlySalary = Math.max(0, safeNumber(inputs.monthlySalary));
  const savingsRate = clamp(safeNumber(inputs.monthlySavingsRate), 0, 100) / 100;
  const salaryGrowth = clamp(safeNumber(inputs.annualSalaryGrowth), -100, 300) / 100;
  const years = clamp(safeNumber(inputs.savingsYears), 0, 80);
  const months = Math.max(0, Math.round(years * 12));
  const monthlyReturn = annualReturn > -1 ? Math.pow(1 + annualReturn, 1 / 12) - 1 : -1;

  let wealth = startingCapital;
  let contributions = startingCapital;
  const trajectory = [{ month: 0, value: wealth }];

  for (let month = 1; month <= months; month += 1) {
    const completedYears = Math.floor((month - 1) / 12);
    const salary = monthlySalary * Math.pow(Math.max(0, 1 + salaryGrowth), completedYears);
    const contribution = salary * savingsRate;
    wealth = Math.max(0, wealth * Math.max(0, 1 + monthlyReturn) + contribution);
    contributions += contribution;
    if (month % 12 === 0 || month === months) trajectory.push({ month, value: wealth });
  }

  const endingSalary = monthlySalary * Math.pow(Math.max(0, 1 + salaryGrowth), years);
  return {
    finalWealth: wealth,
    totalContributions: contributions,
    investmentGrowth: wealth - contributions,
    endingSalary,
    monthlySavingNow: monthlySalary * savingsRate,
    trajectory,
  };
}

function formatCurrency(value, locale) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    notation: Math.abs(numeric) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(numeric) >= 1_000_000 ? 2 : 0,
  }).format(numeric);
}

function formatPercent(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toFixed(digits)}%`;
}

function formatDuration(years, labels, locale) {
  if (years === null || !Number.isFinite(years)) return labels.unavailable;
  if (years <= 0) return labels.alreadyFunded;
  const fullYears = Math.floor(years);
  const months = Math.round((years - fullYears) * 12);
  if (locale.startsWith("ar")) return `${fullYears} سنة${months ? ` و${months} شهر` : ""}`;
  return `${fullYears} yr${fullYears === 1 ? "" : "s"}${months ? ` ${months} mo` : ""}`;
}

export default function FinancialFreedomSimulator() {
  const { isArabic } = useLanguage();
  const { isDark } = useTheme();
  const labels = isArabic ? copy.ar : copy.en;
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [inputs, setInputs] = useState(readSavedInputs);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  }, [inputs]);

  const plan = useMemo(() => calculatePlanner(inputs), [inputs]);
  const savings = useMemo(() => calculateSavings(inputs, plan.expectedCagr), [inputs, plan.expectedCagr]);

  const palette = useMemo(() => ({
    text: isDark ? "#d9e7f5" : "#24374a",
    muted: isDark ? "#7f96ad" : "#62788d",
    grid: isDark ? "rgba(136,170,200,.12)" : "rgba(35,76,108,.12)",
    emerald: "#22e3a2",
    cyan: "#32d5ff",
    violet: "#8f79ff",
    amber: "#f8b84e",
    red: "#ff637d",
  }), [isDark]);

  const wealthChartData = useMemo(() => ({
    labels: plan.wealthPoints.map((point) => `${point.year}`),
    datasets: [
      {
        label: labels.projectedWealth,
        data: plan.wealthPoints.map((point) => point.value),
        borderColor: palette.emerald,
        backgroundColor: "rgba(34,227,162,.10)",
        pointBackgroundColor: palette.emerald,
        pointBorderWidth: 0,
        pointRadius: plan.wealthPoints.length > 16 ? 0 : 3,
        borderWidth: 3,
        tension: 0.35,
        fill: true,
      },
      {
        label: labels.targetLine,
        data: plan.wealthPoints.map(() => plan.requiredNestEgg),
        borderColor: palette.cyan,
        backgroundColor: "transparent",
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [7, 7],
        tension: 0,
      },
    ],
  }), [plan.wealthPoints, plan.requiredNestEgg, labels, palette]);

  const inflationChartData = useMemo(() => ({
    labels: [labels.nominalIncome, labels.realIncome, labels.adjustedIncome],
    datasets: [{
      data: [plan.targetMonthlyIncome, plan.realMonthlyIncome, plan.adjustedMonthlyIncome],
      backgroundColor: [palette.cyan, palette.amber, palette.emerald],
      borderWidth: 0,
      borderRadius: 10,
      maxBarThickness: 72,
    }],
  }), [labels, plan.targetMonthlyIncome, plan.realMonthlyIncome, plan.adjustedMonthlyIncome, palette]);

  const commonChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 450 },
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: {
        rtl: isArabic,
        textDirection: isArabic ? "rtl" : "ltr",
        labels: {
          color: palette.muted,
          usePointStyle: true,
          boxWidth: 8,
          padding: 16,
          font: { family: isArabic ? "Cairo, Tahoma, Arial" : "Inter, Arial", size: 11, weight: "600" },
        },
      },
      tooltip: {
        rtl: isArabic,
        textDirection: isArabic ? "rtl" : "ltr",
        backgroundColor: isDark ? "#0b1c2c" : "#ffffff",
        titleColor: palette.text,
        bodyColor: palette.text,
        borderColor: palette.grid,
        borderWidth: 1,
        padding: 12,
        callbacks: { label: (context) => `${context.dataset.label || ""}: ${formatCurrency(context.raw, locale)}` },
      },
    },
    scales: {
      x: {
        ticks: { color: palette.muted, maxRotation: 0, font: { size: 10 } },
        grid: { color: palette.grid, drawBorder: false },
        title: { display: true, text: labels.years, color: palette.muted, font: { size: 10, weight: "600" } },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: palette.muted,
          font: { size: 10 },
          callback: (value) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value),
        },
        grid: { color: palette.grid, drawBorder: false },
      },
    },
  }), [isArabic, isDark, labels.years, locale, palette]);

  const barOptions = useMemo(() => ({
    ...commonChartOptions,
    plugins: { ...commonChartOptions.plugins, legend: { display: false } },
    scales: {
      ...commonChartOptions.scales,
      x: { ...commonChartOptions.scales.x, title: { display: false }, grid: { display: false } },
    },
  }), [commonChartOptions]);

  const update = (key) => (event) => {
    setInputs((current) => ({ ...current, [key]: event.target.value }));
  };

  const reset = () => setInputs(DEFAULTS);

  return (
    <section id="financial-freedom-planner" className="financial-planner-v391" dir={isArabic ? "rtl" : "ltr"}>
      <header className="financial-planner-header-v391">
        <div>
          <span className="eyebrow"><Sparkles size={14}/>{labels.eyebrow}</span>
          <h2>{labels.title}</h2>
          <p>{labels.subtitle}</p>
        </div>
        <div className="financial-planner-live-v391"><span/><b>{labels.live}</b></div>
      </header>

      <div className="financial-planner-grid-v391">
        <aside className="financial-planner-controls-v391">
          <div className="financial-planner-card-title-v391"><Calculator/><div><b>{labels.inputs}</b><small>{labels.privacy}</small></div></div>
          <div className="financial-inputs-v391">
            <PlannerInput label={labels.currentCapital} value={inputs.currentCapital} onChange={update("currentCapital")} suffix="EGP" min="0" step="10000"/>
            <PlannerInput label={labels.targetMonthlyIncome} value={inputs.targetMonthlyIncome} onChange={update("targetMonthlyIncome")} suffix="EGP" min="0" step="5000"/>
            <PlannerInput label={labels.bankRate} value={inputs.bankRate} onChange={update("bankRate")} suffix="%" min="0.1" max="100" step="0.5"/>
            <PlannerInput label={labels.targetYears} value={inputs.targetYears} onChange={update("targetYears")} suffix={labels.years} min="1" max="80" step="1"/>
            <PlannerInput label={labels.expectedCagr} value={inputs.expectedCagr} onChange={update("expectedCagr")} suffix="%" min="-99" max="300" step="0.5"/>
            <PlannerInput label={labels.inflationRate} value={inputs.inflationRate} onChange={update("inflationRate")} suffix="%" min="-50" max="300" step="0.5"/>
          </div>
          <button className="financial-planner-reset-v391" type="button" onClick={reset}><RefreshCcw size={15}/>{labels.reset}</button>
        </aside>

        <div className="financial-planner-main-v391">
          <div className="financial-kpi-grid-v391">
            <PlannerKpi icon={Landmark} tone="emerald" title={labels.requiredNestEgg} value={formatCurrency(plan.requiredNestEgg, locale)} copy={labels.targetCapital}/>
            <PlannerKpi icon={TrendingUp} tone="cyan" title={labels.requiredCagr} value={plan.requiredCagr === null ? "—" : formatPercent(plan.requiredCagr)} copy={labels.cagrNeeded}/>
            <PlannerKpi icon={Target} tone="violet" title={labels.timeFreedom} value={formatDuration(plan.yearsToFreedom, labels, locale)} copy={labels.expectedTime}/>
            <PlannerKpi icon={ShieldCheck} tone="amber" title={labels.realPurchasingPower} value={formatCurrency(plan.realNestEgg, locale)} copy={labels.todayMoney}/>
          </div>

          <div className="financial-chart-grid-v391">
            <article className="financial-chart-card-v391">
              <header><TrendingUp/><div><b>{labels.wealthChart}</b><small>{formatCurrency(plan.requiredNestEgg, locale)}</small></div></header>
              <div className="financial-chart-canvas-v391"><Line data={wealthChartData} options={commonChartOptions}/></div>
            </article>
            <article className="financial-chart-card-v391">
              <header><BarChart3/><div><b>{labels.inflationChart}</b><small>{formatPercent(inputs.inflationRate)} · {inputs.targetYears} {labels.years}</small></div></header>
              <div className="financial-chart-canvas-v391"><Bar data={inflationChartData} options={barOptions}/></div>
            </article>
          </div>
        </div>
      </div>

      <article className="retirement-savings-v391">
        <header>
          <div><span className="retirement-icon-v391"><Coins/></span><div><h3>{labels.savingsTitle}</h3><p>{labels.savingsSubtitle}</p></div></div>
          <span className="retirement-cagr-v391"><small>CAGR</small><b>{formatPercent(plan.expectedCagr * 100)}</b></span>
        </header>
        <div className="retirement-savings-layout-v391">
          <div className="retirement-input-grid-v391">
            <PlannerInput label={labels.startingCapital} value={inputs.savingsStartingCapital} onChange={update("savingsStartingCapital")} suffix="EGP" min="0" step="10000"/>
            <PlannerInput label={labels.monthlySalary} value={inputs.monthlySalary} onChange={update("monthlySalary")} suffix="EGP" min="0" step="1000"/>
            <PlannerInput label={labels.savingsRate} value={inputs.monthlySavingsRate} onChange={update("monthlySavingsRate")} suffix="%" min="0" max="100" step="1"/>
            <PlannerInput label={labels.salaryGrowth} value={inputs.annualSalaryGrowth} onChange={update("annualSalaryGrowth")} suffix="%" min="-100" max="300" step="0.5"/>
            <PlannerInput label={labels.duration} value={inputs.savingsYears} onChange={update("savingsYears")} suffix={labels.years} min="1" max="80" step="1"/>
          </div>
          <div className="retirement-result-v391">
            <span><WalletCards/></span>
            <small>{labels.finalWealth}</small>
            <strong>{formatCurrency(savings.finalWealth, locale)}</strong>
            <div>
              <ResultMetric label={labels.contributions} value={formatCurrency(savings.totalContributions, locale)}/>
              <ResultMetric label={labels.investmentGrowth} value={formatCurrency(savings.investmentGrowth, locale)} tone={savings.investmentGrowth >= 0 ? "positive" : "negative"}/>
              <ResultMetric label={labels.monthlySavingNow} value={formatCurrency(savings.monthlySavingNow, locale)}/>
              <ResultMetric label={labels.endingSalary} value={formatCurrency(savings.endingSalary, locale)}/>
            </div>
          </div>
        </div>
      </article>

      <footer className="financial-planner-disclaimer-v391"><ShieldCheck/><span>{labels.disclaimer}</span></footer>
    </section>
  );
}

function PlannerInput({ label, value, onChange, suffix, ...inputProps }) {
  return (
    <label className="financial-input-v391">
      <span>{label}</span>
      <div><input type="number" inputMode="decimal" value={value} onChange={onChange} {...inputProps}/><b>{suffix}</b></div>
    </label>
  );
}

function PlannerKpi({ icon: Icon, tone, title, value, copy: description }) {
  return (
    <article className={`financial-kpi-v391 ${tone}`}>
      <span><Icon/></span>
      <small>{title}</small>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function ResultMetric({ label, value, tone = "" }) {
  return <span className={tone}><small>{label}</small><b>{value}</b></span>;
}
