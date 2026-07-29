import { useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, MailPlus, Search, Shield, ShieldCheck, UserCog } from "lucide-react";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { dateTimeLabel } from "../lib/calculations";
import { supabase } from "../lib/supabase";

const PRESETS = {
  member: { label: "Member", is_admin: false, is_super_admin: false, permissions: ["view_published"] },
  analyst: { label: "Analyst", is_admin: false, is_super_admin: false, permissions: ["view_published", "draft_research", "edit_own_research"] },
  instructor: { label: "Instructor", is_admin: false, is_super_admin: false, permissions: ["view_published", "draft_reports", "edit_own_reports"] },
  admin: { label: "Admin", is_admin: true, is_super_admin: false, permissions: ["view_published", "manage_portfolios", "manage_recommendations", "manage_reports", "publish_content", "support_inbox"] },
  super_admin: { label: "Super Admin", is_admin: true, is_super_admin: true, permissions: ["all"] },
};

const PERMISSIONS = [
  ["view_published", "View published content"],
  ["draft_research", "Draft research"],
  ["edit_own_research", "Edit own research"],
  ["draft_reports", "Draft reports"],
  ["edit_own_reports", "Edit own reports"],
  ["manage_portfolios", "Manage portfolios"],
  ["manage_recommendations", "Manage recommendations"],
  ["manage_reports", "Manage reports"],
  ["publish_content", "Publish content"],
  ["support_inbox", "Support inbox"],
];

function rowRole(row) {
  if (row?.is_super_admin) return "super_admin";
  if (row?.is_admin) return "admin";
  if (["analyst", "instructor", "member"].includes(row?.role)) return row.role;
  return "member";
}

