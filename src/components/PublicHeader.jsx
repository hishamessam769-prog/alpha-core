import { useState } from "react";
import { ChevronDown, Menu, UserRound, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import Brand from "./Brand";
import GlobalSearch from "./GlobalSearch";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function PublicHeader() {
  const { session, profile } = useAuth();
  const { t, isArabic } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const destination = profile?.is_admin ? "/admin" : "/dashboard";
  const close = () => setMenuOpen(false);

  return (
    <header className="public-header platform-header">
      <Brand />
      <nav className={`public-nav platform-nav ${menuOpen ? "open" : ""}`}>
        <NavLink to="/" end onClick={close}>{t("navHome")}</NavLink>
        <NavLink to="/dashboard" onClick={close}>{isArabic ? "المحافظ" : "Portfolio"}</NavLink>
        <NavLink to="/recommendations" onClick={close}>{isArabic ? "التوصيات" : "Recommendations"}</NavLink>
        <Link to="/recommendations#research-library" onClick={close}>{isArabic ? "الأبحاث" : "Research"}</Link>
        <NavLink to="/weekly-reports" onClick={close}>{isArabic ? "التقارير" : "Weekly Reports"}</NavLink>
        <NavLink to="/methodology" onClick={close}>{isArabic ? "الرؤى" : "Insights"}</NavLink>
        <a href="/#pricing" onClick={close}>{isArabic ? "الأسعار" : "Pricing"}</a>
        <a href="/#about" onClick={close}>{isArabic ? "عن المنصة" : "About"}</a>
        <div className="mobile-nav-actions"><ThemeToggle/><LanguageToggle compact />{session ? <Link className="button gold full" to={destination} onClick={close}>{profile?.is_admin ? t("admin") : t("navDashboard")}</Link> : <><Link className="button subtle full" to="/login" onClick={close}>{t("login")}</Link><Link className="button gold full" to="/signup" onClick={close}>{t("signup")}</Link></>}</div>
      </nav>
      <div className="header-actions">
        <GlobalSearch compact />
        <ThemeToggle compact />
        <LanguageToggle compact />
        {session ? <Link className="profile-trigger" to={destination}><UserRound size={16}/><span>{profile?.full_name || (isArabic ? "حسابي" : "Account")}</span><ChevronDown size={13}/></Link> : <><Link className="button subtle desktop-action" to="/login">{t("login")}</Link><Link className="button gold" to="/signup">{t("signup")}</Link></>}
        <button className="mobile-menu-trigger" type="button" onClick={() => setMenuOpen((current) => !current)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </header>
  );
}
