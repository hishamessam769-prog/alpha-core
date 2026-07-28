import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";

export default function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme } = useTheme();
  const { isArabic } = useLanguage();
  const label = isDark
    ? (isArabic ? "تفعيل الوضع الفاتح" : "Switch to light mode")
    : (isArabic ? "تفعيل الوضع الداكن" : "Switch to dark mode");
  return (
    <button className={`theme-toggle ${compact ? "compact" : ""}`} type="button" onClick={toggleTheme} title={label} aria-label={label}>
      {isDark ? <Sun size={16}/> : <Moon size={16}/>} {!compact && <span>{isDark ? (isArabic ? "فاتح" : "Light") : (isArabic ? "داكن" : "Dark")}</span>}
    </button>
  );
}
