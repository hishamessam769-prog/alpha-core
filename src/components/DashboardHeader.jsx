import { useState } from "react";
import { BarChart3, BookOpen, ChevronDown, FileSpreadsheet, Headphones, LayoutDashboard, Lightbulb, LogOut, Menu, Newspaper, PenSquare, Settings, ShieldCheck, UserRound, UsersRound, WalletCards, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import Brand from "./Brand";
import GlobalSearch from "./GlobalSearch";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { canAccessAdmin, canAccessCreatorStudio, hasAnyPermission, hasPermission, roleLabel, workspaceRoute } from "../lib/access";

export default function DashboardHeader({ admin = false }) {
  const { profile, signOut } = useAuth();
  const { t, isArabic } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const creatorAccess = canAccessCreatorStudio(profile);
  const adminAccess = canAccessAdmin(profile);

  const memberLinks = [
    { to: "/dashboard", label: isArabic ? "الرئيسية" : "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/portfolios", label: isArabic ? "المحافظ" : "Portfolios", icon: WalletCards },
    { to: "/recommendations", label: isArabic ? "توصيات الأسهم" : "Stock Recommendations", icon: Lightbulb },
    { to: "/news", label: isArabic ? "الأخبار والتحليل" : "News & Analysis", icon: Newspaper },
    { to: "/weekly-reports", label: isArabic ? "تقارير الأبحاث" : "Research Reports", icon: BookOpen },
    { to: "/methodology", label: isArabic ? "المنهجية" : "Methodology", icon: BarChart3 },
  ];

  const adminLinks = [
    { to: "/admin", label: isArabic ? "المحافظ" : "Portfolios", icon: WalletCards, show: hasPermission(profile, "manage_portfolios"), end: true },
    { to: "/admin/recommendations", label: isArabic ? "التوصيات" : "Recommendations", icon: Lightbulb, show: hasPermission(profile, "manage_recommendations") },
    { to: "/admin/weekly-reports", label: isArabic ? "التقارير" : "Research Reports", icon: BookOpen, show: hasPermission(profile, "manage_reports") },
    { to: "/admin/publishing", label: isArabic ? "استوديو النشر" : "Publishing Studio", icon: PenSquare, show: creatorAccess },
    { to: "/admin/prices", label: isArabic ? "بيانات الأسعار" : "Price Data", icon: FileSpreadsheet, show: hasAnyPermission(profile, ["manage_portfolios", "manage_recommendations"]) },
    { to: "/admin/support", label: isArabic ? "الدعم" : "Support", icon: Headphones, show: hasPermission(profile, "support_inbox") },
    { to: "/admin/team", label: isArabic ? "الفريق والصلاحيات" : "Team & Access", icon: UsersRound, show: profile?.is_super_admin },
    { to: "/admin/settings", label: isArabic ? "الإعدادات" : "Settings", icon: Settings, show: hasPermission(profile, "manage_settings") },
  ].filter((item) => item.show);

  const links = admin ? adminLinks : memberLinks;

  return (
    <header className="dashboard-header platform-header v33-header">
      <Brand to={admin ? workspaceRoute(profile) : "/dashboard"} />
      <nav className={`dashboard-nav platform-nav v33-nav ${menuOpen ? "open" : ""}`} aria-label={admin ? "Administration" : "Platform"}>
        {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={close}><Icon size={16}/><span>{label}</span></NavLink>)}
        {admin && <NavLink to="/dashboard" onClick={close}><LayoutDashboard size={16}/><span>{isArabic ? "عرض المنصة" : "Member View"}</span></NavLink>}
        {!admin && creatorAccess && <NavLink className="creator-nav-link-v33" to="/admin/publishing" onClick={close}><PenSquare size={16}/><span>{isArabic ? "إنشاء ونشر" : "Create & Publish"}</span></NavLink>}
        <div className="mobile-nav-actions">
          <div className="mobile-tools-row-v33"><ThemeToggle/><LanguageToggle compact/></div>
          {adminAccess && !admin && <Link className="button secondary full" to="/admin/publishing" onClick={close}><PenSquare size={15}/>{isArabic ? "استوديو النشر" : "Publishing Studio"}</Link>}
          <Link className="button subtle full" to="/profile" onClick={close}><UserRound size={15}/>{isArabic ? "الملف والإعدادات" : "Profile & settings"}</Link>
          <button className="button danger full" type="button" onClick={signOut}><LogOut size={15}/>{t("logout")}</button>
        </div>
      </nav>
      <div className="header-actions dashboard-actions">
        <GlobalSearch compact />
        {creatorAccess && <Link className="header-publish-v33" to="/admin/publishing"><PenSquare size={15}/><span>{isArabic ? "نشر" : "Publish"}</span></Link>}
        <ThemeToggle compact />
        <LanguageToggle compact />
        <Link className="profile-trigger" to="/profile"><span className="profile-avatar"><UserRound size={15}/></span><span><b>{profile?.full_name || profile?.email}</b><small>{roleLabel(profile).toUpperCase()}</small></span><ChevronDown size={13}/></Link>
        <button className="icon-button logout-button" type="button" onClick={signOut} title={t("logout")}><LogOut size={17}/></button>
        <button className="mobile-menu-trigger" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen((current) => !current)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </header>
  );
}
