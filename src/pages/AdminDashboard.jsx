import { useEffect, useMemo, useState } from "react";
import { BarChart3, Eye, Mail, Plus, Save, Send, Trash2, Users, X } from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";
import { calculateMonth, formatPercent, monthLabel } from "../lib/calculations";

const makeHolding = (index) => ({
  local_id: crypto.randomUUID(),
  ticker: "",
  weight: 20,
  open_price: 0,
  close_price: 0,
  sort_order: index,
});

const makeMonth = () => ({
  id: null,
  month_key: new Date().toISOString().slice(0, 7),
  strategy_name: "ALPHA CORE Five-Stock Strategy",
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
  is_published: false,
  is_closed: false,
  final_portfolio_return: null,
  final_benchmark_return: null,
  holdings: Array.from({ length: 5 }, (_, index) => makeHolding(index)),
  swaps: [],
  snapshots: [],
});

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { t, isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [months, setMonths] = useState([]);
  const [form, setForm] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const metrics = useMemo(() => calculateMonth(form), [form]);

  const loadData = async (preferredId) => {
    const [{ data: monthData, error }, { data: memberData, error: memberError }] = await Promise.all([
      supabase.from("strategy_months").select("*, holdings(*), swaps(*), snapshots(*)").order("month_key", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, newsletter_opt_in, created_at, is_admin").order("created_at", { ascending: false }),
    ]);
    if (error) return setMessage(error.message);
    if (memberError) setMessage(memberError.message);
    setMonths(monthData || []);
    setMembers(memberData || []);
    const chosen = monthData?.find((month) => month.id === preferredId) || monthData?.find((month) => month.id === selectedId) || monthData?.[0];
    if (chosen) {
      setSelectedId(chosen.id);
      setForm(normalise(chosen));
    } else {
      setSelectedId("");
      setForm(makeMonth());
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectMonth = (id) => {
    const chosen = months.find((month) => month.id === id);
    setSelectedId(id);
    setForm(normalise(chosen));
    setMessage("");
  };

  const updateHolding = (index, field, value) => {
    setForm((current) => ({
      ...current,
      holdings: current.holdings.map((holding, currentIndex) => currentIndex === index ? {
        ...holding,
        [field]: field === "ticker" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) : Number(value),
      } : holding),
    }));
  };

  const equalise = () => {
    const weight = 100 / Math.max(form.holdings.length, 1);
    setForm((current) => ({ ...current, holdings: current.holdings.map((holding) => ({ ...holding, weight: Number(weight.toFixed(2)) })) }));
  };

  const persistMonth = async ({ publish = form.is_published, close = false } = {}) => {
    if (saving) return;
    if (!form.holdings.every((holding) => holding.ticker.trim())) return setMessage(isArabic ? "اكتب رمز كل سهم قبل الحفظ" : "Enter every ticker before saving.");
    const totalWeight = form.holdings.reduce((sum, holding) => sum + Number(holding.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.15) return setMessage(isArabic ? `مجموع الأوزان ${totalWeight.toFixed(2)}% ولازم يساوي 100%` : `Weights total ${totalWeight.toFixed(2)}%. They must equal 100%.`);

    setSaving(true);
    setMessage(close ? (isArabic ? "جاري إغلاق الشهر…" : "Closing month…") : (isArabic ? "جاري الحفظ…" : "Saving update…"));
    try {
      const payload = {
        month_key: form.month_key,
        strategy_name: form.strategy_name,
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
        ? (isArabic ? "تم إغلاق الشهر وإضافة النتيجة للسجل الدائم" : "Month closed and added to the permanent track record.")
        : publish
          ? (isArabic ? "تم نشر التحديث وسيظهر للأعضاء فورًا" : "Update published. Members can see it immediately.")
          : (isArabic ? "تم حفظ المسودة" : "Draft saved privately."));
      await loadData(monthId);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async () => {
    if (!form.id || form.is_published) return;
    const confirmText = isArabic ? "هل تريد حذف هذه المسودة؟" : "Delete this draft?";
    if (!window.confirm(confirmText)) return;
    const { error } = await supabase.from("strategy_months").delete().eq("id", form.id);
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم حذف المسودة" : "Draft deleted.");
    await loadData();
  };

  const newsletterMembers = members.filter((member) => member.newsletter_opt_in && !member.is_admin);
  const publicMembers = members.filter((member) => !member.is_admin);

  if (!form) return <div className="screen-loader"><div className="loader-ring"/><p>{t("loading")}</p></div>;

  return (
    <div className="dashboard-shell admin-shell-v21">
      <DashboardHeader admin />
      <div className="admin-workspace-v21">
        <aside className="admin-months-v21">
          <div className="admin-profile-v21"><small>{t("admin")}</small><b>{profile?.full_name || profile?.email}</b></div>
          <button className="button gold full" onClick={() => { setSelectedId(""); setForm(makeMonth()); setMessage(isArabic ? "تم إنشاء شهر جديد كمسودة غير محفوظة" : "New unsaved month created."); }}><Plus size={16}/>{t("newMonth")}</button>
          <nav>
            {months.map((month) => (
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
            <div><span className="eyebrow">{t("adminCentre")}</span><h1>{monthLabel(form.month_key, false, locale)}</h1><p>{t("adminText")}</p></div>
            <div className="admin-actions-v21">
              {!form.is_published && form.id && <button className="button danger" onClick={deleteDraft}><Trash2 size={15}/></button>}
              <button className="button subtle" disabled={saving} onClick={() => persistMonth({ publish: false })}><Save size={16}/>{t("saveDraft")}</button>
              <button className="button gold" disabled={saving} onClick={() => persistMonth({ publish: true })}><Send size={16}/>{t("publishUpdate")}</button>
              <button className="button green" disabled={saving || form.is_closed} onClick={() => persistMonth({ publish: true, close: true })}>{t("closeMonth")}</button>
            </div>
          </header>

          {message && <div className="notice-bar">{message}</div>}

          <section className="admin-summary-grid-v21">
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
                <label>{t("month")}<input type="month" value={form.month_key} onChange={(e) => setForm({...form, month_key: e.target.value})}/></label>
                <label>{t("strategyName")}<input value={form.strategy_name || ""} onChange={(e) => setForm({...form, strategy_name: e.target.value})}/></label>
                <label>{t("benchmarkOpen")}<input type="number" step=".01" value={form.benchmark_open} onChange={(e) => setForm({...form, benchmark_open: Number(e.target.value)})}/></label>
                <label>{t("benchmarkLatest")}<input type="number" step=".01" value={form.benchmark_close} onChange={(e) => setForm({...form, benchmark_close: Number(e.target.value)})}/></label>
                <label className="wide">{t("updateTitle")}<input value={form.update_title || ""} onChange={(e) => setForm({...form, update_title: e.target.value})}/></label>
                <label className="wide">{t("publicCommentary")}<textarea rows="5" value={form.public_commentary || ""} onChange={(e) => setForm({...form, public_commentary: e.target.value})}/></label>
                <label className="wide">{t("monthlyObjective")}<textarea rows="3" value={form.monthly_objective || ""} onChange={(e) => setForm({...form, monthly_objective: e.target.value})}/></label>
                <label>{t("guidanceTitle")}<input value={form.investor_guidance_title || ""} onChange={(e) => setForm({...form, investor_guidance_title: e.target.value})}/></label>
                <label className="wide">{t("guidance")}<textarea rows="4" value={form.investor_guidance || ""} onChange={(e) => setForm({...form, investor_guidance: e.target.value})}/></label>
              </div>
            </article>

            <article className="panel-v21 holdings-editor-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">PORTFOLIO</span><h2>{t("officialPortfolio")}</h2><p>{t("officialPortfolioText")}</p></div><button className="button subtle compact" onClick={equalise}>{t("equalise")}</button></div>
              <div className="table-scroll">
                <table className="data-table-v21 admin-data-table">
                  <thead><tr><th>{t("ticker")}</th><th>{t("weight")}</th><th>{t("open")}</th><th>{t("latest")}</th><th>{t("return")}</th><th>{t("contribution")}</th></tr></thead>
                  <tbody>{form.holdings.map((holding, index) => {
                    const calculated = metrics.rows[index] || {};
                    return <tr key={holding.id || holding.local_id}>
                      <td><input className="admin-table-input ticker" value={holding.ticker} onChange={(e) => updateHolding(index, "ticker", e.target.value)}/></td>
                      <td><input className="admin-table-input" type="number" step=".01" value={holding.weight} onChange={(e) => updateHolding(index, "weight", e.target.value)}/></td>
                      <td><input className="admin-table-input" type="number" step=".01" value={holding.open_price} onChange={(e) => updateHolding(index, "open_price", e.target.value)}/></td>
                      <td><input className="admin-table-input" type="number" step=".01" value={holding.close_price} onChange={(e) => updateHolding(index, "close_price", e.target.value)}/></td>
                      <td className={calculated.mtd >= 0 ? "positive" : "negative"}>{formatPercent(calculated.mtd)}</td>
                      <td className={calculated.contribution >= 0 ? "positive" : "negative"}>{formatPercent(calculated.contribution)}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </article>

            <article className="panel-v21 padded-v21 decision-editor-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">DECISIONS</span><h2>{t("decisionLog")}</h2></div><button className="button subtle compact" onClick={() => setForm({...form, swaps: [...form.swaps, { local_id: crypto.randomUUID(), removed_ticker: "", added_ticker: "", reason: "" }]})}><Plus size={14}/>{t("addChange")}</button></div>
              <div className="swap-editor-v21">
                {form.swaps.map((swap, index) => (
                  <div key={swap.id || swap.local_id}>
                    <input placeholder={t("removed")} value={swap.removed_ticker} onChange={(e) => changeSwap(setForm, form, index, "removed_ticker", e.target.value.toUpperCase())}/>
                    <span>→</span>
                    <input placeholder={t("added")} value={swap.added_ticker} onChange={(e) => changeSwap(setForm, form, index, "added_ticker", e.target.value.toUpperCase())}/>
                    <input className="reason" placeholder={t("reason")} value={swap.reason || ""} onChange={(e) => changeSwap(setForm, form, index, "reason", e.target.value)}/>
                    <button className="icon-button" onClick={() => setForm({...form, swaps: form.swaps.filter((_, i) => i !== index)})}><X size={15}/></button>
                  </div>
                ))}
                {!form.swaps.length && <p className="muted-copy-v21">{t("noChanges")}</p>}
              </div>
            </article>

            <article className="panel-v21 members-panel-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">AUDIENCE</span><h2>{t("members")}</h2></div><span className="status-pill live">{newsletterMembers.length} EMAIL</span></div>
              <div className="table-scroll">
                <table className="data-table-v21 compact-table">
                  <thead><tr><th>{t("fullName")}</th><th>{t("email")}</th><th>Newsletter</th><th>{t("joined")}</th></tr></thead>
                  <tbody>{publicMembers.slice(0, 30).map((member) => <tr key={member.id}><td>{member.full_name || "—"}</td><td>{member.email}</td><td className={member.newsletter_opt_in ? "positive" : "muted-copy-v21"}>{member.newsletter_opt_in ? "Yes" : "No"}</td><td>{new Date(member.created_at).toLocaleDateString(locale)}</td></tr>)}</tbody>
                </table>
              </div>
            </article>
          </section>
        </main>
      </div>
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
