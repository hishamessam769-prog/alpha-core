import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Headphones, MessageCircle, Send, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

export default function SupportWidget() {
  const { user, profile } = useAuth();
  const { isArabic } = useLanguage();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const displayName = profile?.full_name || profile?.email || user?.email || (isArabic ? "عضو المنصة" : "Platform member");
  const unread = useMemo(() => messages.filter((item) => item.sender_role === "admin" && !item.read_at).length, [messages]);

  const loadThread = async () => {
    if (!user || !supabase) return;
    const { data: threadRows, error } = await supabase
      .from("support_threads")
      .select("*")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(1);
    if (error || !threadRows?.length) {
      setThread(null);
      setMessages([]);
      return;
    }
    const activeThread = threadRows[0];
    setThread(activeThread);
    const { data: messageRows } = await supabase
      .from("support_messages")
      .select("*")
      .eq("thread_id", activeThread.id)
      .order("created_at", { ascending: true });
    setMessages(messageRows || []);
  };

  useEffect(() => { loadThread(); }, [user?.id]);

  useEffect(() => {
    if (!open || !thread?.id || !supabase) return undefined;
    const channel = supabase
      .channel(`support-thread-${thread.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `thread_id=eq.${thread.id}` }, loadThread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, thread?.id]);

  useEffect(() => {
    if (!open || !thread?.id || !supabase) return;
    const unreadIds = messages.filter((item) => item.sender_role === "admin" && !item.read_at).map((item) => item.id);
    if (!unreadIds.length) return;
    const readAt = new Date().toISOString();
    setMessages((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item));
    supabase.from("support_messages").update({ read_at: readAt }).in("id", unreadIds).then(({ error }) => {
      if (error) loadThread();
    });
  }, [open, thread?.id, messages]);

  const send = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || loading || !user) return;
    setLoading(true);
    setNotice("");
    try {
      let activeThread = thread;
      if (!activeThread) {
        const { data, error } = await supabase.from("support_threads").insert({
          user_id: user.id,
          user_name: displayName,
          user_email: profile?.email || user.email,
          subject: isArabic ? "اقتراح أو رسالة دعم" : "Suggestion or support request",
          status: "open",
        }).select("*").single();
        if (error) throw error;
        activeThread = data;
        setThread(data);
      }
      const { error } = await supabase.from("support_messages").insert({
        thread_id: activeThread.id,
        sender_id: user.id,
        sender_role: "user",
        message,
      });
      if (error) throw error;
      setText("");
      setNotice(isArabic ? "تم إرسال رسالتك بنجاح" : "Your message was sent successfully.");
      window.dispatchEvent(new CustomEvent("alpha:meaningful-action", { detail: { action: "support_message" } }));
      await loadThread();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`support-widget ${open ? "open" : ""}`}>
      {open && <section className="support-panel" aria-label={isArabic ? "تواصل معنا" : "Contact support"}>
        <header><div><span><Headphones size={16}/></span><div><b>{isArabic ? "تواصل معنا" : "Contact us"}</b><small>{displayName}</small></div></div><button className="icon-button" type="button" onClick={() => setOpen(false)}><X size={17}/></button></header>
        <div className="support-history">
          {!messages.length && <div className="support-empty"><MessageCircle/><b>{isArabic ? "شاركنا اقتراحك" : "Share your suggestion"}</b><p>{isArabic ? "بيانات حسابك مرفقة تلقائيًا. اكتب رسالتك فقط وسنحتفظ بتاريخ المحادثة." : "Your account details are attached automatically. Write your message and the full conversation history will be retained."}</p></div>}
          {messages.map((item) => <article className={item.sender_role === "admin" ? "admin" : "user"} key={item.id}><span>{item.message}</span><small>{item.channel === "email" ? "EMAIL · " : ""}{new Date(item.created_at).toLocaleString(isArabic ? "ar-EG" : "en-GB")}</small></article>)}
        </div>
        {notice && <div className="support-notice"><CheckCircle2 size={14}/>{notice}</div>}
        <form onSubmit={send}><textarea rows="3" maxLength="3000" value={text} onChange={(event) => setText(event.target.value)} placeholder={isArabic ? "اكتب رسالتك أو اقتراحك…" : "Write your message or suggestion…"}/><button className="button gold" disabled={loading || !text.trim()}><Send size={15}/>{loading ? (isArabic ? "جاري الإرسال" : "Sending") : (isArabic ? "إرسال" : "Send")}</button></form>
      </section>}
      <button className="support-launcher" type="button" onClick={() => setOpen((current) => !current)} aria-label={isArabic ? "تواصل معنا" : "Contact us"}><MessageCircle size={20}/>{unread > 0 && <b>{unread}</b>}</button>
    </div>
  );
}
