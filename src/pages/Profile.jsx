import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Save, ShieldCheck, UserCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import PublishingStudio from "./PublishingStudio";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { canAccessAdmin, canAccessCreatorStudio, roleLabel, roleTitle, supportedProfileFields, workspaceRoute } from "../lib/access";
import { supabase } from "../lib/supabase";

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const { t, language, setLanguage, isArabic } = useLanguage();
  const [form, setForm] = useState({ name: "", newsletter: false, title: "", bio: "", avatarUrl: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const creator = canAccessCreatorStudio(profile);
  const admin = canAccessAdmin(profile);
  const fields = supportedProfileFields(profile);

  useEffect(() => {
    setForm({
      name: profile?.full_name || "",
      newsletter: Boolean(profile?.newsletter_opt_in),
      title: profile?.title || profile?.position || roleTitle(profile),
      bio: profile?.bio || "",
      avatarUrl: profile?.avatar_url || profile?.photo_url || profile?.profile_picture || "",
    });
  }, [profile]);

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    const payload = { full_name: form.name.trim(), newsletter_opt_in: form.newsletter };
    if (fields.bio) payload.bio = form.bio.trim();
    if (Object.prototype.hasOwnProperty.call(profile || {}, "avatar_url")) payload.avatar_url = form.avatarUrl.trim() || null;
    else if (Object.prototype.hasOwnProperty.call(profile || {}, "photo_url")) payload.photo_url = form.avatarUrl.trim() || null;
    else if (Object.prototype.hasOwnProperty.call(profile || {}, "profile_picture")) payload.profile_picture = form.avatarUrl.trim() || null;
    const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
    setSaving(false);
    if (error) return setMessage(error.message);
    await refreshProfile();
    setMessage(t("saved"));
  };

  return (
    <div className="dashboard-shell profile-shell-v33">
      <DashboardHeader admin={admin}/>
      <main className="profile-page-v33">
        <Link className="back-link" to={admin ? workspaceRoute(profile) : "/dashboard"}><ArrowLeft size={15}/>{admin ? (isArabic ? "مساحة العمل" : "Workspace") : t("navDashboard")}</Link>

        <section className="profile-hero-v33">
          <div className="profile-hero-avatar-v33">{form.avatarUrl ? <img src={form.avatarUrl} alt=""/> : <UserCircle2/>}</div>
          <div><span className="eyebrow">PROFILE & CREATOR IDENTITY</span><h1>{profile?.full_name || t("profileTitle")}</h1><p>{form.bio || (creator ? (isArabic ? "حدّث بياناتك لأنها تظهر تلقائيًا أسفل كل مادة أو توصية أو محفظة تنشرها." : "Keep this identity current—it is automatically attached to every portfolio, recommendation and article you publish.") : t("profileText"))}</p><div className="profile-role-row-v33"><span><BadgeCheck/>{roleLabel(profile)}</span>{profile?.id && <Link to={`/analysts/${profile.id}`}>{isArabic ? "فتح الملف العام" : "View public profile"}<ArrowUpRight/></Link>}</div></div>
          <div className="profile-security-v33"><ShieldCheck/><small>{isArabic ? "حساب موثق" : "VERIFIED ACCOUNT"}</small><b>{profile?.email}</b></div>
        </section>

        <div className="profile-layout-v33">
          <section className="profile-card-v33">
            <header><div><span className="eyebrow">ACCOUNT SETTINGS</span><h2>{isArabic ? "الهوية والتفضيلات" : "Identity and preferences"}</h2></div><UserCircle2/></header>
            <form onSubmit={save}>
              <label>{t("fullName")}<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
              <label>{t("email")}<input value={profile?.email || ""} disabled/></label>
              {creator && (fields.title || fields.position) && <label>{isArabic ? "الدور المهني" : "Professional role"}<input value={form.title} disabled/><small className="field-help-v33">{isArabic ? "يتم تعيين الدور من Super Admin داخل Team & Access." : "Managed by the Super Admin in Team & Access."}</small></label>}
              {creator && fields.avatar && <label>{isArabic ? "رابط الصورة الشخصية" : "Profile image URL"}<input type="url" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://..."/></label>}
              {creator && fields.bio && <label className="wide">{isArabic ? "نبذة عامة" : "Public bio"}<textarea rows="5" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })}/></label>}
              <label>{language === "ar" ? "اللغة" : "Language"}<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">English</option><option value="ar">العربية</option></select></label>
              <label className="check-label-v21"><input type="checkbox" checked={form.newsletter} onChange={(event) => setForm({ ...form, newsletter: event.target.checked })}/><span>{t("newsletter")}</span></label>
              <button className="button primary large" disabled={saving}><Save size={16}/>{t("save")}</button>
            </form>
            {message && <div className="form-message">{message}</div>}
          </section>

          <aside className="profile-access-card-v33">
            <span className="eyebrow">ACCESS PROFILE</span>
            <h2>{roleLabel(profile)}</h2>
            <p>{isArabic ? "الأدوات الظاهرة في المنصة تتغير تلقائيًا حسب دورك وصلاحياتك." : "The workspace and publishing actions shown to you are generated from your role and permissions."}</p>
            <div><span><small>{isArabic ? "النشر" : "Publishing"}</small><b>{creator ? (isArabic ? "مفعّل" : "Enabled") : (isArabic ? "غير مفعّل" : "Not enabled")}</b></span><span><small>{isArabic ? "الإدارة" : "Administration"}</small><b>{admin ? (isArabic ? "متاح" : "Available") : (isArabic ? "غير متاح" : "Restricted")}</b></span><span><small>User ID</small><b>{profile?.id}</b></span></div>
          </aside>
        </div>

        {creator && <PublishingStudio embedded/>}
      </main>
    </div>
  );
}
