import { Link } from "react-router-dom";
import { FileSpreadsheet, FlaskConical, LayoutDashboard, LogOut, Settings, ShieldCheck } from "lucide-react";
import Brand from "./Brand";
import LanguageToggle from "./LanguageToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function DashboardHeader({ admin = false }) {
  const { profile, signOut } = useAuth();
  const { t, isArabic } = useLanguage();

  return (
    <header className="dashboard-header">
      <Brand to={admin ? "/admin" : "/dashboard"} />
      <nav className="dashboard-nav">
        {!admin && <Link to="/dashboard"><LayoutDashboard size={14}/>{t("navDashboard")}</Link>}
        {!admin && <Link to="/research"><FlaskConical size={14}/>{isArabic ? "الأبحاث" : "Research"}</Link>}
        {!admin && <Link to="/methodology">{t("navMethodology")}</Link>}

        {admin && <Link to="/admin"><ShieldCheck size={14}/>{isArabic ? "المحافظ" : "Portfolios"}</Link>}
        {admin && <Link to="/admin/recommendations"><FlaskConical size={14}/>{isArabic ? "التوصيات" : "Recommendations"}</Link>}
        {admin && <Link to="/admin/prices"><FileSpreadsheet size={14}/>{isArabic ? "تحديث الأسعار" : "Price import"}</Link>}
        {admin && <Link to="/dashboard">{t("viewMember")}</Link>}

        <LanguageToggle compact />
        <Link className="member-name" to="/profile"><Settings size={14}/>{profile?.full_name || profile?.email}</Link>
        <button className="icon-button" type="button" onClick={signOut} title={t("logout")}><LogOut size={17}/></button>
      </nav>
    </header>
  );
}
