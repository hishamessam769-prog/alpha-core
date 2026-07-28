import { Facebook, Linkedin, Mail, MapPin, Phone, ShieldCheck, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand";
import { useLanguage } from "../context/LanguageContext";
import { usePlatformSettings } from "../context/SettingsContext";

export default function PlatformFooter() {
  const { isArabic } = useLanguage();
  const { settings } = usePlatformSettings();
  const intro = isArabic ? settings.footer_intro_ar : settings.footer_intro_en;
  const badge = isArabic ? settings.footer_badge_ar : settings.footer_badge_en;
  const address = isArabic ? settings.contact_address_ar : settings.contact_address_en;
  const disclaimer = isArabic ? settings.disclaimer_ar : settings.disclaimer_en;
  const custom = isArabic ? settings.footer_custom_text_ar : settings.footer_custom_text_en;
  const copyright = isArabic ? settings.footer_copyright_ar : settings.footer_copyright_en;
  return (
    <footer className="platform-footer" id="about">
      <div className="footer-main">
        <div className="footer-intro"><Brand compact/><p>{intro}</p><span><ShieldCheck size={14}/>{badge}</span>{custom && <small>{custom}</small>}</div>
        <div><b>{isArabic ? "المنصة" : "Platform"}</b><Link to="/dashboard">{isArabic ? "المحافظ" : "Portfolios"}</Link><Link to="/recommendations">{isArabic ? "التوصيات" : "Recommendations"}</Link><Link to="/weekly-reports">{isArabic ? "التقارير الأسبوعية" : "Weekly reports"}</Link></div>
        <div><b>{isArabic ? "المعرفة" : "Intelligence"}</b><Link to="/methodology">{isArabic ? "المنهجية" : "Methodology"}</Link><Link to="/recommendations">{isArabic ? "الأبحاث" : "Research"}</Link><a href="/#pricing">{isArabic ? "الأسعار" : "Pricing"}</a></div>
        <div><b>{isArabic ? "تواصل معنا" : "Contact"}</b>{settings.contact_email && <a href={`mailto:${settings.contact_email}`}><Mail size={13}/>{settings.contact_email}</a>}{settings.contact_phone && <a href={`tel:${settings.contact_phone}`}><Phone size={13}/>{settings.contact_phone}</a>}{address && <span><MapPin size={13}/>{address}</span>}{settings.social_linkedin && <a href={settings.social_linkedin} target="_blank" rel="noreferrer"><Linkedin size={13}/>LinkedIn</a>}{settings.social_facebook && <a href={settings.social_facebook} target="_blank" rel="noreferrer"><Facebook size={13}/>Facebook</a>}{settings.social_x && <a href={settings.social_x} target="_blank" rel="noreferrer"><Twitter size={13}/>X</a>}<a href={settings.privacy_url || "#privacy"}>Privacy</a><a href={settings.terms_url || "#terms"}>Terms</a></div>
      </div>
      <div className="footer-bottom"><span>{copyright}</span><span>{disclaimer}</span></div>
    </footer>
  );
}
