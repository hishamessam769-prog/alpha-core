import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function NotificationBadge({ compact = false }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    const load = async () => {
      const { count: unread } = await supabase.from("user_notification_inbox").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
      if (active) setCount(Number(unread || 0));
    };
    void load();
    const channel = supabase.channel(`notification-badge-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "user_notification_inbox", filter: `user_id=eq.${user.id}` }, load).subscribe();
    const refresh = () => void load();
    window.addEventListener("alpha:notifications-read", refresh);
    return () => { active = false; window.removeEventListener("alpha:notifications-read", refresh); void supabase.removeChannel(channel); };
  }, [user?.id]);

  return <Link className={`notification-badge-link-v37 ${compact ? "compact" : ""}`} to="/notifications" aria-label={`Notifications${count ? `, ${count} unread` : ""}`}><Bell size={compact ? 17 : 19}/>{count > 0 && <span>{count > 99 ? "99+" : count}</span>}</Link>;
}
