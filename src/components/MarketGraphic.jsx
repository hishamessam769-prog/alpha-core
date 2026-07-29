import { Activity, BarChart3, CircleDollarSign, TrendingUp } from "lucide-react";

export default function MarketGraphic({ compact = false, label = "ALPHA MARKET PULSE" }) {
  return (
    <div className={`market-graphic-v32 ${compact ? "compact" : ""}`} aria-hidden="true">
      <div className="market-grid-v32" />
      <div className="market-orbit-v32 orbit-one"><Activity/></div>
      <div className="market-orbit-v32 orbit-two"><BarChart3/></div>
      <div className="market-orbit-v32 orbit-three"><CircleDollarSign/></div>
      <svg viewBox="0 0 720 360" role="img">
        <defs>
          <linearGradient id="alphaLine" x1="0" x2="1">
            <stop offset="0" stopColor="#3aa8ff" stopOpacity=".15"/>
            <stop offset=".48" stopColor="#3aa8ff"/>
            <stop offset="1" stopColor="#d6b15f"/>
          </linearGradient>
          <linearGradient id="alphaArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3aa8ff" stopOpacity=".28"/>
            <stop offset="1" stopColor="#3aa8ff" stopOpacity="0"/>
          </linearGradient>
          <filter id="alphaGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path className="market-area-path-v32" d="M22 300 C90 288, 120 250, 184 262 S288 202, 350 217 S452 144, 515 161 S622 78, 698 90 L698 335 L22 335 Z" fill="url(#alphaArea)"/>
        <path className="market-line-path-v32" d="M22 300 C90 288, 120 250, 184 262 S288 202, 350 217 S452 144, 515 161 S622 78, 698 90" fill="none" stroke="url(#alphaLine)" strokeWidth="5" strokeLinecap="round" filter="url(#alphaGlow)"/>
        {[184,350,515,698].map((x, index) => <circle key={x} className={`market-dot-v32 dot-${index + 1}`} cx={x} cy={[262,217,161,90][index]} r="7" fill="#0b0f14" stroke={index === 3 ? "#d6b15f" : "#3aa8ff"} strokeWidth="4"/>)}
      </svg>
      <div className="market-graphic-caption-v32"><TrendingUp/><span>{label}</span><b>+ALPHA</b></div>
    </div>
  );
}
