import { useEffect, useMemo, useRef, useState } from "react";
import { BrainCircuit, BriefcaseBusiness, FileText, Newspaper, Search, Sparkles, TrendingUp, UserRound, UsersRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

const baseItems = [
  { type: "page", title: "Portfolio Terminal", subtitle: "Live performance, holdings and Alpha", path: "/dashboard", icon: BriefcaseBusiness },
  { type: "page", title: "Portfolio Library", subtitle: "All published portfolio strategies", path: "/portfolios", icon: BriefcaseBusiness },
  { type: "page", title: "Stock Recommendations", subtitle: "Independent investment calls, targets and track record", path: "/recommendations", icon: TrendingUp },
  { type: "page", title: "Alpha Apex Robo-Advisor", subtitle: "Risk profile and asset-allocation proposal", path: "/advisor", icon: BrainCircuit },
  { type: "page", title: "Personal Portfolio Journal", subtitle: "Private daily portfolio snapshots, return, volatility and drawdown", path: "/my-journal", icon: TrendingUp },
  { type: "page", title: "Research Methodology", subtitle: "How ALPHA measures performance and risk", path: "/methodology", icon: Sparkles },
  { type: "page", title: "News & Analysis", subtitle: "Market news, company updates and events", path: "/news", icon: Newspaper },
  { type: "page", title: "Weekly Reports", subtitle: "Market recap and portfolio updates", path: "/weekly-reports", icon: FileText },
  { type: "page", title: "Profile", subtitle: "Account and preferences", path: "/profile", icon: UserRound },
];

export default function GlobalSearch({ compact = false }) {
  const navigate = useNavigate();
  const { isArabic } = useLanguage();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteItems, setRemoteItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || remoteItems.length) return;
    let active = true;
    const load = async () => {
      if (!supabase) return;
      setLoading(true);
      const results = await Promise.allSettled([
        supabase.from("portfolios").select("id, name, name_ar, slug, description").eq("is_published", true),
        supabase.from("recommendations").select("id, ticker, company_name, title").eq("is_published", true),
        supabase.from("weekly_reports").select("id, slug, title, summary, week_end, created_by").eq("is_published", true),
        supabase.from("profiles").select("id, full_name, email, is_admin, is_super_admin"),
      ]);
      if (!active) return;
      const portfolios = results[0].status === "fulfilled" ? results[0].value.data || [] : [];
      const recommendations = results[1].status === "fulfilled" ? results[1].value.data || [] : [];
      const reports = results[2].status === "fulfilled" ? results[2].value.data || [] : [];
      const profiles = results[3].status === "fulfilled" ? results[3].value.data || [] : [];
      setRemoteItems([
        ...portfolios.map((item) => ({
          type: "portfolio",
          title: isArabic && item.name_ar ? item.name_ar : item.name,
          subtitle: item.description || (isArabic ? "محفظة استثمارية منشورة" : "Published investment portfolio"),
          path: `/portfolio/${item.slug}`,
          icon: BriefcaseBusiness,
        })),
        ...recommendations.map((item) => ({
          type: "recommendation",
          title: `${item.ticker} · ${item.company_name}`,
          subtitle: item.title || (isArabic ? "توصية مستقلة" : "Independent recommendation"),
          path: `/recommendations/${item.id}`,
          icon: TrendingUp,
        })),
        ...reports.map((item) => ({
          type: "report",
          title: item.title,
          subtitle: item.summary || (isArabic ? "تقرير أسبوعي" : "Weekly market report"),
          path: `/news/report/${item.id}`,
          icon: FileText,
        })),
        ...profiles.filter((item) => item.full_name).map((item) => ({
          type: "analyst",
          title: item.full_name,
          subtitle: item.is_super_admin ? "Founder & Super Admin" : item.is_admin ? "Platform Administrator" : "Platform author",
          path: `/analysts/${item.id}`,
          icon: UsersRound,
        })),
      ]);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [open, remoteItems.length, isArabic]);

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const all = [...baseItems, ...remoteItems];
    if (!normalized) return all.slice(0, 12);
    return all.filter((item) => `${item.title} ${item.subtitle} ${item.type}`.toLowerCase().includes(normalized)).slice(0, 18);
  }, [query, remoteItems]);

  const select = (path) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  return (
    <>
      <button className={`global-search-trigger ${compact ? "compact" : ""}`} type="button" onClick={() => setOpen(true)} aria-label={isArabic ? "البحث في المنصة" : "Search the platform"}>
        <Search size={16}/><span>{isArabic ? "بحث" : "Search"}</span><kbd>⌘K</kbd>
      </button>
      {open && (
        <div className="command-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="command-palette">
            <header>
              <Search size={19}/>
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isArabic ? "ابحث عن شركة أو توصية أو محفظة أو تقرير" : "Search companies, news, analysts, portfolios or reports"}/>
              <button type="button" onClick={() => setOpen(false)}><X size={17}/></button>
            </header>
            <div className="command-meta"><span>{isArabic ? "بحث شامل داخل ALPHA PLATFORM" : "Search across ALPHA PLATFORM"}</span><small>{loading ? (isArabic ? "جاري تحديث النتائج…" : "Updating results…") : `${items.length} ${isArabic ? "نتيجة" : "results"}`}</small></div>
            <div className="command-results">
              {items.map((item, index) => {
                const Icon = item.icon;
                return <button type="button" key={`${item.type}-${item.path}-${index}`} onClick={() => select(item.path)}>
                  <span className="command-icon"><Icon size={17}/></span>
                  <span><b>{item.title}</b><small>{item.subtitle}</small></span>
                  <em>{item.type}</em>
                </button>;
              })}
              {!items.length && <div className="command-empty"><Search size={30}/><b>{isArabic ? "لا توجد نتائج مطابقة" : "No matching results"}</b><span>{isArabic ? "جرّب اسم الشركة أو رمز السهم" : "Try a company name or ticker"}</span></div>}
            </div>
            <footer><span><kbd>↑</kbd><kbd>↓</kbd> {isArabic ? "للتنقل" : "navigate"}</span><span><kbd>ESC</kbd> {isArabic ? "إغلاق" : "close"}</span></footer>
          </section>
        </div>
      )}
    </>
  );
}
