export const ROLE_PRESETS = {
  member: {
    label: "Member",
    title: "Platform Member",
    isAdmin: false,
    permissions: ["view_published"],
  },
  contributor: {
    label: "Contributor",
    title: "Market Contributor",
    isAdmin: true,
    permissions: ["view_published", "publish_articles", "publish_updates", "edit_own_content"],
  },
  analyst: {
    label: "Analyst",
    title: "Investment Analyst",
    isAdmin: true,
    permissions: ["view_published", "manage_portfolios", "manage_recommendations", "publish_articles", "publish_updates", "edit_own_content"],
  },
  instructor: {
    label: "Instructor",
    title: "Research Instructor",
    isAdmin: true,
    permissions: ["view_published", "manage_portfolios", "manage_recommendations", "manage_reports", "publish_articles", "publish_updates", "edit_own_content"],
  },
  admin: {
    label: "Admin",
    title: "Platform Administrator",
    isAdmin: true,
    permissions: [
      "view_published",
      "manage_portfolios",
      "manage_recommendations",
      "manage_reports",
      "publish_articles",
      "publish_updates",
      "publish_content",
      "support_inbox",
      "manage_settings",
    ],
  },
  super_admin: {
    label: "Super Admin",
    title: "Founder & Super Admin",
    isAdmin: true,
    permissions: ["all"],
  },
};

const ROLE_ORDER = ["super_admin", "admin", "analyst", "instructor", "contributor", "member"];

function normaliseText(value) {
  return String(value || "").trim().toLowerCase();
}

export function deriveRole(profile) {
  if (!profile) return "member";
  if (profile.is_super_admin) return "super_admin";
  if (!profile.is_admin) return "member";

  // The protected admin flag is always required. Existing installations may
  // already have either a dedicated role field or a title/position field, so
  // we support both without adding or altering database columns.
  const explicit = normaliseText(profile.role);
  if (explicit && explicit !== "super_admin" && ROLE_PRESETS[explicit]) return explicit;

  const descriptor = `${normaliseText(profile.title)} ${normaliseText(profile.position)}`;
  if (/investment\s*analyst|\banalyst\b/.test(descriptor)) return "analyst";
  if (/instructor|educator|research\s*lead/.test(descriptor)) return "instructor";
  if (/contributor|writer|editor|correspondent/.test(descriptor)) return "contributor";
  return "admin";
}

export function permissionSet(profile) {
  const role = deriveRole(profile);
  if (role === "super_admin") return new Set(["all"]);
  if (role === "member") return new Set(ROLE_PRESETS.member.permissions);
  const stored = profile?.permissions;
  if (Array.isArray(stored)) return new Set(stored.filter(Boolean));
  if (stored && typeof stored === "object") {
    return new Set(Object.entries(stored).filter(([, enabled]) => Boolean(enabled)).map(([key]) => key));
  }
  return new Set(ROLE_PRESETS[role]?.permissions || ROLE_PRESETS.member.permissions);
}

export function hasPermission(profile, permission) {
  if (!permission) return true;
  const permissions = permissionSet(profile);
  return permissions.has("all") || permissions.has(permission);
}

export function hasAnyPermission(profile, permissions = []) {
  return permissions.some((permission) => hasPermission(profile, permission));
}

export function canAccessCreatorStudio(profile) {
  if (!profile?.is_admin && !profile?.is_super_admin) return false;
  return hasAnyPermission(profile, ["publish_articles", "publish_updates", "manage_portfolios", "manage_recommendations", "manage_reports"]);
}

export function canAccessAdmin(profile) {
  return Boolean(profile?.is_admin || profile?.is_super_admin);
}

export function workspaceRoute(profile) {
  const role = deriveRole(profile);
  return ["analyst", "instructor", "contributor"].includes(role) ? "/admin/publishing" : "/admin";
}

export function roleLabel(profile) {
  const role = deriveRole(profile);
  return ROLE_PRESETS[role]?.label || ROLE_PRESETS.member.label;
}

export function roleTitle(profile) {
  const role = deriveRole(profile);
  return profile?.title || profile?.position || ROLE_PRESETS[role]?.title || ROLE_PRESETS.member.title;
}

export function supportedProfileFields(profile) {
  const fields = new Set(Object.keys(profile || {}));
  return {
    role: fields.has("role"),
    permissions: fields.has("permissions"),
    title: fields.has("title"),
    position: fields.has("position"),
    bio: fields.has("bio"),
    avatar: fields.has("avatar_url") || fields.has("photo_url") || fields.has("profile_picture"),
  };
}

export function rolePayload(profile, nextRole, customPermissions) {
  const preset = ROLE_PRESETS[nextRole] || ROLE_PRESETS.member;
  const supported = supportedProfileFields(profile);
  const payload = {
    is_admin: Boolean(preset.isAdmin),
    is_super_admin: nextRole === "super_admin",
  };
  if (supported.role) payload.role = nextRole;
  if (supported.permissions) payload.permissions = Array.isArray(customPermissions) ? customPermissions : preset.permissions;
  if (supported.title) payload.title = preset.title;
  else if (supported.position) payload.position = preset.title;
  return payload;
}

export function roleRank(profile) {
  const role = deriveRole(profile);
  return ROLE_ORDER.indexOf(role);
}
