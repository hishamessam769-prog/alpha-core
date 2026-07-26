import { Link } from "react-router-dom";

export default function Brand({ to = "/", compact = false }) {
  return (
    <Link className={`brand ${compact ? "compact-brand" : ""}`} to={to}>
      <span className="brand-symbol">AC</span>
      <span className="brand-copy">
        <strong>ALPHA CORE</strong>
        <small>PROFESSIONAL INVESTMENT INTELLIGENCE</small>
      </span>
    </Link>
  );
}
