import { Link } from "react-router-dom";

export default function Brand({ to = "/" }) {
  return (
    <Link className="brand" to={to}>
      <span className="brand-symbol">AC</span>
      <span className="brand-copy">
        <strong>ALPHA CORE</strong>
        <small>PROFESSIONAL INVESTMENT INTELLIGENCE</small>
      </span>
    </Link>
  );
}
