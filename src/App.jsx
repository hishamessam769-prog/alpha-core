import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import MemberDashboard from "./pages/MemberDashboard";
import HomePortal from "./pages/HomePortal";
import Methodology from "./pages/Methodology";
import AdminDashboard from "./pages/AdminDashboard";
import RecommendationAdmin from "./pages/RecommendationAdmin";
import PriceImportAdmin from "./pages/PriceImportAdmin";
import IdeasHub from "./pages/IdeasHub";
import IdeaDetail from "./pages/IdeaDetail";
import WeeklyReports from "./pages/WeeklyReports";
import WeeklyReportDetail from "./pages/WeeklyReportDetail";
import WeeklyReportsAdmin from "./pages/WeeklyReportsAdmin";
import AdminSettings from "./pages/AdminSettings";
import AdminSupport from "./pages/AdminSupport";
import Profile from "./pages/Profile";
import PortfoliosIndex from "./pages/PortfoliosIndex";
import NewsAnalysis from "./pages/NewsAnalysis";
import NewsArticle from "./pages/NewsArticle";
import AnalystProfile from "./pages/AnalystProfile";
import AdminTeam from "./pages/AdminTeam";
import PublishingStudio from "./pages/PublishingStudio";
import AdminNotifications from "./pages/AdminNotifications";
import AdminAnalytics from "./pages/AdminAnalytics";
import NotificationInbox from "./pages/NotificationInbox";
import RoboAdvisor from "./pages/RoboAdvisor";
import MyJournal from "./pages/MyJournal";
import VirtualPortfolios from "./pages/VirtualPortfolios";
import ProtectedRoute from "./components/ProtectedRoute";
import SupportWidget from "./components/SupportWidget";
import SmartSurvey from "./components/SmartSurvey";
import MobileBottomNav from "./components/MobileBottomNav";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import PushNotificationPrompt from "./components/PushNotificationPrompt";
import { useAuth } from "./context/AuthContext";
import { supabase } from "./lib/supabase";

export default function App() {
  const { session, profile } = useAuth();
  const showMemberExperience = Boolean(session && profile && !profile.is_admin);

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/methodology" element={<Methodology />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><HomePortal /></ProtectedRoute>} />
        <Route path="/portfolios" element={<ProtectedRoute><PortfoliosIndex /></ProtectedRoute>} />
        <Route path="/portfolio/:slug" element={<ProtectedRoute><MemberDashboard /></ProtectedRoute>} />
        <Route path="/recommendations" element={<ProtectedRoute><IdeasHub /></ProtectedRoute>} />
        <Route path="/recommendations/:id" element={<ProtectedRoute><IdeaDetail /></ProtectedRoute>} />
        <Route path="/ideas" element={<Navigate to="/recommendations" replace />} />
        <Route path="/ideas/:id" element={<RecommendationRedirect />} />
        <Route path="/research" element={<Navigate to="/recommendations" replace />} />
        <Route path="/research/:id" element={<RecommendationRedirect />} />
        <Route path="/weekly-reports" element={<ProtectedRoute><WeeklyReports /></ProtectedRoute>} />
        <Route path="/weekly-reports/:slug" element={<ProtectedRoute><WeeklyReportDetail /></ProtectedRoute>} />
        <Route path="/news" element={<ProtectedRoute><NewsAnalysis /></ProtectedRoute>} />
        <Route path="/news/:kind/:id" element={<ProtectedRoute><NewsArticle /></ProtectedRoute>} />
        <Route path="/analysts/:id" element={<ProtectedRoute><AnalystProfile /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationInbox /></ProtectedRoute>} />
        <Route path="/advisor" element={<ProtectedRoute><RoboAdvisor /></ProtectedRoute>} />
        <Route path="/robo-advisor" element={<Navigate to="/advisor" replace />} />
        <Route path="/my-journal" element={<ProtectedRoute><MyJournal /></ProtectedRoute>} />
        <Route path="/tracker" element={<Navigate to="/my-journal" replace />} />
        <Route path="/my-portfolios" element={<ProtectedRoute><VirtualPortfolios /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly permission="manage_portfolios"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/recommendations" element={<ProtectedRoute adminOnly permission="manage_recommendations"><RecommendationAdmin /></ProtectedRoute>} />
        <Route path="/admin/weekly-reports" element={<ProtectedRoute adminOnly permission="manage_reports"><WeeklyReportsAdmin /></ProtectedRoute>} />
        <Route path="/admin/prices" element={<ProtectedRoute adminOnly anyPermission={["manage_portfolios", "manage_recommendations"]}><PriceImportAdmin /></ProtectedRoute>} />
        <Route path="/admin/assets" element={<ProtectedRoute superAdminOnly><PriceImportAdmin /></ProtectedRoute>} />
        <Route path="/admin/support" element={<ProtectedRoute adminOnly permission="support_inbox"><AdminSupport /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute adminOnly permission="manage_settings"><AdminSettings /></ProtectedRoute>} />
        <Route path="/admin/team" element={<ProtectedRoute superAdminOnly><AdminTeam /></ProtectedRoute>} />
        <Route path="/admin/publishing" element={<ProtectedRoute adminOnly anyPermission={["publish_articles", "manage_reports", "manage_recommendations", "manage_portfolios"]}><PublishingStudio /></ProtectedRoute>} />
        <Route path="/admin/notifications" element={<ProtectedRoute superAdminOnly><AdminNotifications /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute superAdminOnly><AdminAnalytics /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showMemberExperience && <><SupportWidget/><SmartSurvey/></>}
      <MobileBottomNav/>
      {session && <><PushNotificationPrompt/><AnalyticsSessionTracker/></>}
      <PWAInstallPrompt/>
    </>
  );
}

function RecommendationRedirect() {
  const { id } = useParams();
  return <Navigate to={`/recommendations/${id}`} replace />;
}


function AnalyticsSessionTracker() {
  const { session } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!session?.user?.id || !supabase) return undefined;

    const storageKey = `alpha-analytics-session-${session.user.id}`;
    let sessionToken = window.sessionStorage.getItem(storageKey);
    if (!sessionToken) {
      sessionToken = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(storageKey, sessionToken);
    }

    const deviceType = window.matchMedia?.("(max-width: 767px)").matches ? "mobile" : "desktop";
    let lastTouch = 0;
    let stopped = false;

    const touch = async (force = false) => {
      const now = Date.now();
      if (stopped || (!force && now - lastTouch < 30000)) return;
      lastTouch = now;
      try {
        await supabase.rpc("touch_app_session", {
          p_session_token: sessionToken,
          p_path: window.location.pathname,
          p_device_type: deviceType,
          p_user_agent: window.navigator.userAgent,
        });
      } catch {
        // Analytics is deliberately non-blocking. The app stays fully usable
        // even before the additive V3.8 SQL migration is installed.
      }
    };

    touch(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") touch();
    }, 60000);
    const onActivity = () => touch();
    const onVisibility = () => touch(true);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session?.user?.id, location.pathname]);

  return null;
}
