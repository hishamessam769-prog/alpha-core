import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { session, profile, isAdmin } = useAuth();

  if (session === undefined || (session && profile === null)) {
    return <div className="screen-loader">Loading secure access…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
