import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { session, profile, loading, profileLoaded } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (loading || (session && !profileLoaded)) {
    return <div className="screen-loader"><div className="loader-ring"/><p>{t("loading")}</p></div>;
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !profile?.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}
