import { useState } from "react";
import { BarChart3, CheckCircle2, LineChart, MailCheck, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand";
import LanguageToggle from "../components/LanguageToggle";
import { useLanguage } from "../context/LanguageContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export default function Signup() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", newsletter: true });
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured || !supabase) return setMessage("Supabase is not configured.");
    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { full_name: form.fullName.trim(), newsletter_opt_in: form.newsletter },
      },
    });
    if (error) setMessage(error.message);
    else setComplete(true);
    setSubmitting(false);
  };

  return (
    <div className="auth-page-v21">
      <div className="auth-shell-v21">
        <section className="auth-story-v21">
          <div className="auth-story-top"><Brand/><LanguageToggle compact/></div>
          <div>
            <span className="eyebrow">ALPHA PLATFORM MEMBER TERMINAL</span>
            <h1>{t("authWelcome")}</h1>
            <p>{t("authText")}</p>
            <div className="auth-benefits">
              <span><LineChart/>{t("cumulativePortfolio")}</span>
              <span><BarChart3/>{t("officialPortfolio")}</span>
              <span><ShieldCheck/>{t("trackRecord")}</span>
            </div>
          </div>
          <small>ALPHA PLATFORM V3.0</small>
        </section>
        <section className="auth-card-v21">
          {complete ? (
            <div className="success-state-v21">
              <MailCheck size={52}/><span className="eyebrow">ALPHA CORE</span><h2>{t("checkEmail")}</h2><p>{t("confirmationSent")}</p><Link className="button gold large full" to="/login">{t("login")}</Link>
            </div>
          ) : (
            <>
              <span className="eyebrow">{t("signup")}</span>
              <h2>{t("createAccount")}</h2>
              <p>{t("ctaText")}</p>
              <form onSubmit={submit}>
                <label>{t("fullName")}<input autoComplete="name" required value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})}/></label>
                <label>{t("email")}<input autoComplete="email" type="email" required value={form.email} onChange={(e) => setForm({...form, email: e.target.value})}/></label>
                <label>{t("password")}<input autoComplete="new-password" type="password" minLength="6" required value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}/></label>
                <label className="check-label-v21"><input type="checkbox" checked={form.newsletter} onChange={(e) => setForm({...form, newsletter: e.target.checked})}/><span>{t("newsletter")}</span></label>
                <button className="button gold large full" disabled={submitting}>{submitting ? t("loading") : t("createAccount")}</button>
              </form>
              {message && <div className="form-message">{message}</div>}
              <p className="auth-switch">{t("alreadyMember")} <Link to="/login">{t("login")}</Link></p>
              <Link className="back-home" to="/"><CheckCircle2 size={14}/> ALPHA CORE</Link>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
