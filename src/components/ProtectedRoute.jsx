import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { canAccessAdmin, hasAnyPermission, hasPermission } from "../lib/access";

export default function ProtectedRoute({ children, adminOnly = false, superAdminOnly = false, permission = null, anyPermission = null }) {
  const { session, profile, loading, profileLoaded } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (loading || (session && !profileLoaded)) {
    return <div className="screen-loader"><div className="loader-ring"/><p>{t("loading")}</p></div>;
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (superAdminOnly && !profile?.is_super_admin) return <Navigate to="/dashboard" replace />;
  if (adminOnly && !canAccessAdmin(profile)) return <Navigate to="/dashboard" replace />;
  if (permission && !hasPermission(profile, permission)) return <Navigate to={canAccessAdmin(profile) ? "/admin/publishing" : "/dashboard"} replace />;
  if (anyPermission?.length && !hasAnyPermission(profile, anyPermission)) return <Navigate to={canAccessAdmin(profile) ? "/admin/publishing" : "/dashboard"} replace />;
  return children;
}
