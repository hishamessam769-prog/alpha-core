import { Linkedin, Mail, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand";
import { useLanguage } from "../context/LanguageContext";

export default function PlatformFooter() {
  const { isArabic } = useLanguage();
  return (
    <footer className="platform-footer" id="about">
      <div className="footer-main">
        <div className="footer-intro"><Brand compact/><p>{isArabic ? "منصة بيانات وأبحاث استثمارية مستقلة مصممة لعرض الأداء والقرارات بشفافية مؤسسية." : "Independent investment intelligence designed to present performance and decisions with institutional transparency."}</p><span><ShieldCheck size={14}/>{isArabic ? "بيانات منشورة قابلة للمراجعة" : "Auditable published data"}</span></div>
        <div><b>{isArabic ? "المنصة" : "Platform"}</b><Link to="/dashboard">{isArabic ? "المحافظ" : "Portfolios"}</Link><Link to="/recommendations">{isArabic ? "التوصيات" : "Recommendations"}</Link><Link to="/weekly-reports">{isArabic ? "التقارير الأسبوعية" : "Weekly reports"}</Link></div>
        <div><b>{isArabic ? "المعرفة" : "Intelligence"}</b><Link to="/methodology">{isArabic ? "المنهجية" : "Methodology"}</Link><Link to="/recommendations">{isArabic ? "الأبحاث" : "Research"}</Link><a href="/#pricing">{isArabic ? "الأسعار" : "Pricing"}</a></div>
        <div><b>{isArabic ? "الشركة" : "Company"}</b><a href="mailto:hello@alphacore.app"><Mail size={13}/> Contact</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#linkedin"><Linkedin size={13}/> LinkedIn</a></div>
      </div>
      <div className="footer-bottom"><span>© 2026 ALPHA PLATFORM. {isArabic ? "جميع الحقوق محفوظة" : "All rights reserved"}.</span><span>{isArabic ? "الأداء السابق لا يضمن النتائج المستقبلية" : "Past performance does not guarantee future results"}.</span></div>
    </footer>
  );
}
