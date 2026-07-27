import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, FilePlus2, Save, Send, Trash2 } from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

const today = () => new Date().toISOString().slice(0, 10);
const weekStart = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
};
const weekEnd = () => {
  const date = new Date(`${weekStart()}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return date.toISOString().slice(0, 10);
};
const slugify = (value) => String(value || "weekly-report").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || `weekly-${Date.now()}`;

const blankReport = () => ({
  id: null,
  slug: "",
  title: "",
  week_start: weekStart(),
  week_end: weekEnd(),
  summary: "",
  market_overview: "",
  portfolio_update: "",
  gold_update: "",
  watch_next: "",
  is_published: false,
  published_at: null,
});

export default function WeeklyReportsAdmin() {
  const { profile } = useAuth();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(blankReport());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (preferredId) => {
    const { data, error } = await supabase.from("weekly_reports").select("*").order("week_end", { ascending: false });
    if (error) setMessage(error.message);
    const rows = data || [];
    setReports(rows);
    const selected = rows.find((item) => item.id === preferredId) || rows.find((item) => item.id === selectedId) || rows[0];
    if (selected) {
      setSelectedId(selected.id);
      setForm({ ...selected });
    } else {
      setSelectedId("");
      setForm(blankReport());
    }
  };

  useEffect(() => { load(); }, []);

  const mediaCopy = useMemo(() => [form.title, form.summary, form.market_overview, form.portfolio_update, form.gold_update, form.watch_next].filter(Boolean).join("\n\n"), [form]);

  const save = async (publish = form.is_published) => {
    if (!form.title.trim() || !form.summary.trim()) return setMessage(isArabic ? "اكتب عنوان التقرير وملخصه" : "Enter the report title and summary.");
    setSaving(true);
    const payload = {
      slug: form.slug?.trim() || `${slugify(form.title)}-${form.week_end}`,
      title: form.title.trim(),
      week_start: form.week_start,
      week_end: form.week_end,
      summary: form.summary.trim(),
      market_overview: form.market_overview || "",
      portfolio_update: form.portfolio_update || "",
      gold_update: form.gold_update || "",
      watch_next: form.watch_next || "",
      is_published: Boolean(publish),
      published_at: publish ? (form.published_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    };
    let id = form.id;
    let error;
    if (id) ({ error } = await supabase.from("weekly_reports").update(payload).eq("id", id));
    else {
      const result = await supabase.from("weekly_reports").insert({ ...payload, created_by: profile.id }).select("id").single();
      error = result.error;
      id = result.data?.id;
    }
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(publish ? (isArabic ? "تم نشر التقرير الأسبوعي" : "Weekly report published.") : (isArabic ? "تم حفظ المسودة" : "Draft saved."));
    await load(id);
  };

  const remove = async () => {
    if (!form.id || !window.confirm(isArabic ? "حذف التقرير؟" : "Delete this report?")) return;
    const { error } = await supabase.from("weekly_reports").delete().eq("id", form.id);
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم حذف التقرير" : "Report deleted.");
    await load();
  };

  const copyForMedia = async () => {
    await navigator.clipboard.writeText(mediaCopy);
    setMessage(isArabic ? "تم نسخ نص التقرير للنشر على الميديا" : "Report copy prepared for media and copied.");
  };

  return (
    <div className="dashboard-shell admin-shell-v21">
      <DashboardHeader admin />
      <div className="admin-workspace-v21 weekly-admin-v23">
        <aside className="admin-months-v21">
          <div className="admin-profile-v21"><small>WEEKLY DESK</small><b>{profile?.full_name || profile?.email}</b></div>
          <button className="button gold full" onClick={() => { setSelectedId(""); setForm(blankReport()); setMessage(""); }}><FilePlus2 size={16}/>{isArabic ? "تقرير جديد" : "New report"}</button>
          <nav>
            {reports.map((item) => <button className={selectedId === item.id ? "active" : ""} key={item.id} onClick={() => { setSelectedId(item.id); setForm({ ...item }); }}><span><b>{item.title}</b><small>{new Date(`${item.week_end}T12:00:00`).toLocaleDateString(locale)}</small></span><small className={item.is_published ? "live" : "draft"}>{item.is_published ? (isArabic ? "منشور" : "Live") : (isArabic ? "مسودة" : "Draft")}</small></button>)}
          </nav>
          <a className="button subtle full" href="/weekly-reports"><Eye size={16}/>{isArabic ? "عرض التقارير" : "View reports"}</a>
        </aside>

        <main className="admin-content-v21">
          <header className="admin-top-v21">
            <div><span className="eyebrow">WEEKLY REPORT</span><h1>{form.title || (isArabic ? "تقرير أسبوعي جديد" : "New weekly report")}</h1><p>{isArabic ? "اكتب التقرير مرة واحدة ثم انشره للأعضاء وانسخ نسخة جاهزة للميديا." : "Write once, publish to members and copy a media-ready version."}</p></div>
            <div className="admin-actions-v21">
              {form.id && <button className="button danger" onClick={remove}><Trash2 size={15}/></button>}
              <button className="button subtle" onClick={copyForMedia}><Copy size={15}/>{isArabic ? "نسخ للميديا" : "Copy for media"}</button>
              <button className="button subtle" disabled={saving} onClick={() => save(false)}><Save size={15}/>{isArabic ? "حفظ مسودة" : "Save draft"}</button>
              <button className="button gold" disabled={saving} onClick={() => save(true)}><Send size={15}/>{isArabic ? "نشر التقرير" : "Publish"}</button>
            </div>
          </header>

          {message && <div className="notice-bar">{message}</div>}

          <section className="admin-grid-v21">
            <article className="panel-v21 padded-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">SETUP</span><h2>{isArabic ? "بيانات الأسبوع" : "Week setup"}</h2></div></div>
              <div className="admin-form-grid-v21">
                <label className="wide">{isArabic ? "عنوان التقرير" : "Report title"}<input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
                <label>{isArabic ? "بداية الأسبوع" : "Week start"}<input type="date" value={form.week_start || today()} onChange={(e) => setForm({ ...form, week_start: e.target.value })}/></label>
                <label>{isArabic ? "نهاية الأسبوع" : "Week end"}<input type="date" value={form.week_end || today()} onChange={(e) => setForm({ ...form, week_end: e.target.value })}/></label>
                <label className="wide">{isArabic ? "ملخص يظهر على الكارت" : "Card summary"}<textarea rows="4" value={form.summary || ""} onChange={(e) => setForm({ ...form, summary: e.target.value })}/></label>
              </div>
            </article>

            <article className="panel-v21 padded-v21">
              <div className="panel-heading-v21"><div><span className="eyebrow">CONTENT</span><h2>{isArabic ? "محتوى التقرير" : "Report content"}</h2></div></div>
              <div className="admin-form-grid-v21">
                <label className="wide">{isArabic ? "ما حدث في السوق" : "Market overview"}<textarea rows="8" value={form.market_overview || ""} onChange={(e) => setForm({ ...form, market_overview: e.target.value })}/></label>
                <label className="wide">{isArabic ? "تحديث المحافظ" : "Portfolio update"}<textarea rows="8" value={form.portfolio_update || ""} onChange={(e) => setForm({ ...form, portfolio_update: e.target.value })}/></label>
                <label className="wide">{isArabic ? "تحديث الذهب" : "Gold update"}<textarea rows="8" value={form.gold_update || ""} onChange={(e) => setForm({ ...form, gold_update: e.target.value })}/></label>
                <label className="wide">{isArabic ? "ما نراقبه الأسبوع القادم" : "What to watch next"}<textarea rows="8" value={form.watch_next || ""} onChange={(e) => setForm({ ...form, watch_next: e.target.value })}/></label>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
