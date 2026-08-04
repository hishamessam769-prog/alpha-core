import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2, Eye, FileEdit, Image, Lightbulb, Newspaper, Pencil, PlayCircle, Plus, Save, Send, Sparkles, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { deriveRole, hasPermission, roleLabel } from "../lib/access";
import { supabase } from "../lib/supabase";
import { dispatchQueuedPushNotifications } from "../lib/pushNotifications";

const isoDate = () => new Date().toISOString().slice(0, 10);
const slugify = (value) => String(value || "article").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || `article-${Date.now()}`;

const emptyForm = () => ({
  type: "market-news",
  title: "",
  summary: "",
  body: "",
  watchNext: "",
  imageUrl: "",
  videoUrl: "",
  sendPushNotification: true,
});

export default function PublishingStudio({ embedded = false }) {
  const { profile } = useAuth();
  const { isArabic } = useLanguage();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [publishedId, setPublishedId] = useState("");
  const [articles, setArticles] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [editingSlug, setEditingSlug] = useState("");
  const canPublishArticle = hasPermission(profile, "publish_articles") || hasPermission(profile, "manage_reports");
  const canManagePortfolios = hasPermission(profile, "manage_portfolios");
  const canManageRecommendations = hasPermission(profile, "manage_recommendations");
  const canManageReports = hasPermission(profile, "manage_reports");

  const loadArticles = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase.from("weekly_reports").select("*").order("updated_at", { ascending: false }).limit(100);
    if (error) {
      setMessage(error.message);
      return;
    }
    const canSeeAll = Boolean(profile.is_super_admin) || hasPermission(profile, "manage_reports");
    setArticles((data || []).filter((item) => {
      const slug = String(item.slug || "");
      const isArticle = slug.startsWith("market-news-") || slug.startsWith("economic-update-");
      return isArticle && (canSeeAll || item.created_by === profile.id);
    }));
  };

  useEffect(() => { loadArticles(); }, [profile?.id]);

  const beginNew = () => {
    setEditingId("");
    setEditingSlug("");
    setPublishedId("");
    setMessage("");
    setForm(emptyForm());
    document.getElementById("article-composer-v33")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const editArticle = (article) => {
    const slug = String(article.slug || "");
    setEditingId(article.id);
    setEditingSlug(slug);
    setPublishedId("");
    setMessage("");
    setForm({
      type: slug.startsWith("economic-update-") ? "economic-update" : "market-news",
      title: article.title || "",
      summary: article.summary || "",
      body: article.market_overview || "",
      watchNext: article.watch_next || "",
      imageUrl: "",
      videoUrl: "",
    });
    document.getElementById("article-composer-v33")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const removeArticle = async (article) => {
    if (!profile?.is_super_admin) return;
    const confirmed = window.confirm(isArabic
      ? `سيتم حذف المادة "${article.title}" نهائيًا. هل تؤكد؟`
      : `“${article.title}” will be permanently deleted. Confirm?`);
    if (!confirmed) return;
    const { error } = await supabase.rpc("delete_weekly_report", { p_report_id: article.id });
    if (error) return setMessage(error.message);
    if (editingId === article.id) beginNew();
    setMessage(isArabic ? "تم حذف المادة بواسطة Super Admin." : "Article deleted by Super Admin.");
    await loadArticles();
  };

  const contentPreview = useMemo(() => [form.body.trim(), form.imageUrl.trim(), form.videoUrl.trim()].filter(Boolean).join("\n\n"), [form]);

  const publish = async (isPublished) => {
    if (!canPublishArticle) return;
    if (!form.title.trim() || !form.summary.trim() || !form.body.trim()) {
      setMessage(isArabic ? "أدخل العنوان والملخص ومحتوى المقال." : "Enter a title, summary and article content.");
      return;
    }
    setSaving(true);
    setMessage("");
    setPublishedId("");
    const today = isoDate();
    const prefix = form.type === "economic-update" ? "economic-update" : "market-news";
    const payload = {
      slug: editingSlug ? editingSlug.replace(/^(market-news|economic-update)/, prefix) : `${prefix}-${slugify(form.title)}-${Date.now().toString(36)}`,
      title: form.title.trim(),
      week_start: today,
      week_end: today,
      summary: form.summary.trim(),
      market_overview: contentPreview,
      portfolio_update: "",
      gold_update: "",
      watch_next: form.watchNext.trim(),
      is_published: Boolean(isPublished),
      published_at: isPublished ? new Date().toISOString() : null,
      is_demo: false,
      send_push_notification: Boolean(form.sendPushNotification),
      updated_at: new Date().toISOString(),
    };
    const result = editingId
      ? await supabase.from("weekly_reports").update(payload).eq("id", editingId).select("id").single()
      : await supabase.from("weekly_reports").insert({ ...payload, created_by: profile.id }).select("id").single();
    const { data, error } = result;
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setPublishedId(isPublished ? (data?.id || "") : "");
    setMessage(isPublished
      ? (isArabic ? "تم نشر المادة في News & Analysis بنجاح." : "Published successfully to News & Analysis.")
      : (isArabic ? "تم حفظ المادة كمسودة." : "Saved as a draft."));
    setEditingId("");
    setEditingSlug("");
    setForm(emptyForm());
    if (isPublished && form.sendPushNotification) void dispatchQueuedPushNotifications();
    await loadArticles();
    window.dispatchEvent(new CustomEvent("alpha:meaningful-action", { detail: { action: isPublished ? "publish_article" : "save_article_draft" } }));
  };

  const content = (
    <section className={`publishing-studio-v33 ${embedded ? "embedded" : ""}`}>
      <section className="creator-command-v33">
        <div>
          <span className="eyebrow">CREATOR COMMAND CENTRE</span>
          <h1>{isArabic ? "انشر المعلومة في مكانها الصحيح" : "Publish intelligence from one focused workspace"}</h1>
          <p>{isArabic ? "لوحة موحدة للمحللين والمدربين والمساهمين لإنشاء الأخبار والتحديثات والوصول المباشر إلى أدوات المحافظ والتوصيات." : "A unified workspace for analysts, instructors and contributors to create market intelligence and reach portfolio and recommendation tools in one click."}</p>
        </div>
        <div className="creator-identity-v33"><span>{(profile?.full_name || profile?.email || "A").slice(0, 2).toUpperCase()}</span><div><small>AUTHORISED CREATOR</small><b>{profile?.full_name || profile?.email}</b><em>{roleLabel(profile)} · {deriveRole(profile).replace("_", " ")}</em></div></div>
      </section>

      <section className="creator-action-grid-v33">
        <ActionCard icon={<Newspaper/>} title={isArabic ? "خبر أو تحليل سوق" : "Market news or analysis"} text={isArabic ? "أنشئ مادة تظهر داخل News & Analysis مع اسمك وصورتك تلقائيًا." : "Create a rich News & Analysis article with automatic author attribution."} enabled={canPublishArticle} active/>
        <ActionCard icon={<BriefcaseBusiness/>} title={isArabic ? "تغيير محفظة" : "Portfolio change"} text={isArabic ? "حدّث شهرًا أو الأوزان أو المراكز من مساحة المحافظ الحالية." : "Update a month, allocation or holding through the existing portfolio workflow."} enabled={canManagePortfolios} to="/admin"/>
        <ActionCard icon={<Lightbulb/>} title={isArabic ? "توصية سهم" : "Stock recommendation"} text={isArabic ? "أنشئ توصية أو أضف تحديثًا إلى توصية قائمة." : "Create a recommendation or publish an update to an existing call."} enabled={canManageRecommendations} to="/admin/recommendations"/>
        <ActionCard icon={<BookOpen/>} title={isArabic ? "تقرير أسبوعي" : "Weekly report"} text={isArabic ? "استخدم محرر التقارير الكامل للنشر الدوري." : "Use the full report editor for scheduled weekly intelligence."} enabled={canManageReports} to="/admin/weekly-reports"/>
      </section>

      <section className="publisher-layout-v33">
        <article className="publisher-form-v33" id="article-composer-v33">
          <header><div><span className="eyebrow">ARTICLE COMPOSER</span><h2>{editingId ? (isArabic ? "تعديل المادة الحالية" : "Edit current article") : (isArabic ? "إنشاء ونشر مادة جديدة" : "Create and publish a new article")}</h2><p>{isArabic ? "يدعم النص المنسق والصور وروابط YouTube وVimeo والفيديو المباشر بدون جدول جديد." : "Supports formatted copy, images, YouTube, Vimeo and direct video links through the existing content workflow."}</p></div><FileEdit/></header>
          {!canPublishArticle && <div className="permission-callout-v33"><Sparkles/><div><b>{isArabic ? "صلاحية النشر غير مفعلة" : "Publishing permission is not enabled"}</b><p>{isArabic ? "اطلب من Super Admin منحك Contributor أو Analyst أو Instructor." : "Ask the Super Admin to assign Contributor, Analyst or Instructor access."}</p></div></div>}
          <div className="publisher-fields-v33">
            <label>{isArabic ? "نوع المادة" : "Content type"}<select value={form.type} disabled={!canPublishArticle} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="market-news">{isArabic ? "خبر وتحليل سوق" : "Market news & analysis"}</option><option value="economic-update">{isArabic ? "تحديث اقتصادي" : "Economic update"}</option></select></label>
            <label>{isArabic ? "العنوان" : "Headline"}<input value={form.title} disabled={!canPublishArticle} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={isArabic ? "عنوان واضح ومباشر" : "A clear, decision-useful headline"}/></label>
            <label className="wide">{isArabic ? "ملخص الكارت" : "Card summary"}<textarea rows="3" value={form.summary} disabled={!canPublishArticle} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder={isArabic ? "ملخص قصير يظهر في صفحة الأخبار" : "A concise summary shown on the news card"}/></label>
            <label className="wide">{isArabic ? "محتوى المقال" : "Article content"}<textarea rows="11" value={form.body} disabled={!canPublishArticle} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={isArabic ? "اكتب فقرات واستخدم - للقوائم أو 1. للخطوات" : "Write paragraphs; use - for bullets or 1. for numbered points"}/></label>
            <label><span><Image/>{isArabic ? "رابط صورة عالية الجودة" : "High-resolution image URL"}</span><input type="url" value={form.imageUrl} disabled={!canPublishArticle} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://...image.webp"/></label>
            <label><span><PlayCircle/>{isArabic ? "رابط فيديو" : "Video URL"}</span><input type="url" value={form.videoUrl} disabled={!canPublishArticle} onChange={(event) => setForm({ ...form, videoUrl: event.target.value })} placeholder="YouTube, Vimeo or MP4"/></label>
            <label className="wide">{isArabic ? "ما يجب مراقبته لاحقًا" : "What to watch next"}<textarea rows="4" value={form.watchNext} disabled={!canPublishArticle} onChange={(event) => setForm({ ...form, watchNext: event.target.value })} placeholder={isArabic ? "حدث أو أكثر، كل حدث في سطر" : "One event per line"}/></label>
          </div>
          <footer><label className="check-label-v22 notification-publish-toggle-v37"><input type="checkbox" checked={Boolean(form.sendPushNotification)} onChange={(event) => setForm({ ...form, sendPushNotification: event.target.checked })}/>{isArabic ? "إرسال إشعار عند النشر" : "Notify subscribers"}</label>{editingId && <button className="button ghost" type="button" disabled={saving} onClick={beginNew}><Plus/>{isArabic ? "مادة جديدة" : "New article"}</button>}<button className="button subtle" type="button" disabled={!canPublishArticle || saving} onClick={() => publish(false)}><Save/>{isArabic ? "حفظ مسودة" : "Save draft"}</button><button className="button primary" type="button" disabled={!canPublishArticle || saving} onClick={() => publish(true)}><Send/>{isArabic ? "نشر الآن" : "Publish now"}</button></footer>
          {message && <div className={`form-message ${publishedId ? "success" : ""}`}>{publishedId ? <CheckCircle2/> : null}<span>{message}</span>{publishedId && <Link to={`/news/report/${publishedId}`}>{isArabic ? "فتح المادة" : "Open article"}<ArrowRight/></Link>}</div>}
        </article>

        <aside className="publisher-preview-v33">
          <div className="preview-orbit-v33"><BarChart3/><i/><i/><i/></div>
          <span className="eyebrow">LIVE PREVIEW</span>
          <small>{form.type === "economic-update" ? "ECONOMIC UPDATE" : "MARKET INTELLIGENCE"}</small>
          <h3>{form.title || (isArabic ? "عنوان المادة سيظهر هنا" : "Your headline will appear here")}</h3>
          <p>{form.summary || (isArabic ? "اكتب ملخصًا قصيرًا يشرح لماذا تستحق المادة القراءة." : "Add a concise summary explaining why the article matters.")}</p>
          <div className="preview-media-status-v33"><span className={form.imageUrl ? "ready" : ""}><Image/>{form.imageUrl ? (isArabic ? "الصورة جاهزة" : "Image ready") : (isArabic ? "بدون صورة" : "No image")}</span><span className={form.videoUrl ? "ready" : ""}><PlayCircle/>{form.videoUrl ? (isArabic ? "الفيديو جاهز" : "Video ready") : (isArabic ? "بدون فيديو" : "No video")}</span></div>
          <div className="preview-author-v33"><span>{(profile?.full_name || "A").slice(0, 1).toUpperCase()}</span><div><small>PUBLISHED BY</small><b>{profile?.full_name || profile?.email}</b><em>{roleLabel(profile)}</em></div></div>
        </aside>
      </section>

      <section className="publisher-library-v33">
        <header><div><span className="eyebrow">PUBLISHING LIBRARY</span><h2>{isArabic ? "الأخبار والتحديثات المنشورة" : "Published news and economic updates"}</h2><p>{isArabic ? "راجع موادك، افتح المقال المنشور أو عد إلى المحرر للتحديث." : "Review your content, open the published article or return to the composer to update it."}</p></div><button className="button primary" type="button" onClick={beginNew}><Plus/>{isArabic ? "مادة جديدة" : "New article"}</button></header>
        <div className="publisher-library-grid-v33">
          {articles.map((article) => <article key={article.id}>
            <div className="publisher-library-status-v33"><span className={article.is_published ? "published" : "draft"}>{article.is_published ? (isArabic ? "منشور" : "Published") : (isArabic ? "مسودة" : "Draft")}</span><small><CalendarDays/>{article.updated_at ? new Date(article.updated_at).toLocaleDateString(isArabic ? "ar-EG" : "en-GB") : "—"}</small></div>
            <h3>{article.title}</h3><p>{article.summary}</p>
            <footer><button className="button subtle" type="button" onClick={() => editArticle(article)}><Pencil/>{isArabic ? "تعديل" : "Edit"}</button>{article.is_published && <Link className="button ghost" to={`/news/report/${article.id}`}><Eye/>{isArabic ? "فتح" : "Open"}</Link>}{profile?.is_super_admin && <button className="button danger" type="button" onClick={() => removeArticle(article)}><Trash2/></button>}</footer>
          </article>)}
          {!articles.length && <div className="publisher-empty-v33"><Newspaper/><h3>{isArabic ? "لا توجد مواد بعد" : "No articles yet"}</h3><p>{isArabic ? "ابدأ من المحرر بالأعلى، واحفظ مسودة أو انشر مباشرة." : "Start in the composer above, then save a draft or publish immediately."}</p></div>}
        </div>
      </section>
    </section>
  );

  if (embedded) return content;
  return <div className="dashboard-shell creator-shell-v33"><DashboardHeader admin/>{content}</div>;
}

function ActionCard({ icon, title, text, enabled, to = "", active = false }) {
  const body = <><span>{icon}</span><div><small>{enabled ? "AVAILABLE" : "RESTRICTED"}</small><h3>{title}</h3><p>{text}</p></div>{to && <ArrowRight/>}</>;
  if (to && enabled) return <Link className="creator-action-card-v33" to={to}>{body}</Link>;
  return <article className={`creator-action-card-v33 ${active ? "active" : ""} ${enabled ? "" : "disabled"}`}>{body}</article>;
}
