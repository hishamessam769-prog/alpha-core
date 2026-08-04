import { useEffect, useMemo, useState } from "react";
import { BarChart3, BriefcaseBusiness, Eye, FileText, History, Mail, Plus, Save, Send, ShieldAlert, Trash2, Users, X } from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import PortfolioReportStudio from "../components/PortfolioReportStudio";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";
import { calculateMonth, dateTimeLabel, formatPercent, monthLabel } from "../lib/calculations";
import { dispatchQueuedPushNotifications } from "../lib/pushNotifications";

const makeHolding = (index) => ({
  local_id: crypto.randomUUID(),
  ticker: "",
  weight: 20,
  open_price: 0,
  close_price: 0,
  investment_thesis: "",
  sort_order: index,
});

const makeMonth = (portfolioId, benchmarkTicker = "EGX30CAP") => ({
  id: null,
  portfolio_id: portfolioId || null,
  month_key: new Date().toISOString().slice(0, 7),
  strategy_name: "ALPHA CORE Strategy",
  benchmark_ticker: benchmarkTicker || "EGX30CAP",
  benchmark_open: 0,
  benchmark_close: 0,
  live_portfolio_return: 0,
  live_benchmark_return: 0,
  live_alpha: 0,
  public_commentary: "",
  update_title: "",
  monthly_objective: "Outperform EGX30 Capped through disciplined stock selection.",
  investor_guidance_title: "Published Target Allocation",
  investor_guidance: "Existing investors should rebalance to the published target weights. New investors should allocate according to the current portfolio.",
  current_investor_guidance: "Existing investors should rebalance to the published target weights.",
  new_investor_guidance: "New investors should allocate according to the current published weights.",
  is_demo: false,
  is_published: false,
  is_closed: false,
  final_portfolio_return: null,
  final_benchmark_return: null,
  holdings: Array.from({ length: 5 }, (_, index) => makeHolding(index)),
  swaps: [],
  snapshots: [],
});

