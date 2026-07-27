import { Link, NavLink } from "react-router-dom";
import Brand from "./Brand";
import LanguageToggle from "./LanguageToggle";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function PublicHeader() {
  const { session, profile } = useAuth();
  const { t, isArabic } = useLanguage();
  const destination = profile?.is_admin ? "/admin" : "/dashboard";

  return (
    <header className="public-header">
      <Brand />
      <nav className="public-nav">
        <NavLink to="/" end>{t("navHome")}</NavLink>
        <NavLink to="/methodology">{t("navMethodology")}</NavLink>
        {session && <NavLink to="/research">{isArabic ? "الأبحاث" : "Research"}</NavLink>}
      </nav>
      <div className="header-actions">
        <LanguageToggle compact />
        {session ? (
          <Link className="button gold" to={destination}>{profile?.is_admin ? t("admin") : t("navDashboard")}</Link>
        ) : (
          <>
            <Link className="button subtle desktop-action" to="/login">{t("login")}</Link>
            <Link className="button gold" to="/signup">{t("signup")}</Link>
          </>
        )}
      </div>
    </header>
  );
}
