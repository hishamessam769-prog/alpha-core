import { Link } from "react-router-dom";

export default function Brand({ to = "/", compact = false }) {
  return (
    <Link className={`brand ${compact ? "compact-brand" : ""}`} to={to} aria-label="ALPHA PLATFORM home">
      <span className="brand-symbol"><i/>A</span>
      <span className="brand-copy">
        <strong>ALPHA</strong>
        <small>INSTITUTIONAL INTELLIGENCE</small>
      </span>
      {!compact && <em>PLATFORM</em>}
    </Link>
  );
}
