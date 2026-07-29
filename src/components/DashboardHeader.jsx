import { useState } from "react";
import { BarChart3, ChevronDown, FileSpreadsheet, Headphones, LayoutDashboard, Lightbulb, LogOut, Menu, Newspaper, Settings, ShieldCheck, UserRound, UsersRound, WalletCards, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import Brand from "./Brand";
import GlobalSearch from "./GlobalSearch";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function DashboardHeader({ admin = false }) {
  const { profile, signOut } = useAuth();
  const { t, isArabic } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <header className="dashboard-header platform-header">
      <Brand to={admin ? "/admin" : "/dashboard"} />
      <nav className={`dashboard-nav platform-nav ${menuOpen ? "open" : ""}`}>
        {!admin && <NavLink to="/dashboard" onClick={close}><LayoutDashboard size={15}/>{isArabic ? "الرئيسية" : "Dashboard"}</NavLink>}
        {!admin && <NavLink to="/portfolios" onClick={close}><WalletCards size={15}/>{isArabic ? "المحافظ" : "Portfolios"}</NavLink>}
        {!admin && <NavLink to="/recommendations" onClick={close}><Lightbulb size={15}/>{isArabic ? "التوصيات" : "Recommendations"}</NavLink>}
        {!admin && <NavLink to="/recommendations" onClick={close}><BarChart3 size={15}/>{isArabic ? "الأبحاث" : "Research"}</NavLink>}
        {!admin && <NavLink to="/news" onClick={close}><Newspaper size={15}/>{isArabic ? "الأخبار" : "News & Analysis"}</NavLink>}
        {!admin && <NavLink to="/weekly-reports" onClick={close}><Newspaper size={15}/>{isArabic ? "التقارير" : "Weekly Reports"}</NavLink>}
        {!admin && <NavLink to="/methodology" onClick={close}>{isArabic ? "الرؤى" : "Insights"}</NavLink>}

        {admin && <NavLink to="/admin" end onClick={close}><ShieldCheck size={15}/>{isArabic ? "المحافظ" : "Portfolios"}</NavLink>}
        {admin && <NavLink to="/admin/recommendations" onClick={close}><Lightbulb size={15}/>{isArabic ? "التوصيات" : "Recommendations"}</NavLink>}
        {admin && <NavLink to="/admin/weekly-reports" onClick={close}><Newspaper size={15}/>{isArabic ? "التقارير" : "Reports"}</NavLink>}
        {admin && <NavLink to="/admin/prices" onClick={close}><FileSpreadsheet size={15}/>{isArabic ? "الأسعار" : "Price Data"}</NavLink>}
        {admin && <NavLink to="/admin/support" onClick={close}><Headphones size={15}/>{isArabic ? "الدعم" : "Support"}</NavLink>}
        {admin && profile?.is_super_admin && <NavLink to="/admin/team" onClick={close}><UsersRound size={15}/>{isArabic ? "الفريق" : "Team & Access"}</NavLink>}
        {admin && <NavLink to="/admin/settings" onClick={close}><Settings size={15}/>{isArabic ? "الإعدادات" : "Settings"}</NavLink>}
        {admin && <NavLink to="/dashboard" onClick={close}>{t("viewMember")}</NavLink>}
        <div className="mobile-nav-actions"><ThemeToggle/><LanguageToggle compact/><Link className="button subtle full" to="/profile" onClick={close}><Settings size={15}/>{isArabic ? "إعدادات الحساب" : "Account settings"}</Link><button className="button danger full" type="button" onClick={signOut}><LogOut size={15}/>{t("logout")}</button></div>
      </nav>
      <div className="header-actions dashboard-actions">
        <GlobalSearch compact />
        <ThemeToggle compact />
        <LanguageToggle compact />
        <Link className="profile-trigger" to="/profile"><span className="profile-avatar"><UserRound size={15}/></span><span><b>{profile?.full_name || profile?.email}</b><small>{profile?.is_super_admin ? "SUPER ADMIN" : profile?.is_admin ? "ADMIN" : "MEMBER"}</small></span><ChevronDown size={13}/></Link>
        <button className="icon-button logout-button" type="button" onClick={signOut} title={t("logout")}><LogOut size={17}/></button>
        <button className="mobile-menu-trigger" type="button" onClick={() => setMenuOpen((current) => !current)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </header>
  );
}
