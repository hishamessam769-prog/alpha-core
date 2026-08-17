import { Bell, Headphones, Home, Lightbulb, LogIn, Newspaper, PenSquare, Settings, UserRound, WalletCards } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { canAccessAdmin, canAccessCreatorStudio, hasAnyPermission, hasPermission, workspaceRoute } from "../lib/access";

function Item({ to, label, icon: Icon, end = false }) {
  return (
    <NavLink to={to} end={end} aria-label={label}>
      <span className="mobile-bottom-icon"><Icon size={22} strokeWidth={1.9}/></span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function MobileBottomNav() {
  const { session, profile } = useAuth();
  const { isArabic } = useLanguage();
  const location = useLocation();
  if (["/login", "/signup"].includes(location.pathname)) return null;

  const isAdminArea = location.pathname.startsWith("/admin");
  const creator = canAccessCreatorStudio(profile);
  const admin = canAccessAdmin(profile);

  let items;
  if (session && isAdminArea && admin) {
    items = [
      { to: workspaceRoute(profile), label: isArabic ? "الإدارة" : "Admin", icon: Settings, end: true },
      { to: creator ? "/admin/publishing" : "/dashboard", label: isArabic ? "النشر" : "Publish", icon: PenSquare },
      { to: profile?.is_super_admin ? "/admin/assets" : (hasAnyPermission(profile, ["manage_portfolios", "manage_recommendations"]) ? "/admin/prices" : "/portfolios"), label: isArabic ? "الأسعار" : "Prices", icon: WalletCards },
      { to: hasPermission(profile, "support_inbox") ? "/admin/support" : "/news", label: isArabic ? "الدعم" : "Support", icon: Headphones },
      { to: "/profile", label: isArabic ? "حسابي" : "Profile", icon: UserRound },
    ];
  } else if (session) {
    items = [
      { to: "/dashboard", label: isArabic ? "الرئيسية" : "Home", icon: Home, end: true },
      { to: "/portfolios", label: isArabic ? "المحافظ" : "Portfolios", icon: WalletCards },
      { to: "/recommendations", label: isArabic ? "التوصيات" : "Calls", icon: Lightbulb },
      { to: "/news", label: isArabic ? "المحتوى" : "News", icon: Newspaper },
      { to: "/notifications", label: isArabic ? "التنبيهات" : "Alerts", icon: Bell },
    ];
  } else {
    items = [
      { to: "/", label: isArabic ? "الرئيسية" : "Home", icon: Home, end: true },
      { to: "/portfolios", label: isArabic ? "المحافظ" : "Portfolios", icon: WalletCards },
      { to: "/recommendations", label: isArabic ? "التوصيات" : "Calls", icon: Lightbulb },
      { to: "/news", label: isArabic ? "المحتوى" : "News", icon: Newspaper },
      { to: "/login", label: isArabic ? "دخول" : "Login", icon: LogIn },
    ];
  }

  return <nav className="mobile-bottom-nav" aria-label={isArabic ? "التنقل الرئيسي" : "Primary mobile navigation"}>{items.map((item) => <Item key={`${item.to}-${item.label}`} {...item}/>)}</nav>;
}
