import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCheck, ChevronRight, Filter, Inbox, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { dateTimeLabel } from "../lib/calculations";
import { supabase } from "../lib/supabase";

export default function NotificationInbox() {
  const { user } = useAuth();
  const { isArabic } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("user_notification_inbox").select("id,read_at,delivered_at,created_at,notification_events(id,event_type,title,body,target_url,created_at)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) setMessage(error.message); else setItems(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (item) => {
    if (!item.read_at) await supabase.from("user_notification_inbox").update({ read_at: new Date().toISOString() }).eq("id", item.id);
    window.dispatchEvent(new Event("alpha:notifications-read"));
  };

  const markAll = async () => {
    const { error } = await supabase.rpc("mark_all_notifications_read");
    if (error) return setMessage(error.message);
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    window.dispatchEvent(new Event("alpha:notifications-read"));
  };

  const unread = items.filter((item) => !item.read_at).length;
  return <div className="dashboard-shell notification-inbox-page-v37">
    <DashboardHeader/>
    <main className="notification-inbox-v37">
      <header><div><span className="eyebrow">ALPHA ALERTS</span><h1>{isArabic ? "مركز التحديثات" : "Your notification inbox"}</h1><p>{isArabic ? "كل التوصيات وتحديثات المحافظ والتقارير في مكان واحد." : "Every recommendation, portfolio change and report in one place."}</p></div><button className="button subtle" type="button" disabled={!unread} onClick={markAll}><CheckCheck size={16}/>{isArabic ? "تحديد الكل كمقروء" : "Mark all read"}</button></header>
      <div className="notification-inbox-summary-v37"><BellRing/><div><strong>{unread}</strong><span>{isArabic ? "تحديث غير مقروء" : "unread updates"}</span></div></div>
      <section className="notification-filter-explainer-v312"><Filter/><div><b>{isArabic ? "التنبيهات أصبحت مفلترة حسب متابعتك" : "Alerts are now filtered by what you follow"}</b><p>{isArabic ? "تحديثات المحافظ العامة والتوصيات تصل لك فقط لو عامل Follow. تحديثات محافظك الافتراضية خاصة بك، بينما الإعلانات العامة المهمة تصل للجميع." : "Public portfolio and recommendation updates reach you only when followed. Your virtual portfolio alerts are private to you; important general announcements remain platform-wide."}</p></div><Link className="button subtle" to="/my-portfolios">{isArabic ? "إدارة المتابعة" : "Manage follows"}</Link></section>
      {message && <div className="notice-bar">{message}</div>}
      {loading ? <div className="notification-inbox-loading-v37"><LoaderCircle className="spin-v361"/>{isArabic ? "جاري تحميل التحديثات…" : "Loading updates…"}</div> : !items.length ? <div className="notification-inbox-empty-v37"><Inbox/><h2>{isArabic ? "مفيش تحديثات لسه" : "No updates yet"}</h2><p>{isArabic ? "أول إشعار جديد هيظهر هنا حتى لو فاتك الـPush." : "New alerts will remain here even if you miss the push notification."}</p></div> : <section className="notification-inbox-list-v37">{items.map((item) => { const event = item.notification_events || {}; return <Link key={item.id} to={event.target_url || "/dashboard"} onClick={() => markRead(item)} className={item.read_at ? "read" : "unread"}><span className="notification-inbox-icon-v37"><BellRing size={19}/></span><div><small>{String(event.event_type || "update").replaceAll("_", " ")}</small><h2>{event.title}</h2><p>{event.body}</p><time>{dateTimeLabel(event.created_at || item.created_at)}</time></div><ChevronRight/></Link>; })}</section>}
    </main>
  </div>;
}