export default function AdminTeam() {
  const { profile } = useAuth();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = Boolean(profile?.is_super_admin);

  const load = async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) return setMessage(error.message);
    setRows(data || []);
    setSelectedId((current) => current && data?.some((row) => row.id === current) ? current : data?.[0]?.id || "");
  };

  useEffect(() => { load(); }, []);
  const selected = rows.find((row) => row.id === selectedId) || null;
  const supportsAdvancedRole = Boolean(selected && Object.prototype.hasOwnProperty.call(selected, "role"));
  const supportsPermissions = Boolean(selected && Object.prototype.hasOwnProperty.call(selected, "permissions"));
  const role = rowRole(selected);
  const permissionSet = useMemo(() => {
    if (role === "super_admin") return new Set(PERMISSIONS.map(([key]) => key));
    const stored = supportsPermissions && Array.isArray(selected?.permissions) ? selected.permissions : PRESETS[role]?.permissions || [];
    return new Set(stored);
  }, [selected, role, supportsPermissions]);

  const visible = rows.filter((row) => !query.trim() || `${row.full_name || ""} ${row.email || ""} ${rowRole(row)}`.toLowerCase().includes(query.toLowerCase()));

  const changeRole = async (nextRole) => {
    if (!isSuperAdmin || !selected) return;
    if (["analyst", "instructor"].includes(nextRole) && !supportsAdvancedRole) {
      return setMessage(isArabic ? "قاعدة البيانات الحالية لا تحتوي حقل Role. تم الحفاظ عليها بدون أي تغيير، لذلك يمكن إدارة Member وAdmin وSuper Admin فقط بأمان." : "The current database has no role field. To preserve it unchanged, only Member, Admin and Super Admin can be persisted safely.");
    }
    const preset = PRESETS[nextRole];
    setSaving(true);
    const payload = { is_admin: preset.is_admin, is_super_admin: preset.is_super_admin };
    if (supportsAdvancedRole) payload.role = nextRole;
    if (supportsPermissions) payload.permissions = preset.permissions;
    const { error } = await supabase.from("profiles").update(payload).eq("id", selected.id);
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم تحديث الدور والصلاحيات" : "Role and permissions updated.");
    await load();
  };

  const togglePermission = async (key) => {
    if (!isSuperAdmin || !selected || !supportsPermissions || role === "super_admin") return;
    const next = new Set(permissionSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ permissions: [...next] }).eq("id", selected.id);
    setSaving(false);
    if (error) return setMessage(error.message);
    await load();
  };

  const sendInvite = async (event) => {
    event.preventDefault();
    if (!isSuperAdmin || !inviteEmail.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/login`,
        data: { full_name: inviteName.trim() || undefined, invited_by: profile.id },
      },
    });
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم إرسال رابط آمن لإنشاء الحساب. بعد تسجيل الدخول لأول مرة سيظهر المستخدم هنا لتحديد دوره." : "A secure account invitation was sent. After first sign-in, the user will appear here for role assignment.");
    setInviteEmail(""); setInviteName("");
  };

  const copySignupLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/signup`);
    setMessage(isArabic ? "تم نسخ رابط التسجيل" : "Signup link copied.");
  };

  return (
    <div className="dashboard-shell admin-shell-v21 team-admin-shell-v32">
      <DashboardHeader admin/>
      <div className="admin-workspace-v21 team-workspace-v32">
        <aside className="admin-months-v21 team-directory-v32">
          <div className="admin-profile-v21"><small>TEAM & ACCESS</small><b>{profile?.full_name || profile?.email}</b></div>
          <label className="team-search-v32"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "ابحث في الفريق" : "Search team"}/></label>
          <nav>{visible.map((row) => <button key={row.id} className={row.id === selectedId ? "active" : ""} onClick={() => { setSelectedId(row.id); setMessage(""); }}><span className="team-avatar-mini-v32">{(row.full_name || row.email || "U").slice(0,1).toUpperCase()}</span><span><b>{row.full_name || row.email}</b><small>{row.email}</small></span><em>{PRESETS[rowRole(row)]?.label}</em></button>)}</nav>
        </aside>

        <main className="admin-content-v21 team-admin-main-v32">
          <header className="admin-top-v21"><div><span className="eyebrow">RBAC CONTROL CENTRE</span><h1>{isArabic ? "الفريق والصلاحيات" : "Team, roles and permissions"}</h1><p>{isArabic ? "إدارة آمنة للأدوار الحالية بدون تغيير قاعدة البيانات أو منطق المصادقة." : "Securely manage existing roles without changing the database or authentication logic."}</p></div><span className={`status-pill ${isSuperAdmin ? "live" : "draft"}`}>{isSuperAdmin ? "SUPER ADMIN" : "READ ONLY"}</span></header>
          {message && <div className="notice-bar">{message}</div>}

          <section className="team-admin-grid-v32">
            <article className="panel-v21 padded-v21 team-invite-v32"><div className="panel-heading-v21"><div><span className="eyebrow">SECURE INVITATION</span><h2>{isArabic ? "دعوة عضو جديد" : "Invite a new team member"}</h2><p>{isArabic ? "يرسل Supabase رابط تسجيل آمن، ثم تحدد الدور بعد أول تسجيل دخول." : "Supabase sends a secure sign-in link; assign the role after the first login."}</p></div><MailPlus/></div><form onSubmit={sendInvite}><label>{isArabic ? "الاسم" : "Name"}<input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Hisham Adel"/></label><label>{isArabic ? "البريد" : "Email"}<input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="analyst@example.com"/></label><div><button className="button gold" disabled={!isSuperAdmin || saving}><MailPlus size={15}/>{isArabic ? "إرسال الدعوة" : "Send invitation"}</button><button type="button" className="button subtle" onClick={copySignupLink}><Copy size={15}/>{isArabic ? "نسخ رابط التسجيل" : "Copy signup link"}</button></div></form></article>

            {selected && <article className="panel-v21 padded-v21 team-member-card-v32"><div className="team-member-heading-v32"><span className="team-member-avatar-v32">{(selected.full_name || selected.email || "U").slice(0,2).toUpperCase()}</span><div><small>SELECTED PROFILE</small><h2>{selected.full_name || selected.email}</h2><p>{selected.email}</p></div><ShieldCheck/></div><div className="team-meta-v32"><span><small>User ID</small><b>{selected.id}</b></span><span><small>{isArabic ? "تاريخ الإنشاء" : "Created"}</small><b>{dateTimeLabel(selected.created_at, locale)}</b></span><span><small>{isArabic ? "الدور الحالي" : "Current role"}</small><b>{PRESETS[role]?.label}</b></span></div><label className="team-role-select-v32">{isArabic ? "تغيير الدور" : "Change role"}<select value={role} disabled={!isSuperAdmin || saving} onChange={(event) => changeRole(event.target.value)}><option value="member">Member</option><option value="analyst">Analyst {!supportsAdvancedRole ? "(requires role field)" : ""}</option><option value="instructor">Instructor {!supportsAdvancedRole ? "(requires role field)" : ""}</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></label></article>}

            <article className="panel-v21 padded-v21 permission-matrix-v32"><div className="panel-heading-v21"><div><span className="eyebrow">GRANULAR PERMISSIONS</span><h2>{isArabic ? "مصفوفة الصلاحيات" : "Permission matrix"}</h2><p>{supportsPermissions ? (isArabic ? "الصلاحيات المتقدمة متاحة ويمكن تعديلها." : "Advanced permission storage is available and editable.") : (isArabic ? "وضع توافق آمن: الصلاحيات مشتقة من الدور الحالي لأن قاعدة البيانات لا تحتوي حقل Permissions." : "Safe compatibility mode: permissions are derived from the existing role because the database has no permissions field.")}</p></div><KeyRound/></div><div className="permission-grid-v32">{PERMISSIONS.map(([key,label]) => <button key={key} type="button" className={permissionSet.has(key) ? "active" : ""} disabled={!isSuperAdmin || !supportsPermissions || role === "super_admin" || saving} onClick={() => togglePermission(key)}><span>{permissionSet.has(key) ? <Check/> : <Shield/>}</span><b>{label}</b><small>{permissionSet.has(key) ? "Allowed" : "Restricted"}</small></button>)}</div></article>

            <article className="panel-v21 padded-v21 team-security-note-v32"><UserCog/><div><span className="eyebrow">STABILITY GUARANTEE</span><h2>{isArabic ? "لا يوجد أي تعديل على الـBackend" : "No backend or schema changes"}</h2><p>{isArabic ? "هذه الصفحة تستخدم is_admin وis_super_admin الموجودين بالفعل. إنشاء الحساب يتم بدعوة Supabase القياسية، وأي صلاحيات متقدمة لا تُفعّل إلا لو كانت حقولها موجودة أصلًا." : "This page uses the existing is_admin and is_super_admin fields. Account creation uses Supabase's standard secure invitation flow, and advanced permissions activate only when those fields already exist."}</p></div></article>
          </section>
        </main>
      </div>
    </div>
  );
}
