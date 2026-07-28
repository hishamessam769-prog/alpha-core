import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export const defaultPlatformSettings = {
  id: "global",
  logo_url: "",
  logo_path: "",
  footer_intro_en: "Independent investment intelligence designed to present performance and decisions with institutional transparency.",
  footer_intro_ar: "منصة بيانات وأبحاث استثمارية مستقلة مصممة لعرض الأداء والقرارات بشفافية مؤسسية.",
  footer_badge_en: "Auditable published data",
  footer_badge_ar: "بيانات منشورة قابلة للمراجعة",
  footer_copyright_en: "© 2026 ALPHA PLATFORM. All rights reserved.",
  footer_copyright_ar: "© 2026 ALPHA PLATFORM. جميع الحقوق محفوظة.",
  privacy_url: "#privacy",
  terms_url: "#terms",
  contact_email: "hello@alphacore.app",
  contact_phone: "",
  contact_address_en: "Cairo, Egypt",
  contact_address_ar: "القاهرة، مصر",
  disclaimer_en: "Past performance does not guarantee future results.",
  disclaimer_ar: "الأداء السابق لا يضمن النتائج المستقبلية.",
  footer_custom_text_en: "Educational information only — not personalised investment advice.",
  footer_custom_text_ar: "المحتوى تعليمي ومعلوماتي عام وليس نصيحة استثمارية شخصية.",
  pricing_eyebrow_en: "SIMPLE ACCESS",
  pricing_eyebrow_ar: "وصول بسيط وواضح",
  pricing_title_en: "Start with complete access, free",
  pricing_title_ar: "ابدأ بالوصول الكامل مجانًا",
  pricing_description_en: "Explore performance, recommendations and reports before any future paid plans.",
  pricing_description_ar: "استكشف الأداء والتوصيات والتقارير قبل أي خطط مدفوعة مستقبلية.",
  pricing_plan_name_en: "Platform membership",
  pricing_plan_name_ar: "عضوية المنصة",
  pricing_plan_description_en: "Every current platform experience in one account.",
  pricing_plan_description_ar: "كل أدوات المنصة الحالية في حساب واحد.",
  pricing_price: "£0",
  pricing_period_en: "currently",
  pricing_period_ar: "حاليًا",
  pricing_cta_en: "Create free account",
  pricing_cta_ar: "إنشاء حساب",
  pricing_features: ["Portfolio factsheets", "Independent recommendations", "Weekly reports", "AI-ready summaries"],
  pricing_features_ar: ["تقارير المحافظ", "التوصيات المستقلة", "التقارير الأسبوعية", "ملخصات جاهزة للذكاء الاصطناعي"],
  social_linkedin: "",
  social_facebook: "",
  social_x: "",
  landing_highlights: [
    { value: "+5.00%", label_en: "Portfolio MTD", label_ar: "عائد المحفظة الشهري", detail_en: "Latest published portfolio snapshot", detail_ar: "أحدث لقطة أداء منشورة" },
    { value: "+1.90%", label_en: "Alpha MTD", label_ar: "الألفا الشهرية", detail_en: "Return above the selected benchmark", detail_ar: "العائد فوق المؤشر المرجعي" },
    { value: "100%", label_en: "Transparent record", label_ar: "سجل شفاف", detail_en: "Published decisions remain on record", detail_ar: "كل القرارات المنشورة تظل محفوظة" },
  ],
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultPlatformSettings);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    if (!supabase) {
      setLoading(false);
      return defaultPlatformSettings;
    }
    const { data, error } = await supabase.from("platform_settings").select("*").eq("id", "global").maybeSingle();
    if (!error && data) {
      const merged = { ...defaultPlatformSettings, ...data };
      setSettings(merged);
      setLoading(false);
      return merged;
    }
    setLoading(false);
    return defaultPlatformSettings;
  };

  useEffect(() => {
    refreshSettings();
    if (!supabase) return undefined;
    const channel = supabase
      .channel("alpha-platform-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings" }, refreshSettings)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const value = useMemo(() => ({ settings, loading, refreshSettings, setSettings }), [settings, loading]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function usePlatformSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("usePlatformSettings must be used inside SettingsProvider");
  return context;
}
