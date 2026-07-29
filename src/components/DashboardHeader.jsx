import { useState } from "react";
import { BarChart3, BookOpen, FileSpreadsheet, Headphones, LayoutDashboard, Lightbulb, LogOut, Menu, MoreHorizontal, Newspaper, PenSquare, Settings, UserRound, UsersRound, WalletCards, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import Brand from "./Brand";
import GlobalSearch from "./GlobalSearch";
import HeaderMenu from "./HeaderMenu";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { canAccessAdmin, canAccessCreatorStudio, hasAnyPermission, hasPermission, roleLabel, workspaceRoute } from "../lib/access";

function HeaderLink({ to, label, icon: Icon, onClick, end = false }) {
  return <NavLink to={to} end={end} onClick={onClick}>{Icon && <Icon size={15}/>}<span>{label}</span></NavLink>;
}

export default function DashboardHeader({ admin = false }) {
  const { profile, signOut } = useAuth();
  const { t, isArabic } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const creatorAccess = canAccessCreatorStudio(profile);
  const adminAccess = canAccessAdmin(profile);

  const exploreLinks = [
    { to: "/news", label: isArabic ? "الأخبار والتحليل" : "News & Analysis", icon: Newspaper },
    { to: "/weekly-reports", label: isArabic ? "تقارير الأبحاث" : "Research Reports", icon: BookOpen },
    { to: "/methodology", label: isArabic ? "المنهجية" : "Methodology", icon: BarChart3 },
  ];

  const managementLinks = [
    { to: "/admin/recommendations", label: isArabic ? "إدارة التوصيات" : "Manage recommendations", icon: Lightbulb, show: hasPermission(profile, "manage_recommendations") },
    { to: "/admin/weekly-reports", label: isArabic ? "إدارة التقارير" : "Manage research reports", icon: BookOpen, show: hasPermission(profile, "manage_reports") },
    { to: "/admin/prices", label: isArabic ? "تحديث الأسعار" : "Price data", icon: FileSpreadsheet, show: hasAnyPermission(profile, ["manage_portfolios", "manage_recommendations"]) },
    { to: "/admin/support", label: isArabic ? "صندوق الدعم" : "Support inbox", icon: Headphones, show: hasPermission(profile, "support_inbox") },
    { to: "/admin/team", label: isArabic ? "الفريق والصلاحيات" : "Team & access", icon: UsersRound, show: profile?.is_super_admin },
    { to: "/admin/settings", label: isArabic ? "إعدادات المنصة" : "Platform settings", icon: Settings, show: hasPermission(profile, "manage_settings") },
  ].filter((item) => item.show);

  return (
    <header className="dashboard-header platform-header v34-header">
      <Brand to={admin ? workspaceRoute(profile) : "/dashboard"} />

      <nav className={`dashboard-nav platform-nav v34-nav ${menuOpen ? "open" : ""}`} aria-label={admin ? "Administration" : "Platform"}>
        {admin ? <>
          <HeaderLink to="/admin" label={isArabic ? "المحافظ" : "Portfolios"} icon={WalletCards} onClick={close} end />
          {creatorAccess && <HeaderLink to="/admin/publishing" label={isArabic ? "النشر" : "Publishing"} icon={PenSquare} onClick={close}/>} 
          <HeaderMenu label={isArabic ? "الإدارة" : "Manage"} icon={MoreHorizontal}>
            {managementLinks.map((item) => <HeaderLink key={item.to} {...item} onClick={close}/>)}
          </HeaderMenu>
          <HeaderLink to="/dashboard" label={isArabic ? "عرض المنصة" : "Member view"} icon={LayoutDashboard} onClick={close}/>
        </> : <>
          <HeaderLink to="/dashboard" label={isArabic ? "الرئيسية" : "Dashboard"} icon={LayoutDashboard} onClick={close} end/>
          <HeaderLink to="/portfolios" label={isArabic ? "المحافظ" : "Portfolios"} icon={WalletCards} onClick={close}/>
          <HeaderLink to="/recommendations" label={isArabic ? "توصيات الأسهم" : "Recommendations"} icon={Lightbulb} onClick={close}/>
          <HeaderMenu label={isArabic ? "استكشف" : "Explore"} icon={MoreHorizontal}>
            {exploreLinks.map((item) => <HeaderLink key={item.to} {...item} onClick={close}/>)}
          </HeaderMenu>
        </>}

        <div className="mobile-nav-actions">
          <div className="mobile-tools-row-v34"><ThemeToggle/><LanguageToggle compact/></div>
          {!admin && creatorAccess && <Link className="button primary full" to="/admin/publishing" onClick={close}><PenSquare size={15}/>{isArabic ? "إنشاء ونشر" : "Create & publish"}</Link>}
          {adminAccess && !admin && <Link className="button subtle full" to={workspaceRoute(profile)} onClick={close}><Settings size={15}/>{isArabic ? "مساحة الإدارة" : "Admin workspace"}</Link>}
          <Link className="button subtle full" to="/profile" onClick={close}><UserRound size={15}/>{isArabic ? "الملف الشخصي" : "Profile"}</Link>
          <button className="button danger full" type="button" onClick={signOut}><LogOut size={15}/>{t("logout")}</button>
        </div>
      </nav>

      <div className="header-actions dashboard-actions v34-header-actions">
        <GlobalSearch compact />
        <ThemeToggle compact />
        <HeaderMenu label={profile?.full_name || profile?.email || (isArabic ? "حسابي" : "Account")} icon={UserRound} align="end" className="account-menu-v34">
          <div className="account-summary-v34"><span className="profile-avatar"><UserRound size={15}/></span><div><b>{profile?.full_name || profile?.email}</b><small>{roleLabel(profile).toUpperCase()}</small></div></div>
          <Link to="/profile"><UserRound size={15}/>{isArabic ? "الملف والإعدادات" : "Profile & settings"}</Link>
          {creatorAccess && <Link to="/admin/publishing"><PenSquare size={15}/>{isArabic ? "استوديو النشر" : "Publishing studio"}</Link>}
          {adminAccess && !admin && <Link to={workspaceRoute(profile)}><Settings size={15}/>{isArabic ? "مساحة الإدارة" : "Admin workspace"}</Link>}
          {admin && <Link to="/dashboard"><LayoutDashboard size={15}/>{isArabic ? "عرض المنصة" : "Member view"}</Link>}
          <div className="account-tools-v34"><LanguageToggle compact/></div>
          <button type="button" onClick={signOut}><LogOut size={15}/>{t("logout")}</button>
        </HeaderMenu>
        <button className="mobile-menu-trigger" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen((current) => !current)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </header>
  );
}
