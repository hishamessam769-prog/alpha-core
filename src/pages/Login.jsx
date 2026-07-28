import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, LineChart, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Brand from "../components/Brand";
import LanguageToggle from "../components/LanguageToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export default function Login() {
  const { session, profile, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && profile) {
      const preferred = location.state?.from;
      navigate(profile.is_admin ? "/admin" : preferred || "/dashboard", { replace: true });
    }
  }, [loading, session, profile, navigate, location.state]);

  const submit = async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured || !supabase) return setMessage("Supabase is not configured.");
    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage(error.message);
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
          <span className="eyebrow">{t("login")}</span>
          <h2>{t("login")}</h2>
          <p>{t("dashboardSubtitle")}</p>
          <form onSubmit={submit}>
            <label>{t("email")}<input autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>{t("password")}<input autoComplete="current-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="button gold large full" disabled={submitting}>{submitting ? t("loading") : t("login")}</button>
          </form>
          {message && <div className="form-message">{message}</div>}
          <p className="auth-switch">{t("newMember")} <Link to="/signup">{t("signup")}</Link></p>
          <Link className="back-home" to="/"><CheckCircle2 size={14}/> ALPHA CORE</Link>
        </section>
      </div>
    </div>
  );
}
