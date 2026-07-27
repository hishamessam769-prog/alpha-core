import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import MemberDashboard from "./pages/MemberDashboard";
import Methodology from "./pages/Methodology";
import AdminDashboard from "./pages/AdminDashboard";
import RecommendationAdmin from "./pages/RecommendationAdmin";
import PriceImportAdmin from "./pages/PriceImportAdmin";
import ResearchHub from "./pages/ResearchHub";
import ResearchDetail from "./pages/ResearchDetail";
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
      <Route path="/research" element={<ProtectedRoute><ResearchHub /></ProtectedRoute>} />
      <Route path="/research/:id" element={<ProtectedRoute><ResearchDetail /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/recommendations" element={<ProtectedRoute adminOnly><RecommendationAdmin /></ProtectedRoute>} />
      <Route path="/admin/prices" element={<ProtectedRoute adminOnly><PriceImportAdmin /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
