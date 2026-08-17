import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CircleDollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatNumber, formatPercent } from "../lib/calculations";

const ticks = [
  { ticker: "COMI", value: "+1.84%", tone: "up" },
  { ticker: "TMGH", value: "+0.92%", tone: "up" },
  { ticker: "EGX30", value: "+0.47%", tone: "up" },
  { ticker: "USD/EGP", value: "48.61", tone: "flat" },
  { ticker: "RAYA", value: "-0.36%", tone: "down" },
];

export default function MarketGraphic({ compact = false, label = "ALPHA MARKET PULSE" }) {
  return (
    <div className={`market-graphic-v32 market-graphic-v33 ${compact ? "compact" : ""}`} aria-hidden="true">
      <div className="market-grid-v32" />
      <div className="market-aurora-v33"/>
      <div className="market-orbit-v32 orbit-one"><Activity/></div>
      <div className="market-orbit-v32 orbit-two"><BarChart3/></div>
      <div className="market-orbit-v32 orbit-three"><CircleDollarSign/></div>
      <div className="floating-tickers-v33">{ticks.map((tick, index) => <span key={tick.ticker} className={tick.tone} style={{ "--ticker-index": index }}><b>{tick.ticker}</b><em>{tick.value}</em></span>)}</div>
      <svg viewBox="0 0 720 360" role="img">
        <defs>
          <linearGradient id="alphaLineV33" x1="0" x2="1"><stop offset="0" stopColor="#20d3ff" stopOpacity=".18"/><stop offset=".5" stopColor="#20d3ff"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient>
          <linearGradient id="alphaAreaV33" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#20d3ff" stopOpacity=".32"/><stop offset=".65" stopColor="#8b5cf6" stopOpacity=".1"/><stop offset="1" stopColor="#20d3ff" stopOpacity="0"/></linearGradient>
          <filter id="alphaGlowV33"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path className="market-area-path-v32" d="M22 300 C90 288, 120 250, 184 262 S288 202, 350 217 S452 144, 515 161 S622 78, 698 90 L698 335 L22 335 Z" fill="url(#alphaAreaV33)"/>
        <path className="market-line-path-v32" d="M22 300 C90 288, 120 250, 184 262 S288 202, 350 217 S452 144, 515 161 S622 78, 698 90" fill="none" stroke="url(#alphaLineV33)" strokeWidth="5" strokeLinecap="round" filter="url(#alphaGlowV33)"/>
        {[184,350,515,698].map((x, index) => <circle key={x} className={`market-dot-v32 dot-${index + 1}`} cx={x} cy={[262,217,161,90][index]} r="7" fill="#09101b" stroke={index === 3 ? "#8b5cf6" : "#20d3ff"} strokeWidth="4"/>)}
      </svg>
      <div className="market-graphic-caption-v32"><TrendingUp/><span>{label}</span><b>LIVE ALPHA</b></div>
    </div>
  );
}


const homepageIndexOrder = [
  { tickers: ["EGX30"], label: "EGX 30", labelAr: "التلاتيني" },
  { tickers: ["EGX30CAP", "EGX30CAPPED"], label: "EGX 30 Capped", labelAr: "التلاتيني كابد" },
  { tickers: ["EGX70"], label: "EGX 70", labelAr: "السبعيني" },
  { tickers: ["EGX100"], label: "EGX 100", labelAr: "المئوي" },
];

export function MarketIndicesBar({ isArabic = false, locale = "en-GB" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const requested = homepageIndexOrder.flatMap((item) => item.tickers);
        const { data, error } = await supabase.from("master_assets").select("ticker,display_name,display_name_ar,current_price,price_date,daily_change_pct,is_active,is_benchmark,asset_type").in("ticker", requested).eq("is_active", true);
        if (error) throw error;
        if (active) setRows(data || []);
      } catch (error) {
        console.error("Market indices bar failed", error);
        if (active) setRows([]);
      } finally { if (active) setLoading(false); }
    };
    void load();
    const channel = supabase.channel("homepage-market-indices-v313").on("postgres_changes", { event: "*", schema: "public", table: "master_assets" }, load).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  const items = useMemo(() => homepageIndexOrder.map((definition) => {
    const row = definition.tickers.map((ticker) => rows.find((item) => String(item.ticker).toUpperCase() === ticker)).find(Boolean);
    return { ...definition, row };
  }), [rows]);

  return <section className="market-indices-bar-v313" aria-label={isArabic ? "مؤشرات البورصة المصرية" : "Egyptian market indices"}>
    <div className="market-indices-label-v313"><span className="live-dot"/><b>{isArabic ? "نبض السوق" : "MARKET PULSE"}</b><small>{isArabic ? "آخر تحديث متاح" : "LATEST AVAILABLE"}</small></div>
    <div className="market-indices-grid-v313">{items.map((item) => {
      const change = Number(item.row?.daily_change_pct || 0);
      const positive = change >= 0;
      return <article key={item.label} className={item.row ? "ready" : "empty"}>
        <div><b>{item.label}</b><small>{isArabic ? item.labelAr : (item.row?.display_name || item.label)}</small></div>
        <strong>{loading ? "…" : item.row?.current_price == null ? "—" : formatNumber(item.row.current_price, 2, locale)}</strong>
        <span className={positive ? "positive" : "negative"}>{positive ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} {item.row ? formatPercent(change) : "—"}</span>
      </article>;
    })}</div>
  </section>;
}
