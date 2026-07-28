import { useEffect, useMemo, useState } from "react";
import { Building2, ImageUp, Link2, Save, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { defaultPlatformSettings, usePlatformSettings } from "../context/SettingsContext";
import { supabase } from "../lib/supabase";

function normalise(settings) {
  return {
    ...defaultPlatformSettings,
    ...settings,
    pricing_features: Array.isArray(settings?.pricing_features) ? settings.pricing_features : defaultPlatformSettings.pricing_features,
    pricing_features_ar: Array.isArray(settings?.pricing_features_ar) ? settings.pricing_features_ar : defaultPlatformSettings.pricing_features_ar,
    landing_highlights: Array.isArray(settings?.landing_highlights) ? settings.landing_highlights : defaultPlatformSettings.landing_highlights,
  };
}

export default function AdminSettings() {
  const { profile } = useAuth();
  const { isArabic } = useLanguage();
  const { settings, refreshSettings } = usePlatformSettings();
  const [form, setForm] = useState(normalise(settings));
  const [featuresText, setFeaturesText] = useState("");
  const [featuresTextAr, setFeaturesTextAr] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = normalise(settings);
    setForm(next);
    setFeaturesText((next.pricing_features || []).join("\n"));
    setFeaturesTextAr((next.pricing_features_ar || []).join("\n"));
    setPreview(next.logo_url || "");
  }, [settings]);

  const highlights = useMemo(() => {
    const rows = [...(form.landing_highlights || [])];
    while (rows.length < 3) rows.push({ value: "", label_en: "", label_ar: "", detail_en: "", detail_ar: "" });
    return rows.slice(0, 3);
  }, [form.landing_highlights]);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const setHighlight = (index, field, value) => setForm((current) => ({
    ...current,
    landing_highlights: highlights.map((item, currentIndex) => currentIndex === index ? { ...item, [field]: value } : item),
  }));

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMessage(isArabic ? "اختار ملف صورة صالح" : "Choose a valid image file.");
    if (file.size > 3 * 1024 * 1024) return setMessage(isArabic ? "حجم الشعار يجب ألا يتجاوز 3MB" : "Logo size must not exceed 3MB.");
    setLogoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async () => {
    if (!logoFile) return { logo_url: form.logo_url || "", logo_path: form.logo_path || "" };
    const extension = logoFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `logos/alpha-platform-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("platform-assets").upload(path, logoFile, { upsert: true, contentType: logoFile.type });
    if (error) throw error;
    const { data } = supabase.storage.from("platform-assets").getPublicUrl(path);
    return { logo_url: data.publicUrl, logo_path: path };
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(isArabic ? "جاري حفظ إعدادات المنصة…" : "Saving platform settings…");
    try {
      const logo = await uploadLogo();
      const payload = {
        ...form,
        ...logo,
        id: "global",
        pricing_features: featuresText.split("\n").map((item) => item.trim()).filter(Boolean),
        pricing_features_ar: featuresTextAr.split("\n").map((item) => item.trim()).filter(Boolean),
        landing_highlights: highlights,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      };
      delete payload.created_at;
      const { error } = await supabase.from("platform_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      setLogoFile(null);
      await refreshSettings();
      setMessage(isArabic ? "تم تحديث الشعار والفوتر والأسعار فورًا" : "Logo, footer and pricing settings updated successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setPreview("");
    setField("logo_url", "");
    setField("logo_path", "");
  };

  return (
    <div className="dashboard-shell admin-shell-v21">
      <DashboardHeader admin />
      <main className="admin-settings-page-v31">
        <header className="admin-page-hero-v31"><div><span className="eyebrow">PLATFORM SETTINGS</span><h1>{isArabic ? "إدارة الهوية والمحتوى العام" : "Brand and public content management"}</h1><p>{isArabic ? "أي تعديل هنا يظهر تلقائيًا في الهيدر والفوتر وصفحة الأسعار وتقارير PDF." : "Changes made here automatically flow to the header, footer, pricing section and generated PDF reports."}</p></div><Settings2 size={34}/></header>
        {message && <div className="notice-bar">{message}</div>}
        <form className="settings-grid-v31" onSubmit={save}>
          <section className="panel-v21 padded-v21 settings-logo-panel-v31">
            <div className="panel-heading-v21"><div><span className="eyebrow">IDENTITY</span><h2>{isArabic ? "شعار الشركة" : "Company logo"}</h2><p>{isArabic ? "PNG أو JPG أو SVG بحد أقصى 3MB." : "PNG, JPG or SVG up to 3MB."}</p></div><ImageUp size={20}/></div>
            <div className="logo-upload-v31">
              <div className="logo-preview-v31">{preview ? <img src={preview} alt="Company logo preview"/> : <Brand compact/>}</div>
              <label className="button subtle"><ImageUp size={15}/>{isArabic ? "رفع شعار" : "Upload logo"}<input type="file" accept="image/*" onChange={chooseLogo}/></label>
              {(preview || form.logo_url) && <button className="button danger compact" type="button" onClick={removeLogo}><Trash2 size={14}/>{isArabic ? "إزالة" : "Remove"}</button>}
            </div>
            <div className="settings-note-v31"><ShieldCheck size={15}/><span>{isArabic ? "الشعار سيظهر في Header وFooter وتقارير PDF فور الحفظ." : "The saved logo appears in the Header, Footer and PDF reports automatically."}</span></div>
          </section>

          <section className="panel-v21 padded-v21 settings-section-v31">
            <div className="panel-heading-v21"><div><span className="eyebrow">FOOTER & CONTACT</span><h2>{isArabic ? "محتوى الفوتر والتواصل" : "Footer and contact content"}</h2></div><Building2 size={20}/></div>
            <div className="admin-form-grid-v21">
              <label className="wide">Footer intro (English)<textarea rows="3" value={form.footer_intro_en || ""} onChange={(event) => setField("footer_intro_en", event.target.value)}/></label>
              <label className="wide">مقدمة الفوتر بالعربي<textarea rows="3" value={form.footer_intro_ar || ""} onChange={(event) => setField("footer_intro_ar", event.target.value)}/></label>
              <label>Footer trust badge<input value={form.footer_badge_en || ""} onChange={(event) => setField("footer_badge_en", event.target.value)}/></label>
              <label>شارة الثقة بالعربي<input value={form.footer_badge_ar || ""} onChange={(event) => setField("footer_badge_ar", event.target.value)}/></label>
              <label>Contact email<input type="email" value={form.contact_email || ""} onChange={(event) => setField("contact_email", event.target.value)}/></label>
              <label>Contact phone<input value={form.contact_phone || ""} onChange={(event) => setField("contact_phone", event.target.value)}/></label>
              <label>Address (English)<input value={form.contact_address_en || ""} onChange={(event) => setField("contact_address_en", event.target.value)}/></label>
              <label>العنوان بالعربي<input value={form.contact_address_ar || ""} onChange={(event) => setField("contact_address_ar", event.target.value)}/></label>
              <label>LinkedIn URL<input value={form.social_linkedin || ""} onChange={(event) => setField("social_linkedin", event.target.value)}/></label>
              <label>Facebook URL<input value={form.social_facebook || ""} onChange={(event) => setField("social_facebook", event.target.value)}/></label>
              <label>X / Twitter URL<input value={form.social_x || ""} onChange={(event) => setField("social_x", event.target.value)}/></label>
              <label>Privacy URL<input value={form.privacy_url || ""} onChange={(event) => setField("privacy_url", event.target.value)}/></label>
              <label>Terms URL<input value={form.terms_url || ""} onChange={(event) => setField("terms_url", event.target.value)}/></label>
              <label className="wide">Disclaimer (English)<textarea rows="2" value={form.disclaimer_en || ""} onChange={(event) => setField("disclaimer_en", event.target.value)}/></label>
              <label className="wide">التنويه بالعربي<textarea rows="2" value={form.disclaimer_ar || ""} onChange={(event) => setField("disclaimer_ar", event.target.value)}/></label>
              <label className="wide">Custom footer text (English)<textarea rows="2" value={form.footer_custom_text_en || ""} onChange={(event) => setField("footer_custom_text_en", event.target.value)}/></label>
              <label className="wide">نص إضافي بالعربي<textarea rows="2" value={form.footer_custom_text_ar || ""} onChange={(event) => setField("footer_custom_text_ar", event.target.value)}/></label>
              <label className="wide">Copyright (English)<input value={form.footer_copyright_en || ""} onChange={(event) => setField("footer_copyright_en", event.target.value)}/></label>
              <label className="wide">حقوق النشر بالعربي<input value={form.footer_copyright_ar || ""} onChange={(event) => setField("footer_copyright_ar", event.target.value)}/></label>
            </div>
          </section>

          <section className="panel-v21 padded-v21 settings-section-v31">
            <div className="panel-heading-v21"><div><span className="eyebrow">PRICING</span><h2>{isArabic ? "إدارة قسم الأسعار" : "Pricing section management"}</h2></div><Link2 size={20}/></div>
            <div className="admin-form-grid-v21">
              <label>Eyebrow (English)<input value={form.pricing_eyebrow_en || ""} onChange={(event) => setField("pricing_eyebrow_en", event.target.value)}/></label>
              <label>العنوان الصغير بالعربي<input value={form.pricing_eyebrow_ar || ""} onChange={(event) => setField("pricing_eyebrow_ar", event.target.value)}/></label>
              <label>Title (English)<input value={form.pricing_title_en || ""} onChange={(event) => setField("pricing_title_en", event.target.value)}/></label>
              <label>العنوان بالعربي<input value={form.pricing_title_ar || ""} onChange={(event) => setField("pricing_title_ar", event.target.value)}/></label>
              <label className="wide">Description (English)<textarea rows="2" value={form.pricing_description_en || ""} onChange={(event) => setField("pricing_description_en", event.target.value)}/></label>
              <label className="wide">الوصف بالعربي<textarea rows="2" value={form.pricing_description_ar || ""} onChange={(event) => setField("pricing_description_ar", event.target.value)}/></label>
              <label>Plan name (English)<input value={form.pricing_plan_name_en || ""} onChange={(event) => setField("pricing_plan_name_en", event.target.value)}/></label>
              <label>اسم الخطة بالعربي<input value={form.pricing_plan_name_ar || ""} onChange={(event) => setField("pricing_plan_name_ar", event.target.value)}/></label>
              <label className="wide">Plan description (English)<textarea rows="2" value={form.pricing_plan_description_en || ""} onChange={(event) => setField("pricing_plan_description_en", event.target.value)}/></label>
              <label className="wide">وصف الخطة بالعربي<textarea rows="2" value={form.pricing_plan_description_ar || ""} onChange={(event) => setField("pricing_plan_description_ar", event.target.value)}/></label>
              <label>Price<input value={form.pricing_price || ""} onChange={(event) => setField("pricing_price", event.target.value)}/></label>
              <label>Period (English)<input value={form.pricing_period_en || ""} onChange={(event) => setField("pricing_period_en", event.target.value)}/></label>
              <label>الفترة بالعربي<input value={form.pricing_period_ar || ""} onChange={(event) => setField("pricing_period_ar", event.target.value)}/></label>
              <label className="wide">Features (English) — one item per line<textarea rows="5" value={featuresText} onChange={(event) => setFeaturesText(event.target.value)}/></label>
              <label className="wide">المميزات بالعربي — ميزة في كل سطر<textarea rows="5" value={featuresTextAr} onChange={(event) => setFeaturesTextAr(event.target.value)}/></label>
              <label>CTA (English)<input value={form.pricing_cta_en || ""} onChange={(event) => setField("pricing_cta_en", event.target.value)}/></label>
              <label>زر الدعوة بالعربي<input value={form.pricing_cta_ar || ""} onChange={(event) => setField("pricing_cta_ar", event.target.value)}/></label>
            </div>
          </section>

          <section className="panel-v21 padded-v21 settings-section-v31 settings-highlights-v31">
            <div className="panel-heading-v21"><div><span className="eyebrow">PUBLIC HIGHLIGHTS</span><h2>{isArabic ? "إحصائيات صفحة الهبوط" : "Landing-page highlights"}</h2><p>{isArabic ? "تظهر مباشرة للزائر قبل التسجيل." : "Visible to visitors before registration."}</p></div></div>
            <div className="highlight-edit-grid-v31">{highlights.map((item, index) => <article key={index}><b>0{index + 1}</b><label>Value<input value={item.value || ""} onChange={(event) => setHighlight(index, "value", event.target.value)}/></label><label>Label EN<input value={item.label_en || ""} onChange={(event) => setHighlight(index, "label_en", event.target.value)}/></label><label>العنوان AR<input value={item.label_ar || ""} onChange={(event) => setHighlight(index, "label_ar", event.target.value)}/></label><label>Detail EN<input value={item.detail_en || ""} onChange={(event) => setHighlight(index, "detail_en", event.target.value)}/></label><label>التفصيل AR<input value={item.detail_ar || ""} onChange={(event) => setHighlight(index, "detail_ar", event.target.value)}/></label></article>)}</div>
          </section>

          <div className="settings-savebar-v31"><span>{isArabic ? "التعديلات لا تؤثر على الحسابات أو البيانات الاستثمارية." : "These changes do not affect calculations or investment data."}</span><button className="button gold large" disabled={saving}><Save size={16}/>{saving ? (isArabic ? "جاري الحفظ" : "Saving") : (isArabic ? "حفظ كل الإعدادات" : "Save all settings")}</button></div>
        </form>
      </main>
    </div>
  );
}
