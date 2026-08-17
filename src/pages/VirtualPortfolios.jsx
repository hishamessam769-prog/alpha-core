import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, BellRing, Check, ChevronDown, CirclePlus, Equal, Eye, EyeOff, LineChart as LineChartIcon, Pencil, Plus, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, WalletCards, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardHeader from "../components/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { formatNumber, formatPercent } from "../lib/calculations";
import { supabase } from "../lib/supabase";

const emptyEditor = { id: null, name: "", initialCapital: 1000000, benchmarkAssetId: "", holdings: [] };

function roundWeight(value) { return Math.round(Number(value || 0) * 100) / 100; }
function currency(value, locale) { return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)))} EGP`; }
function sampleStd(values) {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (values.length - 1));
}
function journalMetrics(history = []) {
  const returns = history.map((row) => Number(row.daily_return_pct)).filter((value) => Number.isFinite(value));
  const volatility = sampleStd(returns) * Math.sqrt(252);
  let peak = -Infinity;
  let maxDrawdown = 0;
  history.forEach((row) => {
    const value = Number(row.portfolio_value || 0);
    if (value > peak) peak = value;
    if (peak > 0) maxDrawdown = Math.min(maxDrawdown, ((value / peak) - 1) * 100);
  });
  const wins = returns.filter((value) => value > 0).length;
  const losses = returns.filter((value) => value < 0).length;
  return { volatility, maxDrawdown, wins, losses, winRate: wins + losses ? wins / (wins + losses) * 100 : 0 };
}
function periodMetrics(history = []) {
  if (!history.length) return { daily: 0, dailyBenchmark: 0, dailyAlpha: 0, monthly: 0, monthlyBenchmark: 0, monthlyAlpha: 0 };
  const last = history.at(-1);
  const monthKey = String(last.price_date || "").slice(0, 7);
  const monthRows = history.filter((row) => String(row.price_date || "").startsWith(monthKey));
  const firstMonth = monthRows[0] || last;
  const monthly = Number(firstMonth.portfolio_value) ? (Number(last.portfolio_value) / Number(firstMonth.portfolio_value) - 1) * 100 : 0;
  const monthlyBenchmark = Number(firstMonth.benchmark_price) ? (Number(last.benchmark_price) / Number(firstMonth.benchmark_price) - 1) * 100 : 0;
  const daily = Number(last.daily_return_pct || 0);
  const dailyBenchmark = Number(last.daily_benchmark_return_pct || 0);
  return { daily, dailyBenchmark, dailyAlpha: daily - dailyBenchmark, monthly, monthlyBenchmark, monthlyAlpha: monthly - monthlyBenchmark };
}

export default function VirtualPortfolios() {
  const { user } = useAuth();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [assets, setAssets] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [history, setHistory] = useState([]);
  const [follows, setFollows] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [editor, setEditor] = useState(emptyEditor);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [watchAssetId, setWatchAssetId] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [assetResult, portfolioResult, followsResult] = await Promise.all([
        supabase.from("master_assets").select("*").eq("is_active", true).order("asset_type").order("ticker"),
        supabase.from("user_virtual_portfolios").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("user_follows").select("*").eq("user_id", user.id),
      ]);
      const firstError = assetResult.error || portfolioResult.error || followsResult.error;
      if (firstError) throw firstError;
      const nextPortfolios = portfolioResult.data || [];
      const ids = nextPortfolios.map((item) => item.id);
      let holdingRows = [];
      let historyRows = [];
      if (ids.length) {
        const [holdingResult, historyResult] = await Promise.all([
          supabase.from("user_virtual_portfolio_holdings").select("*").in("portfolio_id", ids).order("created_at"),
          supabase.from("user_virtual_portfolio_nav_history").select("*").in("portfolio_id", ids).order("price_date", { ascending: true }),
        ]);
        if (holdingResult.error || historyResult.error) throw holdingResult.error || historyResult.error;
        holdingRows = holdingResult.data || [];
        historyRows = historyResult.data || [];
      }
      setAssets(assetResult.data || []);
      setPortfolios(nextPortfolios);
      setHoldings(holdingRows);
      setHistory(historyRows);
      setFollows(followsResult.data || []);
      setSelectedId((current) => nextPortfolios.some((item) => item.id === current) ? current : nextPortfolios[0]?.id || "");
      setMessage("");
    } catch (error) {
      setMessage(error.message || String(error));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const assetMap = useMemo(() => Object.fromEntries(assets.map((asset) => [asset.id, asset])), [assets]);
  const investableAssets = useMemo(() => assets.filter((asset) => Number(asset.current_price) > 0), [assets]);
  const benchmarks = useMemo(() => assets.filter((asset) => asset.is_benchmark && Number(asset.current_price) > 0), [assets]);
  const selected = portfolios.find((portfolio) => portfolio.id === selectedId) || portfolios[0] || null;
  const selectedHoldings = holdings.filter((holding) => holding.portfolio_id === selected?.id);
  const selectedHistory = history.filter((row) => row.portfolio_id === selected?.id).sort((a, b) => String(a.price_date).localeCompare(String(b.price_date)));
  const period = useMemo(() => periodMetrics(selectedHistory), [selectedHistory]);
  const risk = useMemo(() => journalMetrics(selectedHistory), [selectedHistory]);
  const chartData = useMemo(() => selectedHistory.map((row) => ({
    date: row.price_date,
    portfolio: Number(row.portfolio_value || 0),
    benchmark: Number(selected?.initial_capital || 0) * (1 + Number(row.benchmark_return_pct || 0) / 100),
  })), [selectedHistory, selected?.initial_capital]);
  const followKey = (type, id) => follows.some((follow) => follow.entity_type === type && follow.entity_id === id);

  const startCreate = () => {
    setEditor({ ...emptyEditor, benchmarkAssetId: benchmarks[0]?.id || "" });
    setEditing(true);
    setMessage("");
  };
  const startEdit = () => {
    if (!selected) return;
    setEditor({
      id: selected.id,
      name: selected.name,
      initialCapital: Number(selected.initial_capital || 0),
      benchmarkAssetId: selected.benchmark_asset_id,
      holdings: selectedHoldings.map((holding) => ({ asset_id: holding.asset_id, weight_pct: Number(holding.weight_pct) })),
    });
    setEditing(true);
    setMessage(isArabic ? "تعديل الأوزان يعيد نقطة بداية المحفظة الافتراضية بالسعر الحالي." : "Editing allocation resets this virtual portfolio's tracking baseline to current master prices.");
  };
  const addAsset = (assetId) => {
    if (!assetId || editor.holdings.some((item) => item.asset_id === assetId) || editor.holdings.length >= 10) return;
    setEditor((current) => ({ ...current, holdings: [...current.holdings, { asset_id: assetId, weight_pct: 0 }] }));
  };
  const removeAsset = (assetId) => setEditor((current) => ({ ...current, holdings: current.holdings.filter((item) => item.asset_id !== assetId) }));
  const setWeight = (assetId, value) => setEditor((current) => ({ ...current, holdings: current.holdings.map((item) => item.asset_id === assetId ? { ...item, weight_pct: Number(value || 0) } : item) }));
  const equalize = () => {
    const count = editor.holdings.length;
    if (!count) return;
    const base = Math.floor((100 / count) * 100) / 100;
    let allocated = 0;
    setEditor((current) => ({ ...current, holdings: current.holdings.map((item, index) => {
      const weight = index === count - 1 ? roundWeight(100 - allocated) : base;
      allocated += weight;
      return { ...item, weight_pct: weight };
    }) }));
  };
  const totalWeight = editor.holdings.reduce((sum, item) => sum + Number(item.weight_pct || 0), 0);

  const save = async () => {
    if (editor.holdings.length < 5 || editor.holdings.length > 10) return setMessage(isArabic ? "اختار من 5 إلى 10 أصول." : "Select between 5 and 10 assets.");
    if (Math.abs(totalWeight - 100) > 0.01) return setMessage(isArabic ? "إجمالي الأوزان لازم يساوي 100%." : "Weights must total exactly 100%.");
    if (!editor.benchmarkAssetId) return setMessage(isArabic ? "اختار مؤشر المقارنة." : "Choose a benchmark index.");
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("save_my_virtual_portfolio", {
        p_name: editor.name.trim() || (isArabic ? "محفظتي الافتراضية" : "My virtual portfolio"),
        p_initial_capital: Number(editor.initialCapital),
        p_benchmark_asset_id: editor.benchmarkAssetId,
        p_holdings: editor.holdings.map((item) => ({ asset_id: item.asset_id, weight_pct: Number(item.weight_pct) })),
        p_portfolio_id: editor.id || null,
      });
      if (error) throw error;
      setEditing(false);
      setSelectedId(data);
      setMessage(isArabic ? "تم حفظ المحفظة الافتراضية بأمان." : "Virtual portfolio saved securely.");
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const removePortfolio = async () => {
    if (!selected || !window.confirm(isArabic ? "حذف هذه المحفظة الافتراضية وكل تاريخها؟" : "Delete this virtual portfolio and its entire history?")) return;
    const { error } = await supabase.rpc("delete_my_virtual_portfolio", { p_portfolio_id: selected.id });
    if (error) return setMessage(error.message);
    setMessage(isArabic ? "تم حذف المحفظة." : "Portfolio deleted.");
    await load();
  };

  const toggleFollow = async (type, id) => {
    const next = !followKey(type, id);
    const { error } = await supabase.rpc("toggle_follow", { p_entity_type: type, p_entity_id: id, p_follow: next });
    if (error) return setMessage(error.message);
    setFollows((current) => next
      ? [...current, { id: `local-${type}-${id}`, user_id: user.id, entity_type: type, entity_id: id }]
      : current.filter((follow) => !(follow.entity_type === type && follow.entity_id === id)));
  };

  if (loading) return <div className="dashboard-shell"><DashboardHeader/><div className="virtual-loading-v312"><div className="loader-ring"/><span>{isArabic ? "جاري تجهيز محافظك الافتراضية…" : "Loading your virtual portfolios…"}</span></div></div>;

  return <div className="dashboard-shell virtual-portfolios-shell-v312">
    <DashboardHeader/>
    <main className="virtual-portfolios-page-v312">
      <section className="virtual-hero-v312">
        <div><span className="eyebrow">PRIVATE · VIRTUAL PORTFOLIO LAB</span><h1>{isArabic ? "ابنِ محفظتك واختبر الألفا بنفسك" : "Build your portfolio. Measure your Alpha."}</h1><p>{isArabic ? "اختار 5–10 أصول من سجل ALPHA الرئيسي، حدّد الأوزان والمؤشر، وسيتم تحديث الأداء تلقائيًا مع كل Master Price Import." : "Select 5–10 assets from ALPHA's master registry, set weights and a benchmark, then let every Master Price Import refresh your private performance automatically."}</p></div>
        <button className="button primary" onClick={startCreate}><CirclePlus size={17}/>{isArabic ? "محفظة افتراضية جديدة" : "New virtual portfolio"}</button>
      </section>

      <section className="notification-routing-note-v312"><BellRing/><div><b>{isArabic ? "إشعارات بدون إزعاج" : "Notifications without the noise"}</b><p>{isArabic ? "هيوصلك فقط تحديث محفظتك الخاصة، أو أي محفظة عامة / سهم / توصية تعمل لها Follow. الإعلانات العامة المهمة فقط تظل للجميع." : "You only get alerts for your own private portfolios or public portfolios, assets and recommendations you explicitly follow. Important platform-wide announcements still reach everyone."}</p></div></section>
      <section className="asset-watchlist-v312 panel-v21"><div><span className="eyebrow">ASSET FOLLOWING</span><h2>{isArabic ? "قائمة متابعة الأصول" : "Asset watchlist"}</h2><p>{isArabic ? "تابع أي سهم أو صندوق أو مؤشر من السجل الرئيسي حتى لو مش موجود داخل محفظتك الافتراضية." : "Follow any stock, fund or index from the master registry—even when it is not in your virtual portfolio."}</p></div><div className="asset-watchlist-controls-v312"><select value={watchAssetId} onChange={(event) => setWatchAssetId(event.target.value)}><option value="">{isArabic ? "اختر أصلًا…" : "Choose an asset…"}</option>{assets.filter((asset) => !followKey("asset", asset.id)).map((asset) => <option key={asset.id} value={asset.id}>{asset.ticker} · {isArabic && asset.display_name_ar ? asset.display_name_ar : asset.display_name}</option>)}</select><button className="button subtle" disabled={!watchAssetId} onClick={async () => { await toggleFollow("asset", watchAssetId); setWatchAssetId(""); }}><Eye size={15}/>{isArabic ? "متابعة" : "Follow asset"}</button></div><div className="asset-watchlist-chips-v312">{follows.filter((follow) => follow.entity_type === "asset").map((follow) => { const asset=assetMap[follow.entity_id]; return asset ? <button key={follow.id} onClick={() => toggleFollow("asset", follow.entity_id)}><span>{asset.ticker}</span><X size={12}/></button> : null; })}{!follows.some((follow) => follow.entity_type === "asset") && <small>{isArabic ? "لا توجد أصول في قائمة المتابعة حتى الآن." : "No followed assets yet."}</small>}</div></section>
      {message && <div className="notice-bar">{message}</div>}

      {editing && <section className="virtual-editor-v312 panel-v21">
        <header><div><span className="eyebrow">PORTFOLIO BUILDER</span><h2>{editor.id ? (isArabic ? "إعادة ضبط المحفظة" : "Reset portfolio allocation") : (isArabic ? "إنشاء محفظة خاصة" : "Create private portfolio")}</h2></div><button className="icon-button-v312" onClick={() => setEditing(false)}><X/></button></header>
        <div className="virtual-editor-grid-v312">
          <label>{isArabic ? "اسم المحفظة" : "Portfolio name"}<input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder={isArabic ? "مثال: محفظة النمو الخاصة بي" : "e.g. My Growth Portfolio"}/></label>
          <label>{isArabic ? "رأس المال الافتراضي" : "Virtual starting capital"}<input type="number" min="1" value={editor.initialCapital} onChange={(event) => setEditor({ ...editor, initialCapital: event.target.value })}/></label>
          <label>{isArabic ? "مؤشر المقارنة" : "Benchmark index"}<select value={editor.benchmarkAssetId} onChange={(event) => setEditor({ ...editor, benchmarkAssetId: event.target.value })}><option value="">—</option>{benchmarks.map((asset) => <option key={asset.id} value={asset.id}>{asset.ticker} · {isArabic && asset.display_name_ar ? asset.display_name_ar : asset.display_name}</option>)}</select></label>
          <label>{isArabic ? "إضافة أصل" : "Add asset"}<select value="" onChange={(event) => addAsset(event.target.value)} disabled={editor.holdings.length >= 10}><option value="">{isArabic ? "اختر من السجل الرئيسي…" : "Choose from master registry…"}</option>{investableAssets.filter((asset) => !editor.holdings.some((holding) => holding.asset_id === asset.id)).map((asset) => <option key={asset.id} value={asset.id}>{asset.ticker} · {asset.display_name}</option>)}</select></label>
        </div>
        <div className="virtual-builder-toolbar-v312"><span className={Math.abs(totalWeight - 100) < .01 ? "positive" : "negative"}>{isArabic ? "إجمالي الأوزان" : "Total weight"}: <b>{totalWeight.toFixed(2)}%</b></span><span>{editor.holdings.length}/10 {isArabic ? "أصول" : "assets"}</span><button className="button subtle" onClick={equalize} disabled={!editor.holdings.length}><Equal size={16}/>{isArabic ? "توزيع متساوي" : "Equalize Weights"}</button></div>
        <div className="virtual-weight-grid-v312">{editor.holdings.map((holding) => { const asset = assetMap[holding.asset_id]; return <article key={holding.asset_id}><div><b>{asset?.ticker}</b><small>{asset?.display_name}</small></div><label><input type="number" min="0" max="100" step="0.01" value={holding.weight_pct} onChange={(event) => setWeight(holding.asset_id, event.target.value)}/><span>%</span></label><button onClick={() => removeAsset(holding.asset_id)}><Trash2 size={15}/></button></article>; })}{!editor.holdings.length && <div className="virtual-empty-builder-v312"><Plus/><span>{isArabic ? "أضف من 5 إلى 10 أصول للبدء." : "Add 5 to 10 assets to begin."}</span></div>}</div>
        <footer><button className="button primary" onClick={save} disabled={saving}><Save size={16}/>{saving ? (isArabic ? "جاري الحفظ…" : "Saving…") : (isArabic ? "حفظ المحفظة" : "Save portfolio")}</button></footer>
      </section>}

      {!portfolios.length ? <section className="virtual-empty-v312"><WalletCards/><h2>{isArabic ? "لسه ما أنشأتش محفظة افتراضية" : "No virtual portfolios yet"}</h2><p>{isArabic ? "ابدأ بخمسة أصول، جرّب توزيع متساوي أو أوزانك الخاصة، واختار EGX30 أو EGX70 كمؤشر." : "Start with five assets, use equal weights or your own allocation, and choose EGX30 or EGX70 as benchmark."}</p><button className="button primary" onClick={startCreate}>{isArabic ? "ابدأ الآن" : "Build one now"}</button></section> : <>
        <section className="virtual-portfolio-switcher-v312">{portfolios.map((portfolio) => <button key={portfolio.id} onClick={() => setSelectedId(portfolio.id)} className={selected?.id === portfolio.id ? "active" : ""}><span>{portfolio.name}</span><b className={Number(portfolio.alpha_pct) >= 0 ? "positive" : "negative"}>{formatPercent(portfolio.alpha_pct)}</b></button>)}</section>

        <section className="virtual-summary-v312">
          <article className="virtual-main-card-v312"><div><span className="eyebrow">PRIVATE PORTFOLIO</span><h2>{selected.name}</h2><p>{isArabic ? "القيمة الحالية محسوبة من عدد الوحدات الافتراضية × آخر سعر في Master Asset Registry." : "Current NAV is calculated from virtual shares × the latest Master Asset Registry price."}</p></div><strong>{currency(selected.current_value, locale)}</strong><div className="virtual-card-actions-v312"><button className="button subtle" onClick={startEdit}><Pencil size={15}/>{isArabic ? "تعديل / إعادة موازنة" : "Edit / rebalance"}</button><button className="button danger" onClick={removePortfolio}><Trash2 size={15}/>{isArabic ? "حذف" : "Delete"}</button></div></article>
          <div className="virtual-kpis-v312">
            <article><small>{isArabic ? "العائد منذ البداية" : "Inception return"}</small><b className={Number(selected.current_return_pct) >= 0 ? "positive" : "negative"}>{formatPercent(selected.current_return_pct)}</b></article>
            <article><small>{`${assetMap[selected.benchmark_asset_id]?.ticker || "Benchmark"} · ${isArabic ? "منذ البداية" : "inception"}`}</small><b className={Number(selected.benchmark_return_pct) >= 0 ? "positive" : "negative"}>{formatPercent(selected.benchmark_return_pct)}</b></article>
            <article className="alpha"><small>{isArabic ? "ألفا منذ البداية" : "Inception Alpha"}</small><b className={Number(selected.alpha_pct) >= 0 ? "positive" : "negative"}>{formatPercent(selected.alpha_pct)}</b></article>
            <article><small>{isArabic ? "عائد اليوم" : "Daily portfolio"}</small><b className={period.daily >= 0 ? "positive" : "negative"}>{formatPercent(period.daily)}</b></article>
            <article><small>{isArabic ? "مؤشر اليوم" : "Daily benchmark"}</small><b className={period.dailyBenchmark >= 0 ? "positive" : "negative"}>{formatPercent(period.dailyBenchmark)}</b></article>
            <article className="alpha"><small>{isArabic ? "ألفا اليوم" : "Daily Alpha"}</small><b className={period.dailyAlpha >= 0 ? "positive" : "negative"}>{formatPercent(period.dailyAlpha)}</b></article>
            <article><small>{isArabic ? "عائد الشهر" : "Monthly portfolio"}</small><b className={period.monthly >= 0 ? "positive" : "negative"}>{formatPercent(period.monthly)}</b></article>
            <article><small>{isArabic ? "مؤشر الشهر" : "Monthly benchmark"}</small><b className={period.monthlyBenchmark >= 0 ? "positive" : "negative"}>{formatPercent(period.monthlyBenchmark)}</b></article>
            <article className="alpha"><small>{isArabic ? "ألفا الشهر" : "Monthly Alpha"}</small><b className={period.monthlyAlpha >= 0 ? "positive" : "negative"}>{formatPercent(period.monthlyAlpha)}</b></article>
          </div>
        </section>

        <section className="virtual-chart-risk-grid-v312">
          <article className="panel-v21 virtual-chart-card-v312"><header><div><span className="eyebrow">PERFORMANCE CURVE</span><h2>{isArabic ? "المحفظة مقابل المؤشر" : "Portfolio vs benchmark"}</h2></div><LineChartIcon/></header><div className="virtual-chart-v312"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="virtualPortfolioFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20d3ff" stopOpacity={.30}/><stop offset="100%" stopColor="#20d3ff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(148,163,184,.10)" vertical={false}/><XAxis dataKey="date" stroke="#72839a" tick={{ fontSize: 10 }} minTickGap={30}/><YAxis stroke="#72839a" tick={{ fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value)}/><Tooltip contentStyle={{ background: "#091827", border: "1px solid #1f3446", borderRadius: 12 }} formatter={(value) => currency(value, locale)}/><Area type="monotone" dataKey="portfolio" stroke="#20d3ff" fill="url(#virtualPortfolioFill)" strokeWidth={2.5}/><Area type="monotone" dataKey="benchmark" stroke="#8b5cf6" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></article>
          <article className="panel-v21 virtual-risk-card-v312"><span className="eyebrow">JOURNAL METRICS</span><h2>{isArabic ? "المخاطر والانضباط" : "Risk & consistency"}</h2><div><span><small>{isArabic ? "التذبذب السنوي" : "Annualized volatility"}</small><b>{formatPercent(risk.volatility)}</b></span><span><small>{isArabic ? "أقصى هبوط" : "Max drawdown"}</small><b className="negative">{formatPercent(risk.maxDrawdown)}</b></span><span><small>{isArabic ? "أيام رابحة" : "Winning days"}</small><b>{risk.wins}</b></span><span><small>{isArabic ? "نسبة الفوز" : "Win rate"}</small><b>{formatPercent(risk.winRate)}</b></span></div></article>
        </section>

        <section className="panel-v21 virtual-holdings-v312"><header><div><span className="eyebrow">CURRENT ALLOCATION</span><h2>{isArabic ? "الأصول والأوزان" : "Holdings & weights"}</h2></div><span>{selectedHoldings.length} {isArabic ? "أصول" : "assets"}</span></header><div className="table-scroll"><table className="data-table-v21"><thead><tr><th>Ticker</th><th>{isArabic ? "الوزن الأصلي" : "Initial weight"}</th><th>{isArabic ? "سعر البداية" : "Entry"}</th><th>{isArabic ? "السعر الحالي" : "Current"}</th><th>{isArabic ? "العائد" : "Return"}</th><th>{isArabic ? "القيمة الحالية" : "Current value"}</th><th>{isArabic ? "متابعة" : "Follow"}</th></tr></thead><tbody>{selectedHoldings.map((holding) => { const asset=assetMap[holding.asset_id]; const price=Number(asset?.current_price || holding.entry_price); const ret=(price/Number(holding.entry_price)-1)*100; const value=Number(holding.shares)*price; const followed=followKey("asset",holding.asset_id); return <tr key={holding.id}><td><b className="ticker-chip">{asset?.ticker || "—"}</b><small>{asset?.display_name}</small></td><td>{formatPercent(holding.weight_pct)}</td><td>{formatNumber(holding.entry_price,2,locale)}</td><td>{formatNumber(price,2,locale)}</td><td className={ret>=0?"positive":"negative"}>{formatPercent(ret)}</td><td>{currency(value,locale)}</td><td><button className={`follow-mini-v312 ${followed?"active":""}`} onClick={() => toggleFollow("asset",holding.asset_id)}>{followed?<><EyeOff size={14}/>{isArabic?"إلغاء":"Following"}</>:<><Eye size={14}/>{isArabic?"تابع":"Follow"}</>}</button></td></tr>; })}</tbody></table></div></section>
      </>}
    </main>
  </div>;
}