const blankPortfolio = () => ({
  id: null,
  slug: "",
  name: "",
  name_ar: "",
  description: "",
  description_ar: "",
  benchmark_ticker: "EGX30CAP",
  launch_date: new Date().toISOString().slice(0, 10),
  status: "live",
  is_published: true,
  is_demo: false,
});

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { t, isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [portfolioForm, setPortfolioForm] = useState(blankPortfolio());
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [months, setMonths] = useState([]);
  const [form, setForm] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [reportOpen, setReportOpen] = useState(false);

  const isSuperAdmin = Boolean(profile?.is_super_admin);
  const metrics = useMemo(() => calculateMonth(form), [form]);
  const currentPortfolio = portfolios.find((item) => item.id === selectedPortfolioId) || null;
  const portfolioMonths = useMemo(() => months.filter((item) => item.portfolio_id === selectedPortfolioId), [months, selectedPortfolioId]);

  const loadData = async ({ preferredPortfolioId, preferredMonthId } = {}) => {
    const [{ data: portfolioRows, error: portfolioError }, { data: monthRows, error: monthError }, { data: memberRows, error: memberError }, { data: activityRows, error: activityError }] = await Promise.all([
      supabase.from("portfolios").select("*").order("created_at", { ascending: true }),
      supabase.from("strategy_months").select("*, holdings(*), swaps(*), snapshots(*)").order("month_key", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, newsletter_opt_in, created_at, is_admin, is_super_admin").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("occurred_at", { ascending: false }).limit(60),
    ]);
    const error = portfolioError || monthError || memberError || activityError;
    if (error) setMessage(error.message);

    const nextPortfolios = portfolioRows || [];
    const nextMonths = monthRows || [];
    setPortfolios(nextPortfolios);
    setMonths(nextMonths);
    setMembers(memberRows || []);
    setActivities(activityRows || []);

    const portfolioId = preferredPortfolioId || selectedPortfolioId || nextPortfolios[0]?.id || "";
    setSelectedPortfolioId(portfolioId);
    const portfolio = nextPortfolios.find((item) => item.id === portfolioId);
    const withinPortfolio = nextMonths.filter((item) => item.portfolio_id === portfolioId);
    const chosen = withinPortfolio.find((item) => item.id === preferredMonthId)
      || withinPortfolio.find((item) => item.id === selectedId)
      || withinPortfolio[0];

    if (chosen) {
      setSelectedId(chosen.id);
      setForm(normalise(chosen));
    } else {
      setSelectedId("");
      setForm(makeMonth(portfolioId, portfolio?.benchmark_ticker));
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectPortfolio = (id) => {
    const portfolio = portfolios.find((item) => item.id === id);
    const firstMonth = months.find((item) => item.portfolio_id === id);
    setSelectedPortfolioId(id);
    setSelectedId(firstMonth?.id || "");
    setForm(firstMonth ? normalise(firstMonth) : makeMonth(id, portfolio?.benchmark_ticker));
    setMessage("");
  };

  const selectMonth = (id) => {
    const chosen = months.find((month) => month.id === id);
    setSelectedId(id);
    setForm(normalise(chosen));
    setMessage("");
  };

  const openPortfolioEditor = (portfolio = null) => {
    setPortfolioForm(portfolio ? { ...portfolio } : blankPortfolio());
    setShowPortfolioForm(true);
  };

  const savePortfolio = async () => {
    if (!portfolioForm.name.trim()) return setMessage(isArabic ? "اكتب اسم المحفظة" : "Enter the portfolio name.");
    const slug = (portfolioForm.slug || portfolioForm.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `portfolio-${Date.now()}`;
    const payload = {
      slug,
      name: portfolioForm.name.trim(),
      name_ar: portfolioForm.name_ar || null,
      description: portfolioForm.description || null,
      description_ar: portfolioForm.description_ar || null,
      benchmark_ticker: (portfolioForm.benchmark_ticker || "EGX30CAP").toUpperCase(),
      launch_date: portfolioForm.launch_date,
      status: portfolioForm.status,
      is_published: Boolean(portfolioForm.is_published),
      is_demo: Boolean(portfolioForm.is_demo),
      updated_at: new Date().toISOString(),
    };
    let id = portfolioForm.id;
    if (id) {
      const { error } = await supabase.from("portfolios").update(payload).eq("id", id);
      if (error) return setMessage(error.message);
    } else {
      const { data, error } = await supabase.from("portfolios").insert({ ...payload, created_by: profile.id }).select("id").single();
      if (error) return setMessage(error.message);
      id = data.id;
    }
    setShowPortfolioForm(false);
    setMessage(isArabic ? "تم حفظ المحفظة" : "Portfolio saved.");
    await loadData({ preferredPortfolioId: id });
  };

  const updateHolding = (index, field, value) => {
    setForm((current) => ({
      ...current,
      holdings: current.holdings.map((holding, currentIndex) => currentIndex === index ? {
        ...holding,
        [field]: field === "ticker"
          ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
          : ["weight", "open_price", "close_price"].includes(field)
            ? Number(value)
            : value,
      } : holding),
    }));
  };

  const equalise = () => {
    const weight = 100 / Math.max(form.holdings.length, 1);
    setForm((current) => ({ ...current, holdings: current.holdings.map((holding) => ({ ...holding, weight: Number(weight.toFixed(2)) })) }));
  };

  const addHolding = () => setForm((current) => ({ ...current, holdings: [...current.holdings, makeHolding(current.holdings.length)] }));
  const removeHolding = (index) => {
    if (form.holdings.length <= 1) return;
    setForm((current) => ({ ...current, holdings: current.holdings.filter((_, currentIndex) => currentIndex !== index) }));
  };

  const persistMonth = async ({ publish = form.is_published, close = false } = {}) => {
    if (saving) return;
    if (!form.portfolio_id) return setMessage(isArabic ? "اختار المحفظة الأول" : "Choose a portfolio first.");
    if (!form.holdings.length || !form.holdings.every((holding) => holding.ticker.trim())) return setMessage(isArabic ? "اكتب رمز كل سهم قبل الحفظ" : "Enter every ticker before saving.");
    const totalWeight = form.holdings.reduce((sum, holding) => sum + Number(holding.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.15) return setMessage(isArabic ? `مجموع الأوزان ${totalWeight.toFixed(2)}% ولازم يساوي 100%` : `Weights total ${totalWeight.toFixed(2)}%. They must equal 100%.`);

    setSaving(true);
    setMessage(close ? (isArabic ? "جاري إغلاق الشهر…" : "Closing month…") : (isArabic ? "جاري الحفظ…" : "Saving update…"));
    try {
      const payload = {
        portfolio_id: form.portfolio_id,
        month_key: form.month_key,
        strategy_name: form.strategy_name,
        benchmark_ticker: (form.benchmark_ticker || currentPortfolio?.benchmark_ticker || "EGX30CAP").toUpperCase(),
        benchmark_open: Number(form.benchmark_open),
        benchmark_close: Number(form.benchmark_close),
        live_portfolio_return: Number(metrics.portfolioReturn.toFixed(8)),
        live_benchmark_return: Number(metrics.benchmarkReturn.toFixed(8)),
        live_alpha: Number(metrics.alpha.toFixed(8)),
        public_commentary: form.public_commentary,
        update_title: form.update_title,
        monthly_objective: form.monthly_objective,
        investor_guidance_title: form.investor_guidance_title,
        investor_guidance: form.investor_guidance,
        current_investor_guidance: form.current_investor_guidance || form.investor_guidance,
        new_investor_guidance: form.new_investor_guidance || form.investor_guidance,
        is_demo: Boolean(form.is_demo),
        is_published: Boolean(publish || close),
        is_closed: Boolean(close || form.is_closed),
        final_portfolio_return: close ? Number(metrics.portfolioReturn.toFixed(8)) : form.final_portfolio_return,
        final_benchmark_return: close ? Number(metrics.benchmarkReturn.toFixed(8)) : form.final_benchmark_return,
        updated_at: new Date().toISOString(),
      };
      let monthId = form.id;

      if (monthId) {
        const { error } = await supabase.from("strategy_months").update(payload).eq("id", monthId);
        if (error) throw error;
        const deletes = await Promise.all([
          supabase.from("holdings").delete().eq("month_id", monthId),
          supabase.from("swaps").delete().eq("month_id", monthId),
        ]);
        const deleteError = deletes.find((result) => result.error)?.error;
        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase.from("strategy_months").insert({ ...payload, created_by: profile.id }).select("id").single();
        if (error) throw error;
        monthId = data.id;
      }

      const { error: holdingsError } = await supabase.from("holdings").insert(
        form.holdings.map((holding, index) => ({
          month_id: monthId,
          ticker: holding.ticker.trim(),
          weight: Number(holding.weight),
          open_price: Number(holding.open_price),
          close_price: Number(holding.close_price),
          investment_thesis: holding.investment_thesis || null,
          sort_order: index,
        }))
      );
      if (holdingsError) throw holdingsError;

      const validSwaps = form.swaps.filter((swap) => swap.removed_ticker && swap.added_ticker);
      if (validSwaps.length) {
        const { error } = await supabase.from("swaps").insert(validSwaps.map((swap) => ({
          month_id: monthId,
          removed_ticker: swap.removed_ticker.toUpperCase(),
          added_ticker: swap.added_ticker.toUpperCase(),
          reason: swap.reason,
        })));
        if (error) throw error;
      }

      if (publish || close) {
        const { error } = await supabase.from("snapshots").upsert({
          month_id: monthId,
          snapshot_date: new Date().toISOString().slice(0, 10),
          portfolio_return: Number(metrics.portfolioReturn.toFixed(8)),
          benchmark_return: Number(metrics.benchmarkReturn.toFixed(8)),
        }, { onConflict: "month_id,snapshot_date" });
        if (error) throw error;
      }

      setMessage(close
        ? (isArabic ? "تم إغلاق الشهر وتثبيت النتيجة" : "Month closed and result frozen.")
        : publish
          ? (isArabic ? "تم نشر التحديث للأعضاء" : "Update published to members.")
          : (isArabic ? "تم حفظ المسودة" : "Draft saved privately."));
      if (publish || close) void dispatchQueuedPushNotifications();
      await loadData({ preferredPortfolioId: form.portfolio_id, preferredMonthId: monthId });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteMonth = async () => {
    if (!isSuperAdmin || !form.id) return;
    const label = monthLabel(form.month_key, false, locale);
    const confirmed = window.confirm(isArabic
      ? `تحذير واضح: سيتم حذف شهر ${label} نهائيًا بكل الأسهم والتغييرات واللقطات المرتبطة به. لا يمكن التراجع. هل تؤكد الحذف؟`
      : `Clear warning: ${label} and all related holdings, changes and snapshots will be permanently deleted. This cannot be undone. Confirm deletion?`);
    if (!confirmed) return;
    const { error } = await supabase.rpc("delete_strategy_month", { p_month_id: form.id });
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم حذف الشهر بالكامل بواسطة Super Admin" : "Month permanently deleted by Super Admin.");
    await loadData({ preferredPortfolioId: selectedPortfolioId });
  };

  const deletePortfolio = async () => {
    if (!isSuperAdmin || !currentPortfolio?.id) return;
    const count = portfolioMonths.length;
    const confirmed = window.confirm(isArabic
      ? `تحذير شديد: سيتم حذف محفظة ${currentPortfolio.name} بالكامل مع ${count} شهر وكل الأسهم والتغييرات واللقطات. لا يمكن التراجع. هل تؤكد؟`
      : `Critical warning: ${currentPortfolio.name} will be permanently deleted with ${count} month(s), holdings, changes and snapshots. This cannot be undone. Confirm?`);
    if (!confirmed) return;
    const { error } = await supabase.rpc("delete_portfolio_cascade", { p_portfolio_id: currentPortfolio.id });
    if (error) return setMessage(error.message);
    setShowPortfolioForm(false);
    setMessage(isArabic ? "تم حذف المحفظة بالكامل بواسطة Super Admin" : "Portfolio permanently deleted by Super Admin.");
    await loadData();
  };

  const deleteDemoData = async () => {
    if (!isSuperAdmin) return;
    const confirmed = window.confirm(isArabic
      ? "سيتم حذف كل السجلات المحددة كبيانات تجريبية فقط من المحافظ والشهور والتوصيات والتقارير. البيانات الحقيقية لن تُمس. هل تؤكد؟"
      : "All records explicitly marked as demo data will be deleted from portfolios, months, recommendations and reports. Real data will not be touched. Confirm?" );
    if (!confirmed) return;
    const { data, error } = await supabase.rpc("delete_demo_data");
    if (error) return setMessage(error.message);
    setMessage(isArabic ? `تم تنظيف البيانات التجريبية بنجاح: ${JSON.stringify(data)}` : `Demo data cleaned successfully: ${JSON.stringify(data)}`);
    await loadData();
  };

  if (!form) return <div className="loading-screen"><div className="loader-ring"/><p>{t("loading")}</p></div>;

  const publicMembers = members.filter((member) => !member.is_admin);
  const newsletterMembers = publicMembers.filter((member) => member.newsletter_opt_in);

  return (
    <div className="dashboard-shell admin-shell-v21">
      <DashboardHeader admin />
      <div className="admin-workspace-v21 portfolio-admin-v22">
        <aside className="admin-months-v21 portfolio-sidebar-v22">
          <div className="admin-profile-v21"><small>{isArabic ? "مساحة المحافظ" : "PORTFOLIO WORKSPACE"}</small><b>{profile?.full_name || profile?.email}</b></div>

          <div className="portfolio-switcher-v22">
            <small>{isArabic ? "المحفظة الحالية" : "CURRENT PORTFOLIO"}</small>
            <select value={selectedPortfolioId} onChange={(e) => selectPortfolio(e.target.value)}>
              {portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{isArabic && portfolio.name_ar ? portfolio.name_ar : portfolio.name}</option>)}
            </select>
            <div><button className="button subtle compact" onClick={() => openPortfolioEditor(currentPortfolio)}><Save size={13}/>{isArabic ? "تعديل" : "Edit"}</button><button className="button gold compact" onClick={() => openPortfolioEditor()}><Plus size={13}/>{isArabic ? "جديدة" : "New"}</button></div>
          </div>

          <button className="button gold full" disabled={!selectedPortfolioId} onClick={() => { setSelectedId(""); setForm(makeMonth(selectedPortfolioId, currentPortfolio?.benchmark_ticker)); setMessage(isArabic ? "تم إنشاء شهر جديد غير محفوظ" : "New unsaved month created."); }}><Plus size={16}/>{t("newMonth")}</button>
          <nav>
            {portfolioMonths.map((month) => (
              <button className={selectedId === month.id ? "active" : ""} key={month.id} onClick={() => selectMonth(month.id)}>
                <span>{monthLabel(month.month_key, false, locale)}</span>
                <small className={month.is_closed ? "final" : month.is_published ? "live" : "draft"}>{month.is_closed ? t("final") : month.is_published ? t("live") : t("draft")}</small>
              </button>
            ))}
          </nav>
          <a className="button subtle full" href="/dashboard"><Eye size={16}/>{t("viewMember")}</a>
        </aside>

        <main className="admin-content-v21">
          <header className="admin-top-v21">
            <div><span className="eyebrow">{t("adminCentre")}</span><h1>{currentPortfolio ? (isArabic && currentPortfolio.name_ar ? currentPortfolio.name_ar : currentPortfolio.name) : (isArabic ? "المحافظ" : "Portfolios")}</h1><p>{form.id ? monthLabel(form.month_key, false, locale) : (isArabic ? "شهر جديد" : "New month")}</p></div>
            <div className="admin-actions-v21">
              {isSuperAdmin && form.id && <button className="button danger" onClick={deleteMonth} title={isArabic ? "حذف الشهر نهائيًا" : "Permanently delete month"}><Trash2 size={15}/></button>}
              <button className="button subtle" disabled={!form?.holdings?.length} onClick={() => setReportOpen(true)}><FileText size={16}/>Generate Portfolio Report</button>
              <button className="button subtle" disabled={saving || !selectedPortfolioId} onClick={() => persistMonth({ publish: false })}><Save size={16}/>{t("saveDraft")}</button>
              <button className="button gold" disabled={saving || !selectedPortfolioId} onClick={() => persistMonth({ publish: true })}><Send size={16}/>{t("publishUpdate")}</button>
              <button className="button green" disabled={saving || form.is_closed || !selectedPortfolioId} onClick={() => persistMonth({ publish: true, close: true })}>{t("closeMonth")}</button>
            </div>
          </header>

          {message && <div className="notice-bar">{message}</div>}

          {showPortfolioForm && <section className="panel-v21 padded-v21 portfolio-editor-v22">
            <div className="panel-heading-v21"><div><span className="eyebrow">PORTFOLIO</span><h2>{portfolioForm.id ? (isArabic ? "تعديل المحفظة" : "Edit portfolio") : (isArabic ? "إنشاء محفظة جديدة" : "Create a new portfolio")}</h2></div><button className="icon-button" onClick={() => setShowPortfolioForm(false)}><X size={16}/></button></div>
            <div className="admin-form-grid-v21">
              <label>{isArabic ? "الاسم بالإنجليزي" : "Name"}<input value={portfolioForm.name || ""} onChange={(e) => setPortfolioForm({ ...portfolioForm, name: e.target.value })}/></label>
              <label>{isArabic ? "الاسم بالعربي" : "Arabic name"}<input value={portfolioForm.name_ar || ""} onChange={(e) => setPortfolioForm({ ...portfolioForm, name_ar: e.target.value })}/></label>
              <label>{isArabic ? "الرابط المختصر" : "Slug"}<input placeholder="alpha-core-growth" value={portfolioForm.slug || ""} onChange={(e) => setPortfolioForm({ ...portfolioForm, slug: e.target.value })}/></label>
              <label>{isArabic ? "رمز المؤشر" : "Benchmark ticker"}<input value={portfolioForm.benchmark_ticker || "EGX30CAP"} onChange={(e) => setPortfolioForm({ ...portfolioForm, benchmark_ticker: e.target.value.toUpperCase() })}/></label>
              <label>{isArabic ? "تاريخ الإطلاق" : "Launch date"}<input type="date" value={portfolioForm.launch_date || ""} onChange={(e) => setPortfolioForm({ ...portfolioForm, launch_date: e.target.value })}/></label>
              <label>{isArabic ? "الحالة" : "Status"}<select value={portfolioForm.status} onChange={(e) => setPortfolioForm({ ...portfolioForm, status: e.target.value })}><option value="draft">Draft</option><option value="live">Live</option><option value="closed">Closed</option></select></label>
              <label className="wide">{isArabic ? "الوصف بالإنجليزي" : "Description"}<textarea rows="3" value={portfolioForm.description || ""} onChange={(e) => setPortfolioForm({ ...portfolioForm, description: e.target.value })}/></label>
              <label className="wide">{isArabic ? "الوصف بالعربي" : "Arabic description"}<textarea rows="3" value={portfolioForm.description_ar || ""} onChange={(e) => setPortfolioForm({ ...portfolioForm, description_ar: e.target.value })}/></label>
              <label className="check-label-v22"><input type="checkbox" checked={Boolean(portfolioForm.is_published)} onChange={(e) => setPortfolioForm({ ...portfolioForm, is_published: e.target.checked })}/>{isArabic ? "إظهار المحفظة للأعضاء" : "Publish portfolio to members"}</label><label className="check-label-v22"><input type="checkbox" checked={Boolean(portfolioForm.is_demo)} onChange={(e) => setPortfolioForm({ ...portfolioForm, is_demo: e.target.checked })}/>{isArabic ? "تمييز كبيانات تجريبية" : "Mark as demo data"}</label>
            </div>
            <div className="editor-buttons-v22"><button className="button gold" onClick={savePortfolio}><Save size={15}/>{isArabic ? "حفظ المحفظة" : "Save portfolio"}</button>{isSuperAdmin && portfolioForm.id && <button className="button danger" onClick={deletePortfolio}><Trash2 size={15}/>{isArabic ? "حذف المحفظة بالكامل" : "Delete full portfolio"}</button>}</div>
          </section>}

          <section className="admin-summary-grid-v21">
            <Summary icon={<BriefcaseBusiness/>} label={isArabic ? "عدد المحافظ" : "Portfolios"} value={String(portfolios.length)} tone="neutral"/>
            <Summary icon={<BarChart3/>} label={t("portfolioMtd")} value={formatPercent(metrics.portfolioReturn)} tone="blue"/>
            <Summary icon={<BarChart3/>} label={t("benchmarkMtd")} value={formatPercent(metrics.benchmarkReturn)} tone="gold"/>
            <Summary icon={<BarChart3/>} label={t("monthlyAlpha")} value={formatPercent(metrics.alpha)} tone={metrics.alpha >= 0 ? "green" : "red"}/>
            <Summary icon={<Users/>} label={t("registeredUsers")} value={String(publicMembers.length)} tone="neutral"/>
            <Summary icon={<Mail/>} label={t("newsletterOptIns")} value={String(newsletterMembers.length)} tone="neutral"/>
          </section>

          <section className="admin-grid-v21">
            <article className="panel-v21 padded-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">SETUP</span><h2>{t("monthSetup")}</h2></div></div>
              <div className="admin-form-grid-v21">
                <label>{t("month")}<input type="month" value={form.month_key} onChange={(e) => setForm({ ...form, month_key: e.target.value })}/></label>
                <label>{t("strategyName")}<input value={form.strategy_name || ""} onChange={(e) => setForm({ ...form, strategy_name: e.target.value })}/></label>
                <label>{isArabic ? "رمز المؤشر" : "Benchmark ticker"}<input value={form.benchmark_ticker || "EGX30CAP"} onChange={(e) => setForm({ ...form, benchmark_ticker: e.target.value.toUpperCase() })}/></label>
                <label>{t("benchmarkOpen")}<input type="number" step=".01" value={form.benchmark_open} onChange={(e) => setForm({ ...form, benchmark_open: Number(e.target.value) })}/></label>
                <label>{t("benchmarkLatest")}<input type="number" step=".01" value={form.benchmark_close} onChange={(e) => setForm({ ...form, benchmark_close: Number(e.target.value) })}/></label>
                <label className="wide">{t("updateTitle")}<input value={form.update_title || ""} onChange={(e) => setForm({ ...form, update_title: e.target.value })}/></label>
                <label className="wide">{t("publicCommentary")}<textarea rows="5" value={form.public_commentary || ""} onChange={(e) => setForm({ ...form, public_commentary: e.target.value })}/></label>
                <label className="wide">{t("monthlyObjective")}<textarea rows="3" value={form.monthly_objective || ""} onChange={(e) => setForm({ ...form, monthly_objective: e.target.value })}/></label>
                <label>{t("guidanceTitle")}<input value={form.investor_guidance_title || ""} onChange={(e) => setForm({ ...form, investor_guidance_title: e.target.value })}/></label>
                <label className="wide">{t("guidance")}<textarea rows="4" value={form.investor_guidance || ""} onChange={(e) => setForm({ ...form, investor_guidance: e.target.value })}/></label>
                <label className="wide">{isArabic ? "تعليمات المستثمر الحالي" : "Existing investor guidance"}<textarea rows="4" value={form.current_investor_guidance || ""} onChange={(e) => setForm({ ...form, current_investor_guidance: e.target.value })}/></label>
                <label className="wide">{isArabic ? "تعليمات المستثمر الجديد" : "New investor guidance"}<textarea rows="4" value={form.new_investor_guidance || ""} onChange={(e) => setForm({ ...form, new_investor_guidance: e.target.value })}/></label>
                <label className="check-label-v22"><input type="checkbox" checked={Boolean(form.is_demo)} onChange={(e) => setForm({ ...form, is_demo: e.target.checked })}/>{isArabic ? "هذا الشهر بيانات تجريبية" : "This month is demo data"}</label>
              </div>
            </article>

            <article className="panel-v21 holdings-editor-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">PORTFOLIO</span><h2>{t("officialPortfolio")}</h2><p>{isArabic ? "يمكن إضافة أو حذف أي عدد من الأسهم. مجموع الأوزان لازم يساوي 100%." : "Add or remove any number of holdings. Total weights must equal 100%."}</p></div><div className="editor-buttons-v22"><button className="button subtle compact" onClick={addHolding}><Plus size={14}/>{isArabic ? "سهم" : "Holding"}</button><button className="button subtle compact" onClick={equalise}>{t("equalise")}</button></div></div>
              <div className="table-scroll">
                <table className="data-table-v21 admin-data-table">
                  <thead><tr><th>{t("ticker")}</th><th>{t("weight")}</th><th>{t("open")}</th><th>{t("latest")}</th><th>{t("return")}</th><th>{t("contribution")}</th><th>{isArabic ? "الفكرة الاستثمارية" : "Investment thesis"}</th><th></th></tr></thead>
                  <tbody>{form.holdings.map((holding, index) => {
                    const calculated = metrics.rows[index] || {};
                    return <tr key={holding.id || holding.local_id}>
                      <td><input className="admin-table-input ticker" value={holding.ticker} onChange={(e) => updateHolding(index, "ticker", e.target.value)}/></td>
                      <td><input className="admin-table-input" type="number" step=".01" value={holding.weight} onChange={(e) => updateHolding(index, "weight", e.target.value)}/></td>
                      <td><input className="admin-table-input" type="number" step=".01" value={holding.open_price} onChange={(e) => updateHolding(index, "open_price", e.target.value)}/></td>
                      <td><input className="admin-table-input" type="number" step=".01" value={holding.close_price} onChange={(e) => updateHolding(index, "close_price", e.target.value)}/></td>
                      <td className={calculated.mtd >= 0 ? "positive" : "negative"}>{formatPercent(calculated.mtd)}</td>
                      <td className={calculated.contribution >= 0 ? "positive" : "negative"}>{formatPercent(calculated.contribution)}</td>
                      <td><textarea className="admin-table-thesis-v31" rows="2" value={holding.investment_thesis || ""} onChange={(e) => updateHolding(index, "investment_thesis", e.target.value)} placeholder={isArabic ? "لماذا اخترنا هذا السهم؟" : "Why is this stock selected?"}/></td>
                      <td><button className="icon-button" onClick={() => removeHolding(index)}><Trash2 size={14}/></button></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </article>

            <article className="panel-v21 padded-v21 decision-editor-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">DECISIONS</span><h2>{t("decisionLog")}</h2></div><button className="button subtle compact" onClick={() => setForm({ ...form, swaps: [...form.swaps, { local_id: crypto.randomUUID(), removed_ticker: "", added_ticker: "", reason: "" }] })}><Plus size={14}/>{t("addChange")}</button></div>
              <div className="swap-editor-v21">
                {form.swaps.map((swap, index) => (
                  <div key={swap.id || swap.local_id}>
                    <input placeholder={t("removed")} value={swap.removed_ticker} onChange={(e) => changeSwap(setForm, form, index, "removed_ticker", e.target.value.toUpperCase())}/>
                    <span>→</span>
                    <input placeholder={t("added")} value={swap.added_ticker} onChange={(e) => changeSwap(setForm, form, index, "added_ticker", e.target.value.toUpperCase())}/>
                    <input className="reason" placeholder={t("reason")} value={swap.reason || ""} onChange={(e) => changeSwap(setForm, form, index, "reason", e.target.value)}/>
                    <button className="icon-button" onClick={() => setForm({ ...form, swaps: form.swaps.filter((_, i) => i !== index) })}><X size={15}/></button>
                  </div>
                ))}
                {!form.swaps.length && <p className="muted-copy-v21">{t("noChanges")}</p>}
              </div>
            </article>

            <article className="panel-v21 padded-v21 transparency-panel-v231">
              <div className="panel-heading-v21"><div><span className="eyebrow">TRANSPARENCY</span><h2>{isArabic ? "بيانات الإنشاء وآخر تعديل" : "Creation and last modification"}</h2></div><span className={`status-pill ${isSuperAdmin ? "live" : "draft"}`}>{isSuperAdmin ? "SUPER ADMIN" : "ADMIN"}</span></div>
              <h3 className="audit-subtitle-v231">{isArabic ? "المحفظة" : "Portfolio"}</h3>
              <div className="audit-metadata-grid-v231">
                <Meta label="Created At" value={dateTimeLabel(currentPortfolio?.created_at, locale)}/>
                <Meta label="Last Updated" value={dateTimeLabel(currentPortfolio?.updated_at, locale)}/>
                <Meta label="Created By" value={profileName(members, currentPortfolio?.created_by)}/>
                <Meta label="Updated By" value={profileName(members, currentPortfolio?.updated_by)}/>
              </div>
              <h3 className="audit-subtitle-v231">{isArabic ? "الشهر المحدد" : "Selected month"}</h3>
              <div className="audit-metadata-grid-v231">
                <Meta label="Created At" value={dateTimeLabel(form.created_at, locale)}/>
                <Meta label="Last Updated" value={dateTimeLabel(form.updated_at, locale)}/>
                <Meta label="Created By" value={profileName(members, form.created_by)}/>
                <Meta label="Updated By" value={profileName(members, form.updated_by)}/>
              </div>
              {isSuperAdmin && <button className="button danger" onClick={deleteDemoData}><ShieldAlert size={15}/>{isArabic ? "حذف كل البيانات التجريبية" : "Delete all demo data"}</button>}
            </article>

            <article className="panel-v21 activity-panel-v231">
              <div className="panel-heading-v21"><div><span className="eyebrow">ACTIVITY LOG</span><h2>{isArabic ? "سجل التعديلات" : "Activity log"}</h2><p>{isArabic ? "آخر العمليات مع اسم المستخدم ونوع العملية وتاريخها." : "Latest operations with user, action and timestamp."}</p></div><History size={20}/></div>
              <div className="activity-list-v231">{activities.slice(0, 30).map((activity) => <div key={activity.id}><span className={`activity-action-v231 ${String(activity.action).toLowerCase()}`}>{activity.action}</span><b>{activity.actor_name || activity.actor_email || "System"}</b><span>{activity.entity_type}{activity.entity_label ? ` · ${activity.entity_label}` : ""}</span><small>{dateTimeLabel(activity.occurred_at, locale)}</small></div>)}{!activities.length && <p className="muted-copy-v21">{isArabic ? "سيظهر السجل بعد تشغيل ملف SQL وتنفيذ أول تعديل." : "The log will appear after the SQL upgrade and the first change."}</p>}</div>
            </article>

            <article className="panel-v21 members-panel-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">AUDIENCE</span><h2>{t("members")}</h2></div><span className="status-pill live">{newsletterMembers.length} EMAIL</span></div>
              <div className="table-scroll">
                <table className="data-table-v21 compact-table">
                  <thead><tr><th>{t("fullName")}</th><th>{t("email")}</th><th>Newsletter</th><th>{t("joined")}</th></tr></thead>
                  <tbody>{publicMembers.slice(0, 50).map((member) => <tr key={member.id}><td>{member.full_name || "—"}</td><td>{member.email}</td><td className={member.newsletter_opt_in ? "positive" : "muted-copy-v21"}>{member.newsletter_opt_in ? "Yes" : "No"}</td><td>{new Date(member.created_at).toLocaleDateString(locale)}</td></tr>)}</tbody>
                </table>
              </div>
            </article>
          </section>
        </main>
      </div>
      <PortfolioReportStudio open={reportOpen} onClose={() => setReportOpen(false)} portfolio={currentPortfolio} month={form} months={portfolioMonths} isArabic={isArabic} locale={locale} onMessage={setMessage}/>
    </div>
  );
}

function normalise(month) {
  return {
    ...month,
    holdings: [...(month.holdings || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    swaps: month.swaps || [],
    snapshots: month.snapshots || [],
  };
}

function changeSwap(setForm, form, index, field, value) {
  setForm({ ...form, swaps: form.swaps.map((swap, i) => i === index ? { ...swap, [field]: value } : swap) });
}

function Summary({ icon, label, value, tone }) {
  return <article className={`admin-summary-v21 ${tone}`}><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></article>;
}

function Meta({ label, value }) {
  return <div><small>{label}</small><b>{value || "—"}</b></div>;
}

function profileName(profiles, id) {
  if (!id) return "—";
  const found = profiles.find((item) => item.id === id);
  return found?.full_name || found?.email || id;
}
