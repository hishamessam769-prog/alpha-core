import { useEffect, useMemo, useState } from "react";
import { BarChart3, BellRing, BriefcaseBusiness, Eye, FileText, History, Mail, Plus, Save, Send, ShieldAlert, Trash2, Users, X } from "lucide-react";
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
  send_push_notification: true,
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
  send_push_notification: true,
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
  const [eventEditorOpen, setEventEditorOpen] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventForm, setEventForm] = useState({ event_date: new Date().toISOString().slice(0, 10), event_type: "exit_to_cash", affected_ticker: "", execution_price: 0, reason: "", notify_followers: true, allocations: [] });

  const isSuperAdmin = Boolean(profile?.is_super_admin);
  const metrics = useMemo(() => calculateMonth(form), [form]);
  const currentPortfolio = portfolios.find((item) => item.id === selectedPortfolioId) || null;
  const portfolioMonths = useMemo(() => months.filter((item) => item.portfolio_id === selectedPortfolioId), [months, selectedPortfolioId]);

  const loadData = async ({ preferredPortfolioId, preferredMonthId } = {}) => {
    const [{ data: portfolioRows, error: portfolioError }, { data: monthRows, error: monthError }, { data: memberRows, error: memberError }, { data: activityRows, error: activityError }] = await Promise.all([
      supabase.from("portfolios").select("*").order("created_at", { ascending: true }),
      supabase.from("strategy_months").select("*, holdings(*), swaps(*), snapshots(*), portfolio_events(*, portfolio_event_allocations(*))").order("month_key", { ascending: false }),
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
      send_push_notification: Boolean(portfolioForm.send_push_notification),
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
    if (portfolioForm.is_published && portfolioForm.send_push_notification) void dispatchQueuedPushNotifications();
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

  const eventBaseAllocations = () => {
    const events = [...(form?.portfolio_events || [])].filter((event) => event.is_published !== false).sort((a,b) => String(a.event_date || "").localeCompare(String(b.event_date || "")) || Number(a.sequence_no || 0)-Number(b.sequence_no || 0));
    const latest = events.at(-1);
    if (latest?.portfolio_event_allocations?.length) return latest.portfolio_event_allocations.map((item) => ({ ticker: String(item.ticker || "").toUpperCase(), weight_pct: Number(item.weight_pct || 0), reference_price: Number(item.latest_price || item.reference_price || 1) }));
    return (form?.holdings || []).map((holding) => ({ ticker: String(holding.ticker || "").toUpperCase(), weight_pct: Number(holding.weight || 0), reference_price: Number(holding.close_price || holding.open_price || 0) }));
  };

  const openEventEditor = () => {
    if (!form?.id) return setMessage(isArabic ? "احفظ الشهر وانشره أولًا قبل إضافة إجراء منتصف الشهر." : "Save the month first before adding a mid-month action.");
    if (form?.is_closed) return setMessage(isArabic ? "الشهر المغلق لا يقبل إجراءات جديدة." : "Closed months cannot accept new actions.");
    const base = eventBaseAllocations();
    const first = base.find((item) => item.ticker !== "CASH");
    const cash = base.find((item) => item.ticker === "CASH");
    const allocations = base.filter((item) => item.ticker !== first?.ticker && item.ticker !== "CASH");
    const cashWeight = Number(cash?.weight_pct || 0) + Number(first?.weight_pct || 0);
    if (cashWeight > 0) allocations.push({ ticker: "CASH", weight_pct: cashWeight, reference_price: 1 });
    const today = new Date().toISOString().slice(0,10);
    const eventDate = today.startsWith(`${form.month_key}-`) ? today : `${form.month_key}-15`;
    setEventForm({ event_date: eventDate, event_type: "exit_to_cash", affected_ticker: first?.ticker || "", execution_price: Number(first?.reference_price || 0), reason: "", notify_followers: true, allocations });
    setEventEditorOpen(true);
  };

  const setEventType = (type) => {
    const base = eventBaseAllocations();
    const affected = eventForm.affected_ticker || base.find((item) => item.ticker !== "CASH")?.ticker || "";
    let allocations = base.map((item) => ({ ...item }));
    if (type === "exit_to_cash" && affected) {
      const removed = allocations.find((item) => item.ticker === affected);
      const cash = allocations.find((item) => item.ticker === "CASH");
      allocations = allocations.filter((item) => item.ticker !== affected && item.ticker !== "CASH");
      const cashWeight = Number(cash?.weight_pct || 0) + Number(removed?.weight_pct || 0);
      if (cashWeight > 0) allocations.push({ ticker: "CASH", weight_pct: cashWeight, reference_price: 1 });
    } else if (type === "exit_redistribute" && affected) {
      allocations = allocations.filter((item) => item.ticker !== affected);
    }
    setEventForm((current) => ({ ...current, event_type: type, affected_ticker: affected, allocations }));
  };

  const changeAffectedTicker = (ticker) => {
    const base = eventBaseAllocations();
    const row = base.find((item) => item.ticker === ticker);
    setEventForm((current) => {
      let allocations = current.allocations;
      if (current.event_type === "exit_to_cash") {
        const cash = base.find((item) => item.ticker === "CASH");
        allocations = base.filter((item) => item.ticker !== ticker && item.ticker !== "CASH");
        const cashWeight = Number(cash?.weight_pct || 0) + Number(row?.weight_pct || 0);
        if (cashWeight > 0) allocations.push({ ticker: "CASH", weight_pct: cashWeight, reference_price: 1 });
      } else if (current.event_type === "exit_redistribute") {
        allocations = base.filter((item) => item.ticker !== ticker);
      }
      return { ...current, affected_ticker: ticker, execution_price: Number(row?.reference_price || 0), allocations };
    });
  };

  const updateEventAllocation = (index, field, value) => setEventForm((current) => ({ ...current, allocations: current.allocations.map((item, i) => i === index ? { ...item, [field]: field === "ticker" ? String(value).toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0,24) : Number(value || 0) } : item) }));
  const addEventAllocation = () => setEventForm((current) => ({ ...current, allocations: [...current.allocations, { ticker: "", weight_pct: 0, reference_price: 0 }] }));
  const removeEventAllocation = (index) => setEventForm((current) => ({ ...current, allocations: current.allocations.filter((_, i) => i !== index) }));
  const equalizeEventAllocations = () => setEventForm((current) => { const investable=current.allocations.filter((item)=>item.ticker!=="CASH"); if(!investable.length)return current; const cashWeight=Number(current.allocations.find((item)=>item.ticker==="CASH")?.weight_pct||0); const weight=(100-cashWeight)/investable.length; return { ...current, allocations: current.allocations.map((item)=>item.ticker==="CASH"?item:{...item,weight_pct:Number(weight.toFixed(4))}) }; });

  const savePortfolioEvent = async () => {
    if (eventSaving || !form?.id) return;
    const allocations = eventForm.allocations.filter((item) => item.ticker && Number(item.weight_pct) >= 0);
    const total = allocations.reduce((sum,item)=>sum+Number(item.weight_pct||0),0);
    if (Math.abs(total-100) > .01) return setMessage(isArabic ? `توزيع ما بعد الحدث = ${total.toFixed(2)}% ويجب أن يساوي 100%.` : `Post-event allocation totals ${total.toFixed(2)}%; it must equal 100%.`);
    if (!eventForm.reason.trim()) return setMessage(isArabic ? "اكتب سبب القرار بوضوح للـAudit Trail." : "Add a clear reason for the audit trail.");
    setEventSaving(true);
    try {
      const { error } = await supabase.rpc("create_portfolio_event", {
        p_month_id: form.id,
        p_event_date: eventForm.event_date,
        p_event_type: eventForm.event_type,
        p_affected_ticker: eventForm.affected_ticker || null,
        p_execution_price: Number(eventForm.execution_price || 0) || null,
        p_reason: eventForm.reason.trim(),
        p_allocations: allocations.map((item) => ({ ticker: item.ticker, weight_pct: Number(item.weight_pct) })),
        p_notify_followers: Boolean(eventForm.notify_followers),
      });
      if (error) throw error;
      setEventEditorOpen(false);
      setMessage(isArabic ? "تم تسجيل الإجراء وتجميد الأداء حتى سعر التنفيذ، وتم توجيه الإشعار لمتابعي المحفظة فقط." : "Portfolio action recorded. Performance is frozen at execution and followers were targeted only.");
      if (eventForm.notify_followers) void dispatchQueuedPushNotifications();
      await loadData({ preferredPortfolioId: form.portfolio_id, preferredMonthId: form.id });
    } catch (error) { setMessage(error.message); } finally { setEventSaving(false); }
  };

  const deletePortfolioEvent = async (eventId) => {
    if (!isSuperAdmin || !eventId) return;
    if (!window.confirm(isArabic ? "حذف هذا الحدث سيعيد حساب أداء الشهر بدون هذا القرار. هل تؤكد؟" : "Deleting this event changes the month's performance history. Confirm?")) return;
    const { error } = await supabase.rpc("delete_portfolio_event", { p_event_id: eventId });
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم حذف الحدث وإعادة فتح الحساب التاريخي بدونه." : "Event deleted; historical calculation now excludes it.");
    await loadData({ preferredPortfolioId: form.portfolio_id, preferredMonthId: form.id });
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
        send_push_notification: Boolean(form.send_push_notification),
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
      if ((publish || close) && form.send_push_notification) void dispatchQueuedPushNotifications();
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
          {isSuperAdmin && <a className="button subtle full" href="/admin/notifications"><BellRing size={16}/>{isArabic ? "مركز الإشعارات" : "Notification Center"}</a>}
        </aside>

        <main className="admin-content-v21">
          <header className="admin-top-v21">
            <div><span className="eyebrow">{t("adminCentre")}</span><h1>{currentPortfolio ? (isArabic && currentPortfolio.name_ar ? currentPortfolio.name_ar : currentPortfolio.name) : (isArabic ? "المحافظ" : "Portfolios")}</h1><p>{form.id ? monthLabel(form.month_key, false, locale) : (isArabic ? "شهر جديد" : "New month")}</p></div>
            <div className="admin-actions-v21">
              <label className="check-label-v22 notification-publish-toggle-v37"><input type="checkbox" checked={Boolean(form.send_push_notification)} onChange={(e) => setForm({ ...form, send_push_notification: e.target.checked })}/>{isArabic ? "إرسال إشعار" : "Notify subscribers"}</label>
              {isSuperAdmin && form.id && <button className="button danger" onClick={deleteMonth} title={isArabic ? "حذف الشهر نهائيًا" : "Permanently delete month"}><Trash2 size={15}/></button>}
              {isSuperAdmin && form.id && !form.is_closed && <button className="button subtle" onClick={openEventEditor}><History size={16}/>{isArabic ? "إجراء منتصف الشهر" : "Mid-month action"}</button>}{isSuperAdmin && <button className="button subtle" disabled={!form?.holdings?.length} onClick={() => setReportOpen(true)}><FileText size={16}/>Generate Portfolio Report</button>}
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
              <label className="check-label-v22"><input type="checkbox" checked={Boolean(portfolioForm.is_published)} onChange={(e) => setPortfolioForm({ ...portfolioForm, is_published: e.target.checked })}/>{isArabic ? "إظهار المحفظة للأعضاء" : "Publish portfolio to members"}</label><label className="check-label-v22"><input type="checkbox" checked={Boolean(portfolioForm.send_push_notification)} onChange={(e) => setPortfolioForm({ ...portfolioForm, send_push_notification: e.target.checked })}/>{isArabic ? "إشعار عند إطلاق المحفظة" : "Notify on launch"}</label><label className="check-label-v22"><input type="checkbox" checked={Boolean(portfolioForm.is_demo)} onChange={(e) => setPortfolioForm({ ...portfolioForm, is_demo: e.target.checked })}/>{isArabic ? "تمييز كبيانات تجريبية" : "Mark as demo data"}</label>
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
              <div className="panel-heading-v21"><div><span className="eyebrow">PORTFOLIO</span><h2>{t("officialPortfolio")}</h2><p>{form.portfolio_events?.length ? (isArabic ? "تم قفل تكوين بداية الشهر بعد تسجيل أول حدث. أي تغيير لاحق يتم من سجل الأحداث للحفاظ على التاريخ." : "Opening allocation is locked after the first event. Use the event ledger for later changes to preserve history.") : (isArabic ? "يمكن إضافة أو حذف أي عدد من الأسهم. مجموع الأوزان لازم يساوي 100%." : "Add or remove any number of holdings. Total weights must equal 100%.")}</p></div><div className="editor-buttons-v22"><button className="button subtle compact" disabled={Boolean(form.portfolio_events?.length)} onClick={addHolding}><Plus size={14}/>{isArabic ? "سهم" : "Holding"}</button><button className="button subtle compact" disabled={Boolean(form.portfolio_events?.length)} onClick={equalise}>{t("equalise")}</button></div></div>
              <div className="table-scroll">
                <table className="data-table-v21 admin-data-table">
                  <thead><tr><th>{t("ticker")}</th><th>{t("weight")}</th><th>{t("open")}</th><th>{t("latest")}</th><th>{t("return")}</th><th>{t("contribution")}</th><th>{isArabic ? "الفكرة الاستثمارية" : "Investment thesis"}</th><th></th></tr></thead>
                  <tbody>{form.holdings.map((holding, index) => {
                    const calculated = metrics.rows[index] || {};
                    return <tr key={holding.id || holding.local_id}>
                      <td><input className="admin-table-input ticker" disabled={Boolean(form.portfolio_events?.length)} value={holding.ticker} onChange={(e) => updateHolding(index, "ticker", e.target.value)}/></td>
                      <td><input className="admin-table-input" disabled={Boolean(form.portfolio_events?.length)} type="number" step=".01" value={holding.weight} onChange={(e) => updateHolding(index, "weight", e.target.value)}/></td>
                      <td><input className="admin-table-input" disabled={Boolean(form.portfolio_events?.length)} type="number" step=".01" value={holding.open_price} onChange={(e) => updateHolding(index, "open_price", e.target.value)}/></td>
                      <td><input className="admin-table-input" type="number" step=".01" value={holding.close_price} onChange={(e) => updateHolding(index, "close_price", e.target.value)}/></td>
                      <td className={calculated.mtd >= 0 ? "positive" : "negative"}>{formatPercent(calculated.mtd)}</td>
                      <td className={calculated.contribution >= 0 ? "positive" : "negative"}>{formatPercent(calculated.contribution)}</td>
                      <td><textarea className="admin-table-thesis-v31" rows="2" value={holding.investment_thesis || ""} onChange={(e) => updateHolding(index, "investment_thesis", e.target.value)} placeholder={isArabic ? "لماذا اخترنا هذا السهم؟" : "Why is this stock selected?"}/></td>
                      <td><button className="icon-button" disabled={Boolean(form.portfolio_events?.length)} onClick={() => removeHolding(index)}><Trash2 size={14}/></button></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </article>

            <article className="panel-v21 padded-v21 portfolio-event-ledger-v313">
              <div className="panel-heading-v21"><div><span className="eyebrow">EVENT-DRIVEN PORTFOLIO</span><h2>{isArabic ? "سجل أحداث المحفظة" : "Portfolio events & performance freezing"}</h2><p>{isArabic ? "كل تخارج أو إعادة توازن يحدد نقطة سعر ثابتة ويقسم الشهر إلى فترات أداء مستقلة." : "Every exit or rebalance freezes an execution point and splits the month into independently compounded performance segments."}</p></div>{form.id && !form.is_closed && <button className="button gold compact" onClick={openEventEditor}><Plus size={14}/>{isArabic ? "إجراء استثنائي" : "Add event"}</button>}</div>
              <div className="portfolio-event-list-v313">{[...(form.portfolio_events || [])].sort((a,b)=>String(b.event_date||"").localeCompare(String(a.event_date||""))||Number(b.sequence_no||0)-Number(a.sequence_no||0)).map((event)=><article key={event.id}><div className="portfolio-event-date-v313"><b>{new Date(`${event.event_date}T12:00:00`).toLocaleDateString(locale)}</b><small>#{event.sequence_no}</small></div><div><span className="status-pill live">{String(event.event_type||"").replaceAll("_"," ")}</span><h3>{event.title || event.affected_ticker || (isArabic ? "إجراء محفظة" : "Portfolio action")}</h3><p>{event.reason}</p><small>{isArabic ? "التوزيع بعد الحدث" : "Post-event allocation"}: {(event.portfolio_event_allocations||[]).map((item)=>`${item.ticker} ${Number(item.weight_pct||0).toFixed(1)}%`).join(" · ")}</small></div>{isSuperAdmin && <button className="icon-button" onClick={()=>deletePortfolioEvent(event.id)}><Trash2 size={14}/></button>}</article>)}{!(form.portfolio_events||[]).length&&<p className="muted-copy-v21">{isArabic ? "لا توجد أحداث استثنائية. الحساب ما زال يعتمد على تكوين بداية الشهر." : "No exceptional events. The month still follows its opening allocation."}</p>}</div>
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
      {eventEditorOpen && <div className="portfolio-event-modal-v313"><div className="portfolio-event-dialog-v313 panel-v21"><header><div><span className="eyebrow">MID-MONTH ACTION</span><h2>{isArabic ? "تسجيل قرار استثنائي" : "Record exceptional portfolio action"}</h2><p>{isArabic ? "النتيجة بعد الحفظ تصبح جزءًا دائمًا من حساب الأداء والـAudit Trail." : "Once saved, this becomes a permanent performance segment and audit-trail event."}</p></div><button className="icon-button" onClick={()=>setEventEditorOpen(false)}><X size={18}/></button></header><div className="portfolio-event-form-v313"><label>{isArabic ? "تاريخ التنفيذ" : "Execution date"}<input type="date" value={eventForm.event_date} onChange={(e)=>setEventForm({...eventForm,event_date:e.target.value})}/></label><label>{isArabic ? "نوع الإجراء" : "Action type"}<select value={eventForm.event_type} onChange={(e)=>setEventType(e.target.value)}><option value="exit_to_cash">Exit → Cash</option><option value="exit_redistribute">Exit → Redistribute</option><option value="rebalance">Rebalance</option><option value="entry">Entry</option><option value="manual">Manual allocation</option></select></label><label>{isArabic ? "السهم المتأثر" : "Affected ticker"}<select value={eventForm.affected_ticker} onChange={(e)=>changeAffectedTicker(e.target.value)}><option value="">—</option>{eventBaseAllocations().filter((item)=>item.ticker!=="CASH").map((item)=><option key={item.ticker} value={item.ticker}>{item.ticker}</option>)}</select></label><label>{isArabic ? "سعر التنفيذ" : "Execution price"}<input type="number" step=".01" value={eventForm.execution_price} onChange={(e)=>setEventForm({...eventForm,execution_price:Number(e.target.value)})}/></label><label className="wide">{isArabic ? "سبب القرار / التفسير للمستثمر" : "Reason / investor explanation"}<textarea rows="4" value={eventForm.reason} onChange={(e)=>setEventForm({...eventForm,reason:e.target.value})} placeholder={isArabic ? "مثال: تم تحقيق المستهدف السعري بالكامل وتم التخارج لتثبيت الربح." : "Example: Target achieved; position exited to lock in the gain."}/></label></div><div className="portfolio-event-allocation-head-v313"><div><b>{isArabic ? "التوزيع بعد التنفيذ" : "Allocation immediately after execution"}</b><small>{isArabic ? "لازم يساوي 100% بما في ذلك CASH." : "Must total 100%, including CASH."}</small></div><div><button className="button subtle compact" onClick={equalizeEventAllocations}>{isArabic ? "توزيع متساوي" : "Equalize"}</button><button className="button subtle compact" onClick={addEventAllocation}><Plus size={13}/>{isArabic ? "أصل" : "Asset"}</button></div></div><div className="portfolio-event-allocation-grid-v313">{eventForm.allocations.map((item,index)=><div key={`${item.ticker}-${index}`}><input value={item.ticker} disabled={item.ticker==="CASH"} placeholder="Ticker / CASH" onChange={(e)=>updateEventAllocation(index,"ticker",e.target.value)}/><label><input type="number" step=".01" value={item.weight_pct} onChange={(e)=>updateEventAllocation(index,"weight_pct",e.target.value)}/><span>%</span></label><button className="icon-button" onClick={()=>removeEventAllocation(index)}><X size={14}/></button></div>)}</div><div className="portfolio-event-total-v313"><span>{isArabic ? "إجمالي الوزن" : "Total weight"}</span><b className={Math.abs(eventForm.allocations.reduce((sum,item)=>sum+Number(item.weight_pct||0),0)-100)<=.01?"positive":"negative"}>{eventForm.allocations.reduce((sum,item)=>sum+Number(item.weight_pct||0),0).toFixed(2)}%</b></div><label className="check-label-v22"><input type="checkbox" checked={Boolean(eventForm.notify_followers)} onChange={(e)=>setEventForm({...eventForm,notify_followers:e.target.checked})}/>{isArabic ? "إرسال إشعار لمتابعي هذه المحفظة فقط" : "Notify followers of this portfolio only"}</label><footer><button className="button subtle" onClick={()=>setEventEditorOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</button><button className="button gold" disabled={eventSaving} onClick={savePortfolioEvent}><Save size={15}/>{eventSaving?(isArabic?"جاري الحفظ…":"Saving…"):(isArabic?"تثبيت الحدث":"Freeze event")}</button></footer></div></div>}
      {isSuperAdmin && <PortfolioReportStudio open={reportOpen} onClose={() => setReportOpen(false)} portfolio={currentPortfolio} month={form} months={portfolioMonths} isArabic={isArabic} locale={locale} onMessage={setMessage}/>}
    </div>
  );
}

function normalise(month) {
  return {
    ...month,
    holdings: [...(month.holdings || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    swaps: month.swaps || [],
    snapshots: month.snapshots || [],
    portfolio_events: (month.portfolio_events || []).map((event) => ({ ...event, portfolio_event_allocations: event.portfolio_event_allocations || [] })),
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
