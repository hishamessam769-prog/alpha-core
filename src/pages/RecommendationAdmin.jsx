import { useEffect, useMemo, useState } from "react";
import { Archive, Eye, Plus, Save, Send, Target, Trash2, TrendingUp } from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { dateTimeLabel, formatNumber, formatPercent } from "../lib/calculations";
import { recommendationActionLabel, recommendationMetrics, recommendationStatusLabel } from "../lib/recommendations";
import { supabase } from "../lib/supabase";

const today = () => new Date().toISOString().slice(0, 10);

const blankRecommendation = () => ({
  id: null,
  ticker: "",
  company_name: "",
  title: "",
  recommendation_date: today(),
  entry_price: 0,
  target_price: 0,
  horizon_months: 12,
  benchmark_ticker: "EGX30CAP",
  benchmark_entry: 0,
  status: "draft",
  action_status: "invest",
  close_date: null,
  close_price: null,
  benchmark_close: null,
  company_story: "",
  why_selected: "",
  positives: "",
  risks: "",
  valuation: "",
  is_published: false,
  is_demo: false,
});

export default function RecommendationAdmin() {
  const { profile } = useAuth();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [recommendations, setRecommendations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(blankRecommendation());
  const [prices, setPrices] = useState({});
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState({ update_date: today(), title: "", body: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState([]);

  const load = async (preferredId) => {
    const [{ data: recs, error: recError }, { data: priceRows, error: priceError }, { data: profileRows, error: profileError }] = await Promise.all([
      supabase.from("recommendations").select("*").order("recommendation_date", { ascending: false }),
      supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
      supabase.from("profiles").select("id, full_name, email, is_super_admin"),
    ]);
    if (recError || priceError || profileError) setMessage(recError?.message || priceError?.message || profileError?.message || "");
    const rows = recs || [];
    const selected = rows.find((item) => item.id === preferredId) || rows.find((item) => item.id === selectedId) || rows[0];
    setRecommendations(rows);
    setProfiles(profileRows || []);
    setPrices(Object.fromEntries((priceRows || []).map((row) => [String(row.ticker).toUpperCase(), row])));
    if (selected) {
      setSelectedId(selected.id);
      setForm({ ...selected });
      await loadUpdates(selected.id);
    } else {
      setSelectedId("");
      setForm(blankRecommendation());
      setUpdates([]);
    }
  };

  const loadUpdates = async (recommendationId) => {
    if (!recommendationId) return setUpdates([]);
    const { data, error } = await supabase.from("recommendation_updates").select("*").eq("recommendation_id", recommendationId).order("update_date", { ascending: false });
    if (error) setMessage(error.message);
    setUpdates(data || []);
  };

  useEffect(() => { load(); }, []);

  const isSuperAdmin = Boolean(profile?.is_super_admin);
  const metrics = useMemo(() => recommendationMetrics(form, prices), [form, prices]);
  const currentStockPrice = prices[String(form.ticker || "").toUpperCase()];
  const currentBenchmarkPrice = prices[String(form.benchmark_ticker || "EGX30CAP").toUpperCase()];

  const choose = async (item) => {
    setSelectedId(item.id);
    setForm({ ...item });
    setMessage("");
    await loadUpdates(item.id);
  };

  const newIdea = () => {
    setSelectedId("");
    setForm(blankRecommendation());
    setUpdates([]);
    setMessage(isArabic ? "تم فتح توصية جديدة غير محفوظة" : "New unsaved recommendation opened.");
  };

  const save = async ({ publish = form.is_published, status = form.status } = {}) => {
    if (saving) return;
    if (!form.ticker.trim() || !form.company_name.trim() || !form.title.trim()) return setMessage(isArabic ? "اكتب رمز السهم واسم الشركة وعنوان التوصية" : "Enter ticker, company name and idea title.");
    if (!(Number(form.entry_price) > 0) || !(Number(form.target_price) > 0) || !(Number(form.benchmark_entry) > 0)) return setMessage(isArabic ? "أسعار البداية والمستهدف والمؤشر لازم تكون أكبر من صفر" : "Entry, target and benchmark opening values must be greater than zero.");

    setSaving(true);
    setMessage(isArabic ? "جاري حفظ التوصية…" : "Saving recommendation…");
    try {
      const payload = {
        ticker: form.ticker.trim().toUpperCase(),
        company_name: form.company_name.trim(),
        title: form.title.trim(),
        recommendation_date: form.recommendation_date,
        entry_price: Number(form.entry_price),
        target_price: Number(form.target_price),
        horizon_months: 12,
        benchmark_ticker: (form.benchmark_ticker || "EGX30CAP").trim().toUpperCase(),
        benchmark_entry: Number(form.benchmark_entry),
        status,
        action_status: form.action_status || "invest",
        close_date: form.close_date || null,
        close_price: form.close_price === "" || form.close_price == null ? null : Number(form.close_price),
        benchmark_close: form.benchmark_close === "" || form.benchmark_close == null ? null : Number(form.benchmark_close),
        company_story: form.company_story || "",
        why_selected: form.why_selected || "",
        positives: form.positives || "",
        risks: form.risks || "",
        valuation: form.valuation || "",
        is_published: Boolean(publish),
        is_demo: Boolean(form.is_demo),
        updated_at: new Date().toISOString(),
      };
      let id = form.id;
      if (id) {
        const { error } = await supabase.from("recommendations").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("recommendations").insert({ ...payload, created_by: profile.id }).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      setMessage(publish ? (isArabic ? "تم نشر التوصية المستقلة للأعضاء" : "Independent recommendation published to members.") : (isArabic ? "تم حفظ المسودة" : "Draft saved."));
      await load(id);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const closeAtLatest = async (status = "closed") => {
    if (!form.id) return setMessage(isArabic ? "احفظ التوصية الأول" : "Save the recommendation first.");
    if (!currentStockPrice || !currentBenchmarkPrice) return setMessage(isArabic ? "ارفع سعر السهم والمؤشر في ملف الأسعار الأول" : "Upload the stock and benchmark prices first.");
    const next = {
      ...form,
      status,
      close_date: today(),
      close_price: Number(currentStockPrice.close_price),
      benchmark_close: Number(currentBenchmarkPrice.close_price),
      is_published: true,
    };
    setForm(next);
    setSaving(true);
    const { error } = await supabase.from("recommendations").update({
      status,
      close_date: next.close_date,
      close_price: next.close_price,
      benchmark_close: next.benchmark_close,
      is_published: true,
      updated_at: new Date().toISOString(),
    }).eq("id", form.id);
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم إغلاق التوصية وتثبيت النتيجة النهائية" : "Recommendation closed and final performance frozen.");
    await load(form.id);
  };

  const deleteRecommendation = async () => {
    if (!isSuperAdmin || !form.id) return;
    const confirmed = window.confirm(isArabic
      ? `تحذير واضح: سيتم حذف توصية ${form.ticker} نهائيًا مع كل التحديثات المرتبطة بها. لا يمكن التراجع. هل تؤكد؟`
      : `Clear warning: recommendation ${form.ticker} and its full update history will be permanently deleted. This cannot be undone. Confirm?`);
    if (!confirmed) return;
    const { error } = await supabase.rpc("delete_recommendation_cascade", { p_recommendation_id: form.id });
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم حذف التوصية بالكامل بواسطة Super Admin" : "Recommendation permanently deleted by Super Admin.");
    await load();
  };

  const addUpdate = async () => {
    if (!form.id) return setMessage(isArabic ? "احفظ التوصية قبل إضافة تحديث" : "Save the recommendation before adding an update.");
    if (!newUpdate.title.trim() || !newUpdate.body.trim()) return setMessage(isArabic ? "اكتب عنوان التحديث والتفاصيل" : "Enter update title and details.");
    const { error } = await supabase.from("recommendation_updates").insert({
      recommendation_id: form.id,
      update_date: newUpdate.update_date,
      title: newUpdate.title.trim(),
      body: newUpdate.body.trim(),
      created_by: profile.id,
    });
    if (error) return setMessage(error.message);
    setNewUpdate({ update_date: today(), title: "", body: "" });
    setMessage(isArabic ? "تم إضافة التحديث لسجل الشركة" : "Update added to the company timeline.");
    await loadUpdates(form.id);
  };

  const deleteUpdate = async (update) => {
    if (!isSuperAdmin) return;
    const confirmed = window.confirm(isArabic
      ? `سيتم حذف تحديث "${update.title}" نهائيًا من سجل التوصية. لا يمكن التراجع. هل تؤكد؟`
      : `Update "${update.title}" will be permanently deleted from the recommendation history. This cannot be undone. Confirm?`);
    if (!confirmed) return;
    const { error } = await supabase.rpc("delete_recommendation_update", { p_update_id: update.id });
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم حذف التحديث بواسطة Super Admin" : "Update deleted by Super Admin.");
    await loadUpdates(form.id);
  };

  return (
    <div className="dashboard-shell admin-shell-v21">
      <DashboardHeader admin />
      <div className="admin-workspace-v21 recommendation-admin-v22">
        <aside className="admin-months-v21">
          <div className="admin-profile-v21"><small>{isArabic ? "مكتب التوصيات المستقلة" : "INDEPENDENT RECOMMENDATIONS DESK"}</small><b>{profile?.full_name || profile?.email}</b></div>
          <button className="button gold full" onClick={newIdea}><Plus size={16}/>{isArabic ? "توصية جديدة" : "New recommendation"}</button>
          <nav>
            {recommendations.map((item) => <button className={selectedId === item.id ? "active" : ""} key={item.id} onClick={() => choose(item)}>
              <span><b>{item.ticker}</b><small>{item.company_name}</small></span>
              <small className={item.status === "open" ? "live" : item.status === "draft" ? "draft" : "final"}>{recommendationStatusLabel(item.status, isArabic)}</small>
            </button>)}
          </nav>
          <a className="button subtle full" href="/recommendations"><Eye size={16}/>{isArabic ? "عرض التوصيات المستقلة" : "View independent recommendations"}</a>
        </aside>

        <main className="admin-content-v21">
          <header className="admin-top-v21">
            <div><span className="eyebrow">INDEPENDENT IDEA</span><h1>{form.ticker || (isArabic ? "توصية جديدة" : "New recommendation")}</h1><p>{isArabic ? "قرار حالي واضح مع مستهدف واحد خلال 12 شهر وأداء مقابل EGX30 Capped وسجل تحديثات." : "A clear current action, one 12-month target, EGX30 Capped performance and a permanent update log."}</p></div>
            <div className="admin-actions-v21">
              {isSuperAdmin && form.id && <button className="button danger" onClick={deleteRecommendation} title={isArabic ? "حذف التوصية بالكامل" : "Delete full recommendation"}><Trash2 size={15}/></button>}
              <button className="button subtle" disabled={saving} onClick={() => save({ publish: false, status: form.status === "draft" ? "draft" : form.status })}><Save size={16}/>{isArabic ? "حفظ مسودة" : "Save draft"}</button>
              <button className="button gold" disabled={saving} onClick={() => save({ publish: true, status: form.status === "draft" ? "open" : form.status })}><Send size={16}/>{isArabic ? "نشر التوصية" : "Publish"}</button>
              {form.id && form.status === "open" && <button className="button green" disabled={saving} onClick={() => closeAtLatest("closed")}><Archive size={16}/>{isArabic ? "إغلاق بالسعر الحالي" : "Close at latest"}</button>}
            </div>
          </header>

          {message && <div className="notice-bar">{message}</div>}

          <section className="admin-summary-grid-v21 recommendation-summary-v22">
            <Summary label={isArabic ? "السعر الحالي" : "Current price"} value={formatNumber(metrics.currentPrice, 2, locale)} tone="blue"/>
            <Summary label={isArabic ? "العائد" : "Return"} value={formatPercent(metrics.returnPct)} tone={metrics.returnPct >= 0 ? "green" : "red"}/>
            <Summary label="EGX30 Capped" value={formatPercent(metrics.benchmarkReturn)} tone="gold"/>
            <Summary label="Alpha" value={formatPercent(metrics.alpha)} tone={metrics.alpha >= 0 ? "green" : "red"}/>
            <Summary label={isArabic ? "المتبقي للمستهدف" : "Upside to target"} value={formatPercent(metrics.upsideToTarget)} tone="gold"/>
            <Summary label={isArabic ? "المدة" : "Duration"} value={`${metrics.durationDays} ${isArabic ? "يوم" : "days"}`} tone="neutral"/>
          </section>

          <section className="admin-grid-v21">
            <article className="panel-v21 padded-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">SETUP</span><h2>{isArabic ? "بيانات التوصية" : "Recommendation setup"}</h2></div><span className={`status-pill ${form.status === "open" ? "live" : form.status === "draft" ? "draft" : "final"}`}>{recommendationStatusLabel(form.status, isArabic)}</span></div>
              <div className="admin-form-grid-v21 recommendation-form-v22">
                <label>{isArabic ? "رمز السهم" : "Ticker"}<input value={form.ticker || ""} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) })}/></label>
                <label>{isArabic ? "اسم الشركة" : "Company name"}<input value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })}/></label>
                <label className="wide">{isArabic ? "عنوان التوصية" : "Idea title"}<input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
                <label>{isArabic ? "تاريخ التوصية" : "Recommendation date"}<input type="date" value={form.recommendation_date || ""} onChange={(e) => setForm({ ...form, recommendation_date: e.target.value })}/></label>
                <label>{isArabic ? "الأفق الزمني" : "Horizon"}<input value="12 months" disabled/></label>
                <label>{isArabic ? "سعر التوصية" : "Entry price"}<input type="number" step=".01" value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: Number(e.target.value) })}/></label>
                <label>{isArabic ? "السعر المستهدف" : "Target price"}<input type="number" step=".01" value={form.target_price} onChange={(e) => setForm({ ...form, target_price: Number(e.target.value) })}/></label>
                <label>{isArabic ? "رمز المؤشر" : "Benchmark ticker"}<input value={form.benchmark_ticker || "EGX30CAP"} onChange={(e) => setForm({ ...form, benchmark_ticker: e.target.value.toUpperCase() })}/></label>
                <label>{isArabic ? "قيمة المؤشر عند البداية" : "Benchmark at entry"}<input type="number" step=".01" value={form.benchmark_entry} onChange={(e) => setForm({ ...form, benchmark_entry: Number(e.target.value) })}/></label>
                <label>{isArabic ? "حالة السجل" : "Record status"}<select value={["draft","open"].includes(form.status) ? form.status : "open"} disabled={!(["draft","open"].includes(form.status))} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="open">Open</option></select></label>
                <label>{isArabic ? "القرار الحالي للمستثمر" : "Current investor action"}<select value={form.action_status || "invest"} disabled={!(["draft","open"].includes(form.status))} onChange={(e) => setForm({ ...form, action_status: e.target.value })}><option value="invest">{recommendationActionLabel("invest", isArabic)}</option><option value="hold">{recommendationActionLabel("hold", isArabic)}</option></select></label>
                <label>{isArabic ? "آخر تحديث سعر" : "Last price update"}<input value={currentStockPrice?.price_date || "—"} disabled/></label><label className="check-label-v22"><input type="checkbox" checked={Boolean(form.is_demo)} onChange={(e) => setForm({ ...form, is_demo: e.target.checked })}/>{isArabic ? "تمييز كتوصية تجريبية" : "Mark as demo data"}</label>
              </div>
            </article>

            <article className="panel-v21 padded-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">FUNDAMENTAL CASE</span><h2>{isArabic ? "القصة والفرضية الاستثمارية" : "Story and investment case"}</h2></div></div>
              <div className="admin-form-grid-v21">
                <label className="wide">{isArabic ? "قصة الشركة" : "Company story"}<textarea rows="7" value={form.company_story || ""} onChange={(e) => setForm({ ...form, company_story: e.target.value })}/></label>
                <label className="wide">{isArabic ? "ليه اخترنا السهم" : "Why we selected the stock"}<textarea rows="7" value={form.why_selected || ""} onChange={(e) => setForm({ ...form, why_selected: e.target.value })}/></label>
                <label>{isArabic ? "الإيجابيات ومحركات الصعود (كل نقطة في سطر)" : "Positives and catalysts (one per line)"}<textarea rows="8" value={form.positives || ""} onChange={(e) => setForm({ ...form, positives: e.target.value })}/></label>
                <label>{isArabic ? "السلبيات والمخاطر (كل نقطة في سطر)" : "Negatives and risks (one per line)"}<textarea rows="8" value={form.risks || ""} onChange={(e) => setForm({ ...form, risks: e.target.value })}/></label>
                <label className="wide">{isArabic ? "منطق التقييم والسعر المستهدف" : "Valuation and target-price logic"}<textarea rows="7" value={form.valuation || ""} onChange={(e) => setForm({ ...form, valuation: e.target.value })}/></label>
              </div>
            </article>

            <article className="panel-v21 padded-v21 transparency-panel-v231">
              <div className="panel-heading-v21"><div><span className="eyebrow">TRANSPARENCY</span><h2>{isArabic ? "سجل الإنشاء والتعديل" : "Creation and modification record"}</h2></div><span className={`status-pill ${isSuperAdmin ? "live" : "draft"}`}>{isSuperAdmin ? "SUPER ADMIN" : "ADMIN"}</span></div>
              <div className="audit-metadata-grid-v231">
                <Meta label="Created At" value={dateTimeLabel(form.created_at, locale)}/>
                <Meta label="Last Updated" value={dateTimeLabel(form.updated_at, locale)}/>
                <Meta label="Created By" value={profileName(profiles, form.created_by)}/>
                <Meta label="Updated By" value={profileName(profiles, form.updated_by)}/>
              </div>
            </article>

            <article className="panel-v21 padded-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">UPDATES</span><h2>{isArabic ? "إضافة تحديث جديد" : "Add a company update"}</h2><p>{isArabic ? "النتائج أو الأخبار أو أي تغيير في الفرضية يضاف هنا ولا يمسح التحديثات القديمة." : "Results, news or thesis changes are added here without deleting old updates."}</p></div></div>
              <div className="admin-form-grid-v21 update-form-v22">
                <label>{isArabic ? "تاريخ التحديث" : "Update date"}<input type="date" value={newUpdate.update_date} onChange={(e) => setNewUpdate({ ...newUpdate, update_date: e.target.value })}/></label>
                <label>{isArabic ? "عنوان التحديث" : "Update title"}<input value={newUpdate.title} onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}/></label>
                <label className="wide">{isArabic ? "تفاصيل التحديث" : "Update details"}<textarea rows="5" value={newUpdate.body} onChange={(e) => setNewUpdate({ ...newUpdate, body: e.target.value })}/></label>
              </div>
              <button className="button gold" onClick={addUpdate}><Plus size={15}/>{isArabic ? "إضافة التحديث" : "Add update"}</button>
              <div className="admin-update-list-v22">
                {updates.map((update) => <article key={update.id}><div><small>{new Date(`${update.update_date}T12:00:00`).toLocaleDateString(locale)}</small><h3>{update.title}</h3><p>{update.body}</p></div>{isSuperAdmin && <button className="icon-button" onClick={() => deleteUpdate(update)} title={isArabic ? "حذف التحديث" : "Delete update"}><Trash2 size={15}/></button>}</article>)}
              </div>
            </article>

            {form.id && form.status === "open" && <article className="panel-v21 padded-v21 closing-panel-v22">
              <div><Target/><span><small>{isArabic ? "إغلاق التوصية" : "Close recommendation"}</small><h2>{isArabic ? "ثبت النتيجة على آخر سعر مرفوع" : "Freeze the result at the latest uploaded prices"}</h2><p>{isArabic ? "سعر السهم والمؤشر الحاليان سيتم حفظهما ولن تتغير النتيجة بعد ذلك." : "The current stock and benchmark values will be saved and will no longer change."}</p></span></div>
              <div><button className="button green" onClick={() => closeAtLatest("target_hit")}><TrendingUp size={15}/>{isArabic ? "إغلاق كمستهدف محقق" : "Close as target hit"}</button><button className="button subtle" onClick={() => closeAtLatest("closed")}><Archive size={15}/>{isArabic ? "إغلاق عادي" : "Close normally"}</button><button className="button danger" onClick={() => closeAtLatest("stopped")}><Archive size={15}/>{isArabic ? "إيقاف التوصية" : "Stop recommendation"}</button></div>
            </article>}
          </section>
        </main>
      </div>
    </div>
  );
}

function Summary({ label, value, tone }) {
  return <article className={`admin-summary-v21 ${tone}`}><span><TrendingUp/></span><div><small>{label}</small><b>{value}</b></div></article>;
}

function Meta({ label, value }) {
  return <div><small>{label}</small><b>{value || "—"}</b></div>;
}

function profileName(profiles, id) {
  if (!id) return "—";
  const found = profiles.find((item) => item.id === id);
  return found?.full_name || found?.email || id;
}
