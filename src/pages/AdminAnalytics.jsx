import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CalendarClock,
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerReset,
  UserCheck,
  UsersRound,
} from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import PlatformExecutiveReportExport from "../components/PlatformExecutiveReportExport";
import { useLanguage } from "../context/LanguageContext";
import { dateTimeLabel, formatNumber } from "../lib/calculations";
import { supabase } from "../lib/supabase";

function formatDuration(totalSeconds, isArabic) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  if (seconds < 60) return `${Math.round(seconds)}${isArabic ? " ث" : "s"}`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}${isArabic ? " د" : "m"} ${remaining}${isArabic ? " ث" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return `${hours}${isArabic ? " س" : "h"} ${remainderMinutes}${isArabic ? " د" : "m"}`;
}

export default function AdminAnalytics() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [windowHours, setWindowHours] = useState(24);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [roboSummary, setRoboSummary] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    const [analyticsResult, usersResult, roboResult] = await Promise.all([
      supabase.rpc("get_platform_analytics", { p_window_hours: windowHours }),
      supabase.rpc("get_registered_users"),
      supabase.rpc("get_robo_advisor_summary"),
    ]);
    const error = analyticsResult.error || usersResult.error;
    if (error) {
      setMessage(error.message || String(error));
    } else {
      setAnalytics(analyticsResult.data || {});
      setUsers(usersResult.data || []);
      if (!roboResult.error) setRoboSummary(roboResult.data || null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [windowHours]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((row) => `${row.full_name || ""} ${row.email || ""}`.toLowerCase().includes(needle));
  }, [users, query]);

  const exportCsv = () => {
    const header = ["Name", "Email", "Signup Date", "Last Active", "Sessions", "Total Session Time"];
    const rows = visibleUsers.map((row) => [
      row.full_name || "",
      row.email || "",
      row.signup_date || "",
      row.last_active || "",
      row.session_count || 0,
      formatDuration(row.total_duration_seconds, false),
    ]);
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alpha-registered-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-shell admin-analytics-shell-v38">
      <DashboardHeader admin />
      {message && <div className="notice-bar">{message}</div>}
      <main className="admin-analytics-v38">
        <section className="admin-analytics-hero-v38">
          <div><span className="eyebrow">SUPER ADMIN · PRIVATE ANALYTICS</span><h1>{isArabic ? "لوحة المستخدمين والتحليلات" : "Users & growth analytics"}</h1><p>{isArabic ? "صفحة خاصة بالـSuper Admin فقط لمتابعة التسجيلات والنشاط والجلسات وتصدير العملاء المحتملين." : "A private Super Admin view for signups, visitor activity, sessions and lead export."}</p></div>
          <div className="admin-analytics-hero-actions-v38"><span><ShieldCheck/>{isArabic ? "محمي بصلاحية Super Admin" : "Super Admin protected"}</span><PlatformExecutiveReportExport onMessage={setMessage}/><button className="button subtle" onClick={load} disabled={loading}><RefreshCw className={loading ? "spin" : ""}/>{isArabic ? "تحديث" : "Refresh"}</button></div>
        </section>

        <section className="analytics-window-switch-v38">
          <div><small>{isArabic ? "نافذة النشاط" : "ACTIVITY WINDOW"}</small><b>{windowHours === 24 ? (isArabic ? "آخر 24 ساعة" : "Last 24 hours") : (isArabic ? "آخر 7 أيام" : "Last 7 days")}</b></div>
          <div>{[[24, isArabic ? "24 ساعة" : "24 hours"], [168, isArabic ? "7 أيام" : "7 days"]].map(([hours, label]) => <button key={hours} className={windowHours === hours ? "active" : ""} onClick={() => setWindowHours(hours)}>{label}</button>)}</div>
        </section>

        <section className="admin-analytics-kpis-v38">
          <AnalyticsCard icon={UsersRound} label={isArabic ? "إجمالي التسجيلات" : "Total signups"} value={formatNumber(analytics?.total_signups, 0, locale)} note={isArabic ? "كل الحسابات المسجلة" : "All registered accounts"}/>
          <AnalyticsCard icon={UserCheck} label={isArabic ? "زوار نشطون" : "Active visitors"} value={formatNumber(analytics?.active_visitors, 0, locale)} note={windowHours === 24 ? (isArabic ? "خلال 24 ساعة" : "Within 24 hours") : (isArabic ? "خلال 7 أيام" : "Within 7 days")} tone="cyan"/>
          <AnalyticsCard icon={Activity} label={isArabic ? "إجمالي الجلسات" : "Total sessions"} value={formatNumber(analytics?.total_sessions, 0, locale)} note={`${formatNumber(analytics?.sessions_in_window, 0, locale)} ${isArabic ? "داخل الفترة" : "inside selected window"}`} tone="violet"/>
          <AnalyticsCard icon={TimerReset} label={isArabic ? "متوسط مدة الجلسة" : "Average session duration"} value={formatDuration(analytics?.average_session_seconds, isArabic)} note={isArabic ? "من أول فتح حتى آخر نشاط" : "From first open to last activity"} tone="green"/>
        </section>

        {roboSummary && <section className="admin-robo-summary-v39">
          <header><div><span className="eyebrow">ALPHA APEX · ROBO-ADVISOR</span><h2>{isArabic ? "توزيع ملفات المخاطر" : "Risk-persona distribution"}</h2><p>{isArabic ? "إحصاءات مجمعة فقط، من دون عرض إجابات المستخدمين الفردية." : "Aggregated adoption signals without exposing individual questionnaire answers."}</p></div><span><BrainCircuit/>{formatNumber(roboSummary.assessed_users, 0, locale)} {isArabic ? "مستخدمين" : "assessed users"}</span></header>
          <div className="admin-robo-personas-v39">
            <article className="conservative"><small>{isArabic ? "محافظ" : "Conservative"}</small><b>{formatNumber(roboSummary.conservative, 0, locale)}</b><span>5–7</span></article>
            <article className="balanced"><small>{isArabic ? "متوازن" : "Balanced"}</small><b>{formatNumber(roboSummary.balanced, 0, locale)}</b><span>8–11</span></article>
            <article className="aggressive"><small>{isArabic ? "هجومي" : "Aggressive"}</small><b>{formatNumber(roboSummary.aggressive, 0, locale)}</b><span>12–15</span></article>
            <article className="average"><small>{isArabic ? "متوسط النقاط" : "Average score"}</small><b>{formatNumber(roboSummary.average_score, 2, locale)}</b><span>/15</span></article>
          </div>
        </section>}

        <section className="admin-users-panel-v38">
          <header>
            <div><span className="eyebrow">REGISTERED USERS & LEADS</span><h2>{isArabic ? "كل المستخدمين المسجلين" : "Registered user directory"}</h2><p>{isArabic ? "الاسم والبريد وتاريخ التسجيل وآخر نشاط، مع تصدير CSV جاهز للتسويق." : "Name, email, signup date and last activity, with a marketing-ready CSV export."}</p></div>
            <button className="button primary" onClick={exportCsv} disabled={!visibleUsers.length}><Download/>{isArabic ? "تصدير CSV" : "Export CSV"}</button>
          </header>
          <div className="admin-users-toolbar-v38"><label><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث بالاسم أو البريد" : "Search name or email"}/></label><span><CalendarClock/>{isArabic ? "آخر تحديث" : "Last calculated"}: {dateTimeLabel(analytics?.generated_at, locale)}</span></div>
          <div className="table-scroll admin-users-table-wrap-v38">
            <table className="data-table-v21 admin-users-table-v38">
              <thead><tr><th>{isArabic ? "المستخدم" : "User"}</th><th>{isArabic ? "البريد" : "Email"}</th><th>{isArabic ? "تاريخ التسجيل" : "Signup date"}</th><th>{isArabic ? "آخر نشاط" : "Last active"}</th><th>{isArabic ? "الجلسات" : "Sessions"}</th><th>{isArabic ? "إجمالي الوقت" : "Total time"}</th></tr></thead>
              <tbody>{visibleUsers.map((row) => <tr key={row.user_id}><td><span className="analytics-user-cell-v38"><i>{(row.full_name || row.email || "U").slice(0, 2).toUpperCase()}</i><b>{row.full_name || (isArabic ? "مستخدم بدون اسم" : "Unnamed user")}</b></span></td><td>{row.email || "—"}</td><td>{dateTimeLabel(row.signup_date, locale)}</td><td>{row.last_active ? dateTimeLabel(row.last_active, locale) : (isArabic ? "لم تُسجل جلسة بعد" : "No tracked session yet")}</td><td><b>{formatNumber(row.session_count, 0, locale)}</b></td><td>{formatDuration(row.total_duration_seconds, isArabic)}</td></tr>)}</tbody>
            </table>
            {!visibleUsers.length && <div className="admin-users-empty-v38"><UsersRound/><p>{loading ? (isArabic ? "جاري تحميل المستخدمين…" : "Loading users…") : (isArabic ? "لا توجد نتائج مطابقة." : "No matching users.")}</p></div>}
          </div>
        </section>
      </main>
    </div>
  );
}

function AnalyticsCard({ icon: Icon, label, value, note, tone = "blue" }) {
  return <article className={`analytics-card-v38 ${tone}`}><span><Icon/></span><small>{label}</small><b>{value}</b><p>{note}</p></article>;
}
