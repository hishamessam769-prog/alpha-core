import { Bell, BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  getCurrentPushSubscription,
  isPushConfigured,
  isWebPushSupported,
  PUSH_DISMISS_KEY,
  subscribeUserToPush,
} from "../lib/pushNotifications";

const DISMISS_FOR_MS = 3 * 24 * 60 * 60 * 1000;

export default function PushNotificationPrompt() {
  const { user } = useAuth();
  const { isArabic } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || !isWebPushSupported() || !isPushConfigured() || Notification.permission === "denied") return;
    let active = true;
    const check = async () => {
      const existing = await getCurrentPushSubscription();
      if (!active || existing) return;
      const dismissedAt = Number(window.localStorage.getItem(PUSH_DISMISS_KEY) || 0);
      if (Date.now() - dismissedAt < DISMISS_FOR_MS) return;
      window.setTimeout(() => active && setVisible(true), 1800);
    };
    check().catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  const enable = async () => {
    setWorking(true);
    setMessage("");
    try {
      await subscribeUserToPush(user.id);
      setMessage(isArabic ? "تم تفعيل تنبيهات ALPHA CORE" : "ALPHA CORE notifications are now enabled.");
      window.setTimeout(() => setVisible(false), 1400);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorking(false);
    }
  };

  const dismiss = () => {
    window.localStorage.setItem(PUSH_DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="push-permission-card" role="dialog" aria-live="polite" aria-label={isArabic ? "تفعيل التنبيهات" : "Enable notifications"}>
      <div className="push-permission-icon"><BellRing size={23}/></div>
      <div className="push-permission-copy">
        <strong>{isArabic ? "خليك أول واحد يعرف" : "Be first to know"}</strong>
        <p>{isArabic ? "فعّل التنبيهات للتوصيات الجديدة وتغييرات المحافظ وتحديثات الأداء اليومية." : "Get alerts for new recommendations, portfolio changes and daily performance updates."}</p>
        {message && <small className="push-permission-message">{message}</small>}
      </div>
      <button className="push-enable-button" type="button" onClick={enable} disabled={working}>
        <Bell size={16}/>{working ? (isArabic ? "جاري التفعيل…" : "Enabling…") : (isArabic ? "تفعيل" : "Enable")}
      </button>
      <button className="push-dismiss-button" type="button" aria-label={isArabic ? "لاحقًا" : "Later"} onClick={dismiss}><X size={16}/></button>
    </aside>
  );
}
