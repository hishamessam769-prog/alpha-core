import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Link2,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Send,
  Smartphone,
  UserRound,
  UsersRound,
} from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { dateTimeLabel } from "../lib/calculations";
import {
  dispatchQueuedPushNotifications,
  getCurrentPushSubscription,
  getPushServiceStatus,
  isPushConfigured,
  isWebPushSupported,
  retryPushNotification,
  sendManualPushNotification,
  subscribeUserToPush,
} from "../lib/pushNotifications";
import { supabase } from "../lib/supabase";

const EMPTY_FORM = {
  eventType: "platform_update",
  title: "",
  body: "",
  targetUrl: "/dashboard",
};

const EVENT_OPTIONS = [
  ["platform_update", "Platform update", "تحديث المنصة"],
  ["new_portfolio", "New portfolio", "محفظة جديدة"],
  ["portfolio_rebalance", "Portfolio change", "تغيير في محفظة"],
  ["daily_performance_update", "Performance update", "تحديث الأداء"],
  ["new_recommendation", "New recommendation", "توصية جديدة"],
  ["research_update", "Research update", "بحث أو تقرير جديد"],
];

function statusTone(status) {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  if (status === "processing") return "processing";
  return "pending";
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const { isArabic } = useLanguage();
  const [form, setForm] = useState(EMPTY_FORM);
  const [subscriptions, setSubscriptions] = useState([]);
  const [events, setEvents] = useState([]);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((item) => item.is_active),
    [subscriptions],
  );
  const uniqueUsers = useMemo(
    () => new Set(activeSubscriptions.map((item) => item.user_id).filter(Boolean)).size,
    [activeSubscriptions],
  );
  const sentEvents = useMemo(() => events.filter((item) => item.status === "sent").length, [events]);
  const failedEvents = useMemo(() => events.filter((item) => item.status === "failed").length, [events]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [subscriptionsResult, eventsResult, statusResult, currentSubscription] = await Promise.all([
        supabase
          .from("push_subscriptions")
          .select("id,user_id,endpoint,is_active,created_at,updated_at,last_success_at,last_error,user_agent")
          .order("created_at", { ascending: false }),
        supabase
          .from("notification_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(60),
        getPushServiceStatus(),
        getCurrentPushSubscription().catch(() => null),
      ]);
      if (subscriptionsResult.error) throw subscriptionsResult.error;
      if (eventsResult.error) throw eventsResult.error;
      setSubscriptions(subscriptionsResult.data || []);
      setEvents(eventsResult.data || []);
      setServiceStatus(statusResult || null);
      setDeviceSubscribed(Boolean(currentSubscription));
    } catch (loadError) {
      setError(loadError.message || String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const enableThisDevice = async () => {
    setWorking("enable");
    setError("");
    setMessage("");
    try {
      await subscribeUserToPush(user?.id);
      setDeviceSubscribed(true);
      setMessage(isArabic ? "تم تفعيل التنبيهات على هذا الجهاز." : "Notifications are enabled on this device.");
      await load();
    } catch (enableError) {
      setError(enableError.message || String(enableError));
    } finally {
      setWorking("");
    }
  };

  const validate = () => {
    if (!form.title.trim()) return isArabic ? "اكتب عنوان الإشعار." : "Enter a notification title.";
    if (!form.body.trim()) return isArabic ? "اكتب نص الرسالة." : "Enter the notification message.";
    if (!form.targetUrl.trim().startsWith("/")) return isArabic ? "الرابط الداخلي لازم يبدأ بـ /." : "The internal link must start with /.";
    return "";
  };

  const send = async (audience) => {
    const validation = validate();
    if (validation) { setError(validation); return; }
    if (audience === "all" && !window.confirm(isArabic ? "إرسال الإشعار لكل الأجهزة المشتركة؟" : "Send this notification to every subscribed device?")) return;

    setWorking(audience);
    setError("");
    setMessage("");
    try {
      const result = await sendManualPushNotification({ ...form, audience });
      const success = Number(result?.success || 0);
      const failed = Number(result?.failed || 0);
      setMessage(
        isArabic
          ? `تم الإرسال بنجاح إلى ${success} جهاز${failed ? ` وفشل ${failed}` : ""}.`
          : `Delivered to ${success} device${success === 1 ? "" : "s"}${failed ? `; ${failed} failed` : ""}.`,
      );
      await load();
    } catch (sendError) {
      setError(sendError.message || String(sendError));
    } finally {
      setWorking("");
    }
  };

  const dispatchPending = async () => {
    setWorking("dispatch");
    setError("");
    setMessage("");
    try {
      const result = await dispatchQueuedPushNotifications();
      setMessage(isArabic ? `تمت معالجة ${Number(result?.processed || 0)} إشعار.` : `Processed ${Number(result?.processed || 0)} queued notification(s).`);
      await load();
    } catch (dispatchError) {
      setError(dispatchError.message || String(dispatchError));
    } finally {
      setWorking("");
    }
  };

  const retry = async (eventId) => {
    setWorking(`retry:${eventId}`);
    setError("");
    setMessage("");
    try {
      const result = await retryPushNotification(eventId);
      setMessage(isArabic ? `تمت إعادة المحاولة ونجح ${Number(result?.success || 0)} إرسال.` : `Retry completed with ${Number(result?.success || 0)} successful delivery(s).`);
      await load();
    } catch (retryError) {
      setError(retryError.message || String(retryError));
    } finally {
      setWorking("");
    }
  };

  const browserReady = isWebPushSupported();
  const publicKeyReady = isPushConfigured();
  const backendReady = Boolean(serviceStatus?.configured);

  return (
    <div className="dashboard-shell admin-notification-shell-v361">
      <DashboardHeader admin />
      <main className="notification-center-v361">
        <section className="notification-hero-v361">
          <div>
            <span className="eyebrow">PUSH NOTIFICATIONS</span>
            <h1>{isArabic ? "مركز الإشعارات" : "Notification Center"}</h1>
            <p>{isArabic ? "اكتب رسالة واحدة وابعتها لكل المشتركين أو جرّبها على جهازك الأول." : "Compose one message, test it on your own device, then send it to every subscribed user."}</p>
          </div>
          <button className="button subtle" type="button" onClick={load} disabled={loading || Boolean(working)}>
            <RefreshCw size={16} className={loading ? "spin-v361" : ""}/>{isArabic ? "تحديث" : "Refresh"}
          </button>
        </section>

        <section className="notification-stats-v361">
          <Stat icon={<Smartphone/>} label={isArabic ? "الأجهزة النشطة" : "Active devices"} value={activeSubscriptions.length} tone="cyan" />
          <Stat icon={<UsersRound/>} label={isArabic ? "المستخدمون المشتركون" : "Subscribed users"} value={uniqueUsers} tone="violet" />
          <Stat icon={<CheckCircle2/>} label={isArabic ? "إشعارات ناجحة" : "Sent events"} value={sentEvents} tone="green" />
          <Stat icon={<AlertCircle/>} label={isArabic ? "تحتاج مراجعة" : "Need attention"} value={failedEvents} tone={failedEvents ? "red" : "neutral"} />
        </section>

        {(!publicKeyReady || !backendReady || !browserReady) && (
          <section className="push-setup-banner-v361">
            <div className="push-setup-icon-v361"><BellRing size={24}/></div>
            <div>
              <strong>{isArabic ? "الإشعارات محتاجة إكمال إعداد مرة واحدة" : "Push setup still needs one-time configuration"}</strong>
              <p>{isArabic ? "واجهة الإرسال جاهزة، لكن لازم المفتاح العام في Vercel ومفاتيح VAPID داخل Supabase Edge Function قبل الإرسال الفعلي." : "The sending interface is ready, but the Vercel public key and Supabase VAPID secrets must be configured before real delivery."}</p>
              <div className="setup-checks-v361">
                <span className={browserReady ? "ok" : "bad"}>{browserReady ? <CheckCircle2/> : <AlertCircle/>}{isArabic ? "المتصفح يدعم Push" : "Browser Push support"}</span>
                <span className={publicKeyReady ? "ok" : "bad"}>{publicKeyReady ? <CheckCircle2/> : <AlertCircle/>}VITE_VAPID_PUBLIC_KEY</span>
                <span className={backendReady ? "ok" : "bad"}>{backendReady ? <CheckCircle2/> : <AlertCircle/>}{isArabic ? "محرك Supabase جاهز" : "Supabase dispatcher ready"}</span>
              </div>
            </div>
          </section>
        )}

        <div className="notification-grid-v361">
          <section className="notification-compose-v361">
            <header>
              <div><span className="eyebrow">COMPOSE</span><h2>{isArabic ? "اكتب الإشعار" : "Compose notification"}</h2></div>
              <span className="notification-live-chip-v361"><Bell size={14}/>{isArabic ? "Push مباشر" : "Live push"}</span>
            </header>

            <div className="notification-form-v361">
              <label>{isArabic ? "نوع الإشعار" : "Notification type"}
                <select value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })}>
                  {EVENT_OPTIONS.map(([value, en, ar]) => <option key={value} value={value}>{isArabic ? ar : en}</option>)}
                </select>
              </label>
              <label>{isArabic ? "الرابط عند الضغط" : "Open link"}
                <div className="notification-link-input-v361"><Link2 size={16}/><input value={form.targetUrl} onChange={(event) => setForm({ ...form, targetUrl: event.target.value })} placeholder="/dashboard" /></div>
              </label>
              <label className="wide">{isArabic ? "العنوان" : "Title"}
                <input maxLength="180" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={isArabic ? "مثال: تم إطلاق محفظة جديدة" : "Example: A new portfolio is now live"} />
                <small>{form.title.length}/180</small>
              </label>
              <label className="wide">{isArabic ? "الرسالة" : "Message"}
                <textarea maxLength="500" rows="5" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={isArabic ? "اكتب الرسالة التي ستظهر على شاشة العميل..." : "Write the message users will see on their device..."} />
                <small>{form.body.length}/500</small>
              </label>
            </div>

            <div className="notification-preview-v361">
              <div className="notification-preview-icon-v361"><Bell size={20}/></div>
              <div><strong>{form.title || (isArabic ? "عنوان الإشعار" : "Notification title")}</strong><p>{form.body || (isArabic ? "نص الرسالة سيظهر هنا قبل الإرسال." : "Your message will appear here before sending.")}</p><small>ALPHA CORE · now</small></div>
            </div>

            {error && <div className="notification-message-v361 error"><AlertCircle size={16}/>{error}</div>}
            {message && <div className="notification-message-v361 success"><CheckCircle2 size={16}/>{message}</div>}

            <div className="notification-actions-v361">
              {!deviceSubscribed && <button className="button subtle" type="button" onClick={enableThisDevice} disabled={working === "enable" || !publicKeyReady}><BellRing size={16}/>{working === "enable" ? (isArabic ? "جاري التفعيل…" : "Enabling…") : (isArabic ? "فعّل على جهازي" : "Enable on this device")}</button>}
              <button className="button subtle" type="button" onClick={() => send("self")} disabled={Boolean(working) || !deviceSubscribed || !backendReady}><UserRound size={16}/>{working === "self" ? (isArabic ? "جاري الإرسال…" : "Sending…") : (isArabic ? "اختبار على جهازي" : "Send test to me")}</button>
              <button className="button green" type="button" onClick={() => send("all")} disabled={Boolean(working) || !activeSubscriptions.length || !backendReady}><Send size={16}/>{working === "all" ? (isArabic ? "جاري الإرسال…" : "Sending…") : (isArabic ? `إرسال للجميع (${activeSubscriptions.length})` : `Send to all (${activeSubscriptions.length})`)}</button>
            </div>
          </section>

          <aside className="notification-guide-v361">
            <span className="eyebrow">QUICK GUIDE</span>
            <h2>{isArabic ? "إرسال آمن في 3 خطوات" : "Safe sending in 3 steps"}</h2>
            <ol>
              <li><span>1</span><div><b>{isArabic ? "اكتب رسالة واضحة" : "Write a clear update"}</b><p>{isArabic ? "عنوان قصير ورسالة محددة ورابط الصفحة الصحيحة." : "Use a short title, specific message and the correct destination link."}</p></div></li>
              <li><span>2</span><div><b>{isArabic ? "جرّبها على جهازك" : "Test it on yourself"}</b><p>{isArabic ? "اتأكد من شكلها والرابط قبل الإرسال العام." : "Confirm the appearance and destination before broadcasting."}</p></div></li>
              <li><span>3</span><div><b>{isArabic ? "أرسل لكل المشتركين" : "Send to subscribers"}</b><p>{isArabic ? "هتشوف عدد الناجح والفاشل في السجل فورًا." : "The delivery result appears in history immediately."}</p></div></li>
            </ol>
            <button className="button subtle full" type="button" onClick={dispatchPending} disabled={Boolean(working) || !backendReady}><RotateCcw size={16}/>{working === "dispatch" ? (isArabic ? "جاري المعالجة…" : "Processing…") : (isArabic ? "معالجة التنبيهات المعلقة" : "Process pending notifications")}</button>
          </aside>
        </div>

        <section className="notification-history-v361">
          <header><div><span className="eyebrow">DELIVERY HISTORY</span><h2>{isArabic ? "سجل الإشعارات" : "Notification history"}</h2></div><span>{events.length}</span></header>
          {loading ? <div className="notification-loading-v361"><LoaderCircle className="spin-v361"/><span>{isArabic ? "جاري التحميل…" : "Loading delivery history…"}</span></div> : !events.length ? <div className="notification-empty-v361"><BellRing/><h3>{isArabic ? "لسه مفيش إشعارات" : "No notifications yet"}</h3><p>{isArabic ? "أول رسالة هتبعتها هتظهر هنا." : "Your first sent update will appear here."}</p></div> : (
            <div className="notification-event-list-v361">
              {events.map((event) => (
                <article key={event.id} className={`notification-event-v361 ${statusTone(event.status)}`}>
                  <div className="notification-event-symbol-v361">{event.status === "sent" ? <CheckCircle2/> : event.status === "failed" ? <AlertCircle/> : <Clock3/>}</div>
                  <div className="notification-event-copy-v361"><div><strong>{event.title}</strong><span className={`notification-status-v361 ${statusTone(event.status)}`}>{event.status}</span></div><p>{event.body}</p><small><Clock3 size={12}/>{dateTimeLabel(event.created_at)} · {Number(event.success_count || 0)} {isArabic ? "ناجح" : "sent"} · {Number(event.failure_count || 0)} {isArabic ? "فشل" : "failed"}</small>{event.last_error && <em>{event.last_error}</em>}</div>
                  <div className="notification-event-actions-v361"><a className="icon-button" href={event.target_url || "/dashboard"} target="_blank" rel="noreferrer" title={isArabic ? "فتح الرابط" : "Open target"}><ExternalLink size={15}/></a>{event.status === "failed" && <button className="icon-button" type="button" onClick={() => retry(event.id)} disabled={working === `retry:${event.id}`} title={isArabic ? "إعادة المحاولة" : "Retry"}>{working === `retry:${event.id}` ? <LoaderCircle className="spin-v361" size={15}/> : <RotateCcw size={15}/>}</button>}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ icon, label, value, tone }) {
  return <article className={`notification-stat-v361 ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}
