import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Clock3, Inbox, Mail, MessageCircle, RefreshCw, Send, Star, UserRound } from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

export default function AdminSupport() {
  const { profile } = useAuth();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [tab, setTab] = useState("inbox");
  const [threads, setThreads] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [threadResult, surveyResult] = await Promise.all([
      supabase.from("support_threads").select("*, support_messages(*)").order("last_message_at", { ascending: false }),
      supabase.from("survey_responses").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    const error = threadResult.error || surveyResult.error;
    if (error) setMessage(error.message);
    const nextThreads = (threadResult.data || []).map((thread) => ({
      ...thread,
      support_messages: [...(thread.support_messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    }));
    setThreads(nextThreads);
    setSurveys(surveyResult.data || []);
    setSelectedId((current) => nextThreads.some((item) => item.id === current) ? current : nextThreads[0]?.id || "");
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("alpha-admin-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "survey_responses" }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    supabase
      .from("support_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", selectedId)
      .eq("sender_role", "user")
      .is("read_at", null)
      .then(() => {});
  }, [selectedId]);

  const selected = threads.find((item) => item.id === selectedId) || null;
  const surveyStats = useMemo(() => {
    const count = surveys.length;
    const average = count ? surveys.reduce((sum, item) => sum + Number(item.rating || 0), 0) / count : 0;
    const positive = count ? surveys.filter((item) => Number(item.rating) >= 4).length / count * 100 : 0;
    const comments = surveys.filter((item) => item.feedback).length;
    const distribution = [5,4,3,2,1].map((rating) => ({ rating, count: surveys.filter((item) => Number(item.rating) === rating).length }));
    return { count, average, positive, comments, distribution };
  }, [surveys]);

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    const { error } = await supabase.from("support_messages").insert({
      thread_id: selected.id,
      sender_id: profile.id,
      sender_role: "admin",
      message: reply.trim(),
      channel: "platform",
    });
    if (error) return setMessage(error.message);
    await supabase.from("support_threads").update({ status: "pending", assigned_to: profile.id }).eq("id", selected.id);
    setReply("");
    setMessage(isArabic ? "تم إرسال الرد داخل المنصة" : "Reply sent inside the platform.");
    await loadData();
  };

  const sendEmailReply = async () => {
    const emailReply = reply.trim();
    if (!selected || !emailReply || !selected.user_email) return;
    const { error } = await supabase.from("support_messages").insert({
      thread_id: selected.id,
      sender_id: profile.id,
      sender_role: "admin",
      channel: "email",
      message: emailReply,
    });
    if (error) return setMessage(error.message);
    await supabase.from("support_threads").update({ status: "pending", assigned_to: profile.id }).eq("id", selected.id);
    const href = `mailto:${encodeURIComponent(selected.user_email)}?subject=${encodeURIComponent(`ALPHA PLATFORM Support — ${selected.subject || "Message"}`)}&body=${encodeURIComponent(emailReply)}`;
    setReply("");
    setMessage(isArabic ? "تم تسجيل رد البريد في سجل الدعم وفتح تطبيق البريد" : "Email reply logged in support history and opened in your mail app.");
    await loadData();
    window.location.href = href;
  };

  const changeStatus = async (status) => {
    if (!selected) return;
    const { error } = await supabase.from("support_threads").update({ status, assigned_to: profile.id }).eq("id", selected.id);
    if (error) return setMessage(error.message);
    await loadData();
  };


  return (
    <div className="dashboard-shell admin-shell-v21">
      <DashboardHeader admin />
      <main className="admin-support-page-v31">
        <header className="admin-page-hero-v31"><div><span className="eyebrow">MEMBER EXPERIENCE</span><h1>{isArabic ? "الدعم واقتراحات المستخدمين" : "Support and member feedback"}</h1><p>{isArabic ? "Inbox كامل للمحادثات مع تحليلات الاستبيان الذكي." : "A complete member inbox with smart-survey analytics."}</p></div><button className="button subtle" onClick={loadData}><RefreshCw size={15}/>{isArabic ? "تحديث" : "Refresh"}</button></header>
        {message && <div className="notice-bar">{message}</div>}
        <div className="support-admin-tabs-v31"><button className={tab === "inbox" ? "active" : ""} onClick={() => setTab("inbox")}><Inbox size={16}/>{isArabic ? "صندوق الرسائل" : "Inbox"}<b>{threads.filter((item) => item.status !== "resolved").length}</b></button><button className={tab === "survey" ? "active" : ""} onClick={() => setTab("survey")}><BarChart3 size={16}/>{isArabic ? "تحليلات الاستبيان" : "Survey analytics"}<b>{surveys.length}</b></button></div>

        {tab === "inbox" && <section className="messenger-shell-v31">
          <aside className="conversation-list-v31">
            <header><div><span className="eyebrow">CONVERSATIONS</span><h2>{isArabic ? "رسائل الأعضاء" : "Member messages"}</h2></div></header>
            {loading && <p className="muted-copy-v21">{isArabic ? "جاري التحميل…" : "Loading…"}</p>}
            {!loading && !threads.length && <div className="conversation-empty-v31"><MessageCircle/><b>{isArabic ? "لا توجد رسائل حتى الآن" : "No messages yet"}</b></div>}
            {threads.map((thread) => {
              const last = thread.support_messages?.at(-1);
              const unreadCount = (thread.support_messages || []).filter((item) => item.sender_role === "user" && !item.read_at).length;
              return <button className={thread.id === selectedId ? "active" : ""} onClick={() => setSelectedId(thread.id)} key={thread.id}><span className="conversation-avatar-v31"><UserRound size={16}/></span><div><b>{thread.user_name || thread.user_email}</b><p>{last?.message || thread.subject}</p><small>{new Date(thread.last_message_at || thread.created_at).toLocaleString(locale)}</small></div>{unreadCount > 0 && <i className="conversation-unread-v31">{unreadCount}</i>}<em className={`support-status-v31 ${thread.status}`}>{thread.status}</em></button>;
            })}
          </aside>

          <article className="conversation-panel-v31">
            {!selected && <div className="conversation-empty-v31"><Inbox/><b>{isArabic ? "اختار محادثة" : "Select a conversation"}</b></div>}
            {selected && <>
              <header><div className="conversation-member-v31"><span><UserRound size={19}/></span><div><h2>{selected.user_name || selected.user_email}</h2><p>{selected.user_email} · ID {selected.user_id}</p></div></div><div><select value={selected.status} onChange={(event) => changeStatus(event.target.value)}><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select></div></header>
              <div className="conversation-messages-v31">{selected.support_messages?.map((item) => <div className={item.sender_role === "admin" ? "admin" : "user"} key={item.id}><span>{item.message}</span><small>{item.sender_role === "admin" ? (isArabic ? "فريق ALPHA" : "ALPHA team") : selected.user_name}{item.channel === "email" ? " · EMAIL" : ""} · {new Date(item.created_at).toLocaleString(locale)}</small></div>)}</div>
              <form className="conversation-reply-v31" onSubmit={sendReply}><textarea rows="3" maxLength="3000" value={reply} onChange={(event) => setReply(event.target.value)} placeholder={isArabic ? "اكتب الرد ثم اختار إرساله داخل المنصة أو بالبريد…" : "Write the reply, then send it in-platform or by email…"}/><div className="conversation-reply-actions-v31"><button className="button subtle" type="button" disabled={!reply.trim() || !selected.user_email} onClick={sendEmailReply}><Mail size={15}/>{isArabic ? "بالبريد" : "Email"}</button><button className="button gold" disabled={!reply.trim()}><Send size={15}/>{isArabic ? "داخل المنصة" : "In platform"}</button></div></form>
            </>}
          </article>
        </section>}

        {tab === "survey" && <section className="survey-admin-v31">
          <div className="survey-kpis-v31"><SurveyKpi icon={<Star/>} label={isArabic ? "متوسط التقييم" : "Average rating"} value={`${surveyStats.average.toFixed(1)} / 5`}/><SurveyKpi icon={<CheckCircle2/>} label={isArabic ? "تقييمات إيجابية" : "Positive ratings"} value={`${surveyStats.positive.toFixed(0)}%`}/><SurveyKpi icon={<MessageCircle/>} label={isArabic ? "إجابات بتعليق" : "Written comments"} value={String(surveyStats.comments)}/><SurveyKpi icon={<Clock3/>} label={isArabic ? "إجمالي الردود" : "Total responses"} value={String(surveyStats.count)}/></div>
          <div className="survey-content-grid-v31">
            <article className="panel-v21 padded-v21"><div className="panel-heading-v21"><div><span className="eyebrow">DISTRIBUTION</span><h2>{isArabic ? "توزيع التقييمات" : "Rating distribution"}</h2></div></div><div className="rating-distribution-v31">{surveyStats.distribution.map((row) => <div key={row.rating}><span>{row.rating}<Star size={13}/></span><i><em style={{ width: `${surveyStats.count ? row.count / surveyStats.count * 100 : 0}%` }}/></i><b>{row.count}</b></div>)}</div></article>
            <article className="panel-v21 survey-comments-v31"><div className="panel-heading-v21"><div><span className="eyebrow">LATEST RESPONSES</span><h2>{isArabic ? "أحدث التعليقات" : "Latest comments"}</h2></div></div><div>{surveys.slice(0, 100).map((item) => <article key={item.id}><span>{Array.from({ length: item.rating }, (_, index) => <Star size={12} key={index}/>)}</span><p>{item.feedback || (isArabic ? "بدون تعليق مكتوب" : "No written comment")}</p><small>{item.user_name || item.user_email || `User ${item.user_id}`} · {item.user_email ? `${item.user_email} · ` : ""}{item.page_path} · {new Date(item.created_at).toLocaleString(locale)}</small></article>)}</div></article>
          </div>
        </section>}
      </main>
    </div>
  );
}

function SurveyKpi({ icon, label, value }) {
  return <article><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></article>;
}
