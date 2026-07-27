import { Navigate, Route, Routes, useParams } from "react-router-dom";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import MemberDashboard from "./pages/MemberDashboard";
import Methodology from "./pages/Methodology";
import AdminDashboard from "./pages/AdminDashboard";
import RecommendationAdmin from "./pages/RecommendationAdmin";
import PriceImportAdmin from "./pages/PriceImportAdmin";
import IdeasHub from "./pages/IdeasHub";
import IdeaDetail from "./pages/IdeaDetail";
import WeeklyReports from "./pages/WeeklyReports";
import WeeklyReportDetail from "./pages/WeeklyReportDetail";
import WeeklyReportsAdmin from "./pages/WeeklyReportsAdmin";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/methodology" element={<Methodology />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><MemberDashboard /></ProtectedRoute>} />
      <Route path="/recommendations" element={<ProtectedRoute><IdeasHub /></ProtectedRoute>} />
      <Route path="/recommendations/:id" element={<ProtectedRoute><IdeaDetail /></ProtectedRoute>} />
      <Route path="/ideas" element={<Navigate to="/recommendations" replace />} />
      <Route path="/ideas/:id" element={<RecommendationRedirect />} />
      <Route path="/research" element={<Navigate to="/recommendations" replace />} />
      <Route path="/research/:id" element={<RecommendationRedirect />} />
      <Route path="/weekly-reports" element={<ProtectedRoute><WeeklyReports /></ProtectedRoute>} />
      <Route path="/weekly-reports/:slug" element={<ProtectedRoute><WeeklyReportDetail /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/recommendations" element={<ProtectedRoute adminOnly><RecommendationAdmin /></ProtectedRoute>} />
      <Route path="/admin/weekly-reports" element={<ProtectedRoute adminOnly><WeeklyReportsAdmin /></ProtectedRoute>} />
      <Route path="/admin/prices" element={<ProtectedRoute adminOnly><PriceImportAdmin /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RecommendationRedirect() {
  const { id } = useParams();
  return <Navigate to={`/recommendations/${id}`} replace />;
}
