import { useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, MailPlus, Search, Shield, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { ROLE_PRESETS, deriveRole, permissionSet, rolePayload, supportedProfileFields } from "../lib/access";
import { dateTimeLabel } from "../lib/calculations";
import { supabase } from "../lib/supabase";

const PERMISSIONS = [
  ["view_published", "View published platform"],
  ["publish_articles", "Publish market news & economic updates"],
  ["publish_updates", "Publish company and portfolio updates"],
  ["edit_own_content", "Edit own published content"],
  ["manage_portfolios", "Create and manage portfolios"],
  ["manage_recommendations", "Create and manage recommendations"],
  ["manage_reports", "Create and manage research reports"],
  ["publish_content", "Publish all platform content"],
  ["support_inbox", "Open the support inbox"],
  ["manage_settings", "Manage platform settings"],
];

export default function AdminTeam() {
  const { profile } = useAuth();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("analyst");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = Boolean(profile?.is_super_admin);

  const load = async (preferredId) => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) return setMessage(error.message);
    const nextRows = data || [];
    setRows(nextRows);
    setSelectedId((current) => preferredId || (current && nextRows.some((row) => row.id === current) ? current : nextRows[0]?.id || ""));
  };

  useEffect(() => { load(); }, []);
  const selected = rows.find((row) => row.id === selectedId) || null;
  const supported = supportedProfileFields(selected);
  const role = deriveRole(selected);
  const permissions = useMemo(() => permissionSet(selected), [selected]);
  const visible = rows.filter((row) => !query.trim() || `${row.full_name || ""} ${row.email || ""} ${deriveRole(row)}`.toLowerCase().includes(query.toLowerCase()));

  const changeRole = async (nextRole) => {
    if (!isSuperAdmin || !selected) return;
    setSaving(true);
    setMessage("");
    const payload = rolePayload(selected, nextRole);
    const { error } = await supabase.from("profiles").update(payload).eq("id", selected.id);
    setSaving(false);
    if (error) return setMessage(error.message);
    const compatibility = !supported.role && !supported.title && !supported.position && ["analyst", "instructor", "contributor"].includes(nextRole);
    setMessage(compatibility
      ? (isArabic ? "تم تفعيل صلاحية النشر عبر حالة Admin الحالية. قاعدة البيانات لا تحتوي حقلًا نصيًا لحفظ اسم الدور، لذلك سيظهر الحساب كـAdmin بعد إعادة التحميل." : "Publishing access is active through the existing Admin flag. The current profile has no text role/title field, so it will display as Admin after reload.")
      : (isArabic ? "تم تحديث الدور والصلاحيات بنجاح." : "Role and permissions updated successfully."));
    await load(selected.id);
  };

  const togglePermission = async (key) => {
    if (!isSuperAdmin || !selected || !supported.permissions || role === "super_admin") return;
    const next = new Set(permissions);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ permissions: [...next] }).eq("id", selected.id);
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم حفظ الصلاحيات." : "Permissions saved.");
    await load(selected.id);
  };

  const sendInvite = async (event) => {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!isSuperAdmin || !email) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: inviteName.trim() || undefined,
          invited_by: profile.id,
          requested_role: inviteRole,
        },
      },
    });
    if (error) {
      setSaving(false);
      return setMessage(error.message);
    }

    // Existing accounts can receive the selected role immediately. New users
    // receive it after their profile is created and appears in this directory.
    const { data: existingProfile } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
    if (existingProfile) {
      const { error: roleError } = await supabase.from("profiles").update(rolePayload(existingProfile, inviteRole)).eq("id", existingProfile.id);
      if (roleError) {
        setSaving(false);
        return setMessage(roleError.message);
      }
      await load(existingProfile.id);
      setMessage(isArabic ? "تم إرسال الدعوة وتعيين الدور للحساب الموجود." : "Invitation sent and the selected role was assigned to the existing account.");
    } else {
      setMessage(isArabic ? "تم إرسال الدعوة. سيتم إنشاء الملف عند أول تسجيل دخول، وبعدها يمكنك تثبيت الدور من هذه الصفحة." : "Invitation sent. The profile will be created on first sign-in, then you can confirm the role from this page.");
    }
    setSaving(false);
    setInviteEmail("");
    setInviteName("");
  };

  const copySignupLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/signup`);
    setMessage(isArabic ? "تم نسخ رابط التسجيل." : "Signup link copied.");
  };

  return (
    <div className="dashboard-shell admin-shell-v21 team-admin-shell-v33">
      <DashboardHeader admin/>
      <main className="team-page-v33">
        <section className="team-hero-v33">
          <div><span className="eyebrow">ROLE-BASED ACCESS CONTROL</span><h1>{isArabic ? "الفريق والصلاحيات بدون تعقيد" : "Team access without permission confusion"}</h1><p>{isArabic ? "اختر العضو، حدد دوره، وستظهر له أدوات النشر والإدارة المناسبة تلقائيًا." : "Select a team member, assign a role and the platform will expose the correct publishing and management tools automatically."}</p></div>
          <div className="team-hero-stat-v33"><UsersRound/><span><small>{isArabic ? "إجمالي الحسابات" : "TEAM ACCOUNTS"}</small><b>{rows.length}</b></span></div>
        </section>

        {message && <div className="notice-bar">{message}</div>}

        <div className="team-layout-v33">
          <aside className="team-directory-v33">
            <div className="team-directory-head-v33"><div><small>DIRECTORY</small><b>{isArabic ? "اختر عضوًا" : "Select a member"}</b></div><ShieldCheck/></div>
            <label className="team-search-v33"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "بحث بالاسم أو البريد" : "Search name or email"}/></label>
            <nav>{visible.map((row) => <button key={row.id} className={row.id === selectedId ? "active" : ""} onClick={() => { setSelectedId(row.id); setMessage(""); }}><span className="team-avatar-mini-v33">{(row.full_name || row.email || "U").slice(0, 2).toUpperCase()}</span><span><b>{row.full_name || row.email}</b><small>{row.email}</small></span><em>{ROLE_PRESETS[deriveRole(row)]?.label}</em></button>)}</nav>
          </aside>

          <section className="team-control-v33">
            <article className="team-invite-v33">
              <header><div><span className="eyebrow">SECURE INVITATION</span><h2>{isArabic ? "إضافة عضو للفريق" : "Invite a team member"}</h2></div><MailPlus/></header>
              <form onSubmit={sendInvite}><label>{isArabic ? "الاسم" : "Name"}<input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Hisham Adel"/></label><label>{isArabic ? "البريد" : "Email"}<input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="analyst@example.com"/></label><label>{isArabic ? "الدور المطلوب" : "Invite as"}<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="contributor">Contributor</option><option value="analyst">Analyst</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select></label><div><button className="button primary" disabled={!isSuperAdmin || saving}><MailPlus/>{isArabic ? "إرسال الدعوة" : "Send invitation"}</button><button type="button" className="button subtle" onClick={copySignupLink}><Copy/>{isArabic ? "نسخ الرابط" : "Copy link"}</button></div></form>
            </article>

            {selected && <>
              <article className="team-member-v33">
                <div className="team-member-heading-v33"><span>{(selected.full_name || selected.email || "U").slice(0, 2).toUpperCase()}</span><div><small>SELECTED ACCOUNT</small><h2>{selected.full_name || selected.email}</h2><p>{selected.email}</p></div><ShieldCheck/></div>
                <div className="team-meta-v33"><span><small>{isArabic ? "الدور" : "Current role"}</small><b>{ROLE_PRESETS[role]?.label}</b></span><span><small>{isArabic ? "تاريخ الإنشاء" : "Created"}</small><b>{dateTimeLabel(selected.created_at, locale)}</b></span><span><small>User ID</small><b>{selected.id}</b></span></div>
                <label className="team-role-select-v33">{isArabic ? "تعيين الدور" : "Assign role"}<select value={role} disabled={!isSuperAdmin || saving} onChange={(event) => changeRole(event.target.value)}><option value="member">Member</option><option value="contributor">Contributor</option><option value="analyst">Analyst</option><option value="instructor">Instructor</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></label>
                <div className="role-preview-v33"><UserCog/><div><small>ROLE CAPABILITIES</small><b>{ROLE_PRESETS[role]?.title}</b><p>{(ROLE_PRESETS[role]?.permissions || []).join(" · ")}</p></div></div>
              </article>

              <article className="permission-matrix-v33">
                <header><div><span className="eyebrow">GRANULAR PERMISSIONS</span><h2>{isArabic ? "صلاحيات هذا الحساب" : "Account permissions"}</h2><p>{supported.permissions ? (isArabic ? "يمكن تعديل كل صلاحية بشكل مستقل." : "Every permission can be toggled independently.") : (isArabic ? "القاعدة الحالية لا تحتوي حقل Permissions؛ يتم تطبيق مجموعة الصلاحيات الآمنة الخاصة بالدور تلقائيًا." : "The current profile has no permissions field; the safe role preset is applied automatically.")}</p></div><KeyRound/></header>
                <div className="permission-grid-v33">{PERMISSIONS.map(([key, label]) => <button key={key} type="button" className={permissions.has("all") || permissions.has(key) ? "active" : ""} disabled={!isSuperAdmin || !supported.permissions || role === "super_admin" || saving} onClick={() => togglePermission(key)}><span>{permissions.has("all") || permissions.has(key) ? <Check/> : <Shield/>}</span><div><b>{label}</b><small>{permissions.has("all") || permissions.has(key) ? "Allowed" : "Restricted"}</small></div></button>)}</div>
              </article>
            </>}
          </section>
        </div>
      </main>
    </div>
  );
}
