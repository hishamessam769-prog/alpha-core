import { Languages } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function LanguageToggle({ compact = false }) {
  const { language, setLanguage } = useLanguage();
  return (
    <button
      type="button"
      className={`language-toggle ${compact ? "compact" : ""}`}
      onClick={() => setLanguage(language === "en" ? "ar" : "en")}
      aria-label="Change language"
    >
      <Languages size={15} />
      <span>{language === "en" ? "العربية" : "EN"}</span>
    </button>
  );
}
