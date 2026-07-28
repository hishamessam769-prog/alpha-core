export default function CompanyMark({ ticker = "AC", name = "", image, size = "medium" }) {
  const initials = String(ticker || name || "AC").slice(0, 4).toUpperCase();
  return <span className={`company-mark ${size}`} aria-label={name || ticker}>{image ? <img src={image} alt=""/> : <b>{initials}</b>}</span>;
}
