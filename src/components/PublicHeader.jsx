import { useState } from "react";
import { ChevronDown, Menu, UserRound, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import Brand from "./Brand";
import GlobalSearch from "./GlobalSearch";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { canAccessAdmin, workspaceRoute } from "../lib/access";

export default function PublicHeader() {
  const { session, profile } = useAuth();
  const { t, isArabic } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const destination = canAccessAdmin(profile) ? workspaceRoute(profile) : "/dashboard";
  const close = () => setMenuOpen(false);

  return (
    <header className="public-header platform-header v33-header">
      <Brand />
      <nav className={`public-nav platform-nav v33-nav ${menuOpen ? "open" : ""}`}>
        <NavLink to="/" end onClick={close}>{t("navHome")}</NavLink>
        <NavLink to="/portfolios" onClick={close}>{isArabic ? "المحافظ" : "Portfolios"}</NavLink>
        <NavLink to="/recommendations" onClick={close}>{isArabic ? "توصيات الأسهم" : "Stock Recommendations"}</NavLink>
        <NavLink to="/news" onClick={close}>{isArabic ? "الأخبار والتحليل" : "News & Analysis"}</NavLink>
        <NavLink to="/weekly-reports" onClick={close}>{isArabic ? "تقارير الأبحاث" : "Research Reports"}</NavLink>
        <NavLink to="/methodology" onClick={close}>{isArabic ? "المنهجية" : "Methodology"}</NavLink>
        <a href="/#pricing" onClick={close}>{isArabic ? "الأسعار" : "Pricing"}</a>
        <div className="mobile-nav-actions"><div className="mobile-tools-row-v33"><ThemeToggle/><LanguageToggle compact /></div>{session ? <Link className="button primary full" to={destination} onClick={close}>{profile?.is_admin ? t("admin") : t("navDashboard")}</Link> : <><Link className="button subtle full" to="/login" onClick={close}>{t("login")}</Link><Link className="button primary full" to="/signup" onClick={close}>{t("signup")}</Link></>}</div>
      </nav>
      <div className="header-actions">
        <GlobalSearch compact />
        <ThemeToggle compact />
        <LanguageToggle compact />
        {session ? <Link className="profile-trigger" to={destination}><UserRound size={16}/><span>{profile?.full_name || (isArabic ? "حسابي" : "Account")}</span><ChevronDown size={13}/></Link> : <><Link className="button subtle desktop-action" to="/login">{t("login")}</Link><Link className="button primary" to="/signup">{t("signup")}</Link></>}
        <button className="mobile-menu-trigger" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen((current) => !current)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </header>
  );
}
