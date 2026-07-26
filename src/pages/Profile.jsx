import { useEffect, useState } from "react";
import { ArrowLeft, Save, UserCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [name, setName] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(profile?.full_name || "");
    setNewsletter(Boolean(profile?.newsletter_opt_in));
  }, [profile]);

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), newsletter_opt_in: newsletter }).eq("id", profile.id);
    if (error) return setMessage(error.message);
    await refreshProfile();
    setMessage(t("saved"));
  };

  return (
    <div className="dashboard-shell">
      <DashboardHeader admin={profile?.is_admin}/>
      <main className="profile-page-v21">
        <Link className="back-link" to={profile?.is_admin ? "/admin" : "/dashboard"}><ArrowLeft size={15}/> {profile?.is_admin ? t("admin") : t("navDashboard")}</Link>
        <section className="profile-card-v21">
          <UserCircle2 size={52}/>
          <span className="eyebrow">ALPHA CORE</span>
          <h1>{t("profileTitle")}</h1>
          <p>{t("profileText")}</p>
          <form onSubmit={save}>
            <label>{t("fullName")}<input value={name} onChange={(e) => setName(e.target.value)}/></label>
            <label>{t("email")}<input value={profile?.email || ""} disabled/></label>
            <label>{language === "ar" ? "اللغة" : "Language"}<select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="ar">العربية</option></select></label>
            <label className="check-label-v21"><input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)}/><span>{t("newsletter")}</span></label>
            <button className="button gold large"><Save size={16}/>{t("save")}</button>
          </form>
          {message && <div className="form-message">{message}</div>}
        </section>
      </main>
    </div>
  );
}
