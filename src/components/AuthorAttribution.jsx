import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export function authorDisplay(profile, fallback = {}) {
  const fullName = profile?.full_name || fallback.full_name || fallback.name || "ALPHA Investment Committee";
  const role = profile?.title || profile?.position || fallback.title || (profile?.is_super_admin ? "Founder & Super Admin" : profile?.is_admin ? "Platform Administrator" : "Investment Analyst");
  const avatar = profile?.avatar_url || profile?.photo_url || profile?.profile_picture || fallback.avatar || "";
  const bio = profile?.bio || fallback.bio || "Research and portfolio intelligence published through ALPHA PLATFORM.";
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AP";
  return { fullName, role, avatar, bio, initials };
}

export default function AuthorAttribution({ profile, authorId, compact = false, label, fallback }) {
  const author = authorDisplay(profile, fallback);
  const content = (
    <>
      <span className="author-avatar-v32">{author.avatar ? <img src={author.avatar} alt=""/> : author.initials}</span>
      <span className="author-copy-v32"><small>{label || "PUBLISHED BY"}</small><b>{author.fullName}</b><em>{author.role}</em></span>
      {authorId ? <ArrowUpRight size={15}/> : <ShieldCheck size={15}/>} 
    </>
  );
  return authorId
    ? <Link className={`author-attribution-v32 ${compact ? "compact" : ""}`} to={`/analysts/${authorId}`}>{content}</Link>
    : <div className={`author-attribution-v32 ${compact ? "compact" : ""}`}>{content}</div>;
}
