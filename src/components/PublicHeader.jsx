import { useState } from "react";
import { BarChart3, BookOpen, LayoutDashboard, Lightbulb, Menu, MoreHorizontal, Newspaper, UserRound, WalletCards, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import Brand from "./Brand";
import GlobalSearch from "./GlobalSearch";
import HeaderMenu from "./HeaderMenu";
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
    <header className="public-header platform-header v34-header">
      <Brand />
      <nav className={`public-nav platform-nav v34-nav ${menuOpen ? "open" : ""}`}>
        <NavLink to="/" end onClick={close}><LayoutDashboard size={15}/>{t("navHome")}</NavLink>
        <NavLink to="/portfolios" onClick={close}><WalletCards size={15}/>{isArabic ? "المحافظ" : "Portfolios"}</NavLink>
        <NavLink to="/recommendations" onClick={close}><Lightbulb size={15}/>{isArabic ? "توصيات الأسهم" : "Recommendations"}</NavLink>
        <HeaderMenu label={isArabic ? "استكشف" : "Explore"} icon={MoreHorizontal}>
          <NavLink to="/news" onClick={close}><Newspaper size={15}/>{isArabic ? "الأخبار والتحليل" : "News & Analysis"}</NavLink>
          <NavLink to="/weekly-reports" onClick={close}><BookOpen size={15}/>{isArabic ? "تقارير الأبحاث" : "Research Reports"}</NavLink>
          <NavLink to="/methodology" onClick={close}><BarChart3 size={15}/>{isArabic ? "المنهجية" : "Methodology"}</NavLink>
          <a href="/#pricing" onClick={close}>{isArabic ? "الأسعار" : "Pricing"}</a>
        </HeaderMenu>
        <div className="mobile-nav-actions"><div className="mobile-tools-row-v34"><ThemeToggle/><LanguageToggle compact /></div>{session ? <Link className="button primary full" to={destination} onClick={close}>{profile?.is_admin ? t("admin") : t("navDashboard")}</Link> : <><Link className="button subtle full" to="/login" onClick={close}>{t("login")}</Link><Link className="button primary full" to="/signup" onClick={close}>{t("signup")}</Link></>}</div>
      </nav>
      <div className="header-actions v34-header-actions">
        <GlobalSearch compact />
        <ThemeToggle compact />
        {session ? <HeaderMenu label={profile?.full_name || (isArabic ? "حسابي" : "Account")} icon={UserRound} align="end" className="account-menu-v34"><Link to={destination}><LayoutDashboard size={15}/>{profile?.is_admin ? t("admin") : t("navDashboard")}</Link><Link to="/profile"><UserRound size={15}/>{isArabic ? "الملف الشخصي" : "Profile"}</Link><div className="account-tools-v34"><LanguageToggle compact/></div></HeaderMenu> : <><Link className="button subtle desktop-action" to="/login">{t("login")}</Link><Link className="button primary desktop-action" to="/signup">{t("signup")}</Link></>}
        <button className="mobile-menu-trigger" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen((current) => !current)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </header>
  );
}
