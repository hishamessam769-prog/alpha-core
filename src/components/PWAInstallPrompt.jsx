import { useEffect, useMemo, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

const DISMISS_KEY = "alpha-pwa-install-dismissed-at";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export default function PWAInstallPrompt() {
  const { isArabic } = useLanguage();
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const standalone = useMemo(() => window.matchMedia?.("(display-mode: standalone)").matches || Boolean(window.navigator.standalone), []);
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  useEffect(() => {
    if (standalone) return undefined;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < THIRTY_DAYS) return undefined;

    const beforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      window.setTimeout(() => setVisible(true), 2600);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);

    let iosTimer;
    if (isIOS) iosTimer = window.setTimeout(() => setVisible(true), 5200);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.clearTimeout(iosTimer);
    };
  }, [isIOS, standalone]);

  if (!visible || standalone) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
  };

  return (
    <aside className="pwa-install-prompt" role="dialog" aria-label={isArabic ? "تثبيت تطبيق ألفا" : "Install ALPHA app"}>
      <button className="pwa-install-close" type="button" onClick={dismiss} aria-label={isArabic ? "إغلاق" : "Close"}><X size={18}/></button>
      <img src="/icons/icon-192.png" alt=""/>
      <div>
        <strong>{isArabic ? "ثبّت ALPHA على هاتفك" : "Install ALPHA on your phone"}</strong>
        <p>{isIOS ? (isArabic ? "اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية." : "Tap Share, then Add to Home Screen.") : (isArabic ? "وصول أسرع وتجربة كاملة بدون واجهة المتصفح." : "Faster access with a full-screen, app-like experience.")}</p>
      </div>
      {installEvent ? <button className="pwa-install-action" type="button" onClick={install}><Download size={17}/>{isArabic ? "تثبيت" : "Install"}</button> : <span className="pwa-ios-hint"><Share2 size={17}/>{isArabic ? "مشاركة" : "Share"}</span>}
    </aside>
  );
}
