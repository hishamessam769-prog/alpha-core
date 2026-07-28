import { useEffect, useState } from "react";
import { Check, Copy, Sparkles, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function InsightDrawer({ label, title, summary, eyebrow = "ALPHA AI BRIEF", children }) {
  const { isArabic } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const copy = async () => {
    await navigator.clipboard.writeText(summary || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      <button className="button ai-button" type="button" onClick={() => setOpen(true)}><Sparkles size={15}/>{label || (isArabic ? "اشرح بالذكاء الاصطناعي" : "Explain with AI")}</button>
      {open && <div className="insight-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <aside className="insight-drawer" role="dialog" aria-modal="true">
          <header><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button type="button" onClick={() => setOpen(false)}><X size={18}/></button></header>
          <div className="insight-orb"><Sparkles size={22}/><span>{isArabic ? "ملخص ذكي مبني على البيانات المنشورة حاليًا" : "A concise brief generated from the currently published data"}</span></div>
          <div className="insight-copy"><p>{summary}</p>{children}</div>
          <footer><button className="button subtle full" type="button" onClick={copy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? (isArabic ? "تم النسخ" : "Copied") : (isArabic ? "نسخ الملخص" : "Copy summary")}</button><small>{isArabic ? "للاستخدام التعليمي فقط ولا يمثل نصيحة استثمارية شخصية" : "For educational use only. Not personalised investment advice."}</small></footer>
        </aside>
      </div>}
    </>
  );
}
