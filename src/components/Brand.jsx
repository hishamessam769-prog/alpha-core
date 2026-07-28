import { Link } from "react-router-dom";
import { usePlatformSettings } from "../context/SettingsContext";

export default function Brand({ to = "/", compact = false, staticMode = false }) {
  const { settings } = usePlatformSettings();
  const content = (
    <>
      <span className={`brand-symbol ${settings.logo_url ? "has-logo" : ""}`}>{settings.logo_url ? <img src={settings.logo_url} alt="ALPHA PLATFORM" crossOrigin="anonymous"/> : <><i/>A</>}</span>
      <span className="brand-copy"><strong>ALPHA</strong><small>INSTITUTIONAL INTELLIGENCE</small></span>
      {!compact && <em>PLATFORM</em>}
    </>
  );
  if (staticMode) return <span className={`brand brand-static ${compact ? "compact-brand" : ""}`}>{content}</span>;
  return <Link className={`brand ${compact ? "compact-brand" : ""}`} to={to} aria-label="ALPHA PLATFORM home">{content}</Link>;
}
