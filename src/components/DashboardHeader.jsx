import { Link } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import Brand from "./Brand";
import LanguageToggle from "./LanguageToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function DashboardHeader({ admin = false }) {
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  return (
    <header className="dashboard-header">
      <Brand to={admin ? "/admin" : "/dashboard"} />
      <nav className="dashboard-nav">
        {!admin && <Link to="/methodology">{t("navMethodology")}</Link>}
        {admin && <Link to="/dashboard">{t("viewMember")}</Link>}
        <LanguageToggle compact />
        <Link className="member-name" to="/profile"><Settings size={14}/>{profile?.full_name || profile?.email}</Link>
        <button className="icon-button" type="button" onClick={signOut} title={t("logout")}><LogOut size={17}/></button>
      </nav>
    </header>
  );
}
