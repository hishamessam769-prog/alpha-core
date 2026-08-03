import { Languages } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function LanguageToggle({ compact = false }) {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === "en" ? "ar" : "en";
  const label = language === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية";
  return (
    <button
      type="button"
      className={`language-toggle ${compact ? "compact" : ""}`}
      data-language={language}
      onClick={() => setLanguage(nextLanguage)}
      aria-label={label}
      title={label}
    >
      <Languages size={15} />
      <span>{language === "en" ? "العربية" : "EN"}</span>
    </button>
  );
}
