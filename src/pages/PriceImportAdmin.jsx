import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Layers3, RefreshCw, UploadCloud, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import DashboardHeader from "../components/DashboardHeader";
import { useLanguage } from "../context/LanguageContext";
import { formatNumber } from "../lib/calculations";
import { supabase } from "../lib/supabase";
import { dispatchQueuedPushNotifications } from "../lib/pushNotifications";

const aliases = {
  ticker: ["ticker", "symbol", "code", "اسم السهم", "رمز السهم", "الرمز"],
  company: ["company", "company name", "name", "اسم الشركة"],
  close: ["close", "close price", "price", "last", "last price", "closing price", "سعر الإغلاق", "السعر", "آخر سعر"],
  date: ["date", "price date", "closing date", "التاريخ", "تاريخ السعر"],
};

const cleanKey = (value) => String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const cleanTicker = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

function findValue(row, keys) {
  const entries = Object.entries(row).map(([key, value]) => [cleanKey(key), value]);
  for (const alias of keys) {
    const found = entries.find(([key]) => key === alias || key.includes(alias));
    if (found) return found[1];
  }
  return undefined;
}

function normaliseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value || "").trim();
  if (!text) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function normalisePrice(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/,/g, "").replace(/[^0-9.-]/g, "");
  return Number(cleaned);
}

function normaliseRow(row, index) {
  const ticker = cleanTicker(findValue(row, aliases.ticker));
  const close = normalisePrice(findValue(row, aliases.close));
  const date = normaliseDate(findValue(row, aliases.date));
  const company = String(findValue(row, aliases.company) || "").trim();
  const errors = [];
  if (!ticker) errors.push("Missing ticker");
  if (!Number.isFinite(close) || close < 0) errors.push("Invalid close price");
  return { row: index + 2, ticker, company_name: company || null, close_price: close, price_date: date, errors };
}

function addTicker(target, tickerValue, details = {}) {
  const ticker = cleanTicker(tickerValue);
  if (!ticker) return;
  const existing = target.get(ticker) || { ticker, company_name: "", current_price: "", price_date: "", used_in: new Set() };
  if (details.company_name && !existing.company_name) existing.company_name = details.company_name;
  if (Number.isFinite(Number(details.current_price))) existing.current_price = Number(details.current_price);
  if (details.price_date) existing.price_date = details.price_date;
  if (details.used_in) existing.used_in.add(details.used_in);
  target.set(ticker, existing);
}

export default function PriceImportAdmin() {
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTickers, setActiveTickers] = useState([]);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  const validRows = useMemo(() => rows.filter((row) => !row.errors.length), [rows]);
  const invalidRows = useMemo(() => rows.filter((row) => row.errors.length), [rows]);
  const uniqueValidRows = useMemo(() => {
    const byTicker = new Map();
    validRows.forEach((row) => byTicker.set(row.ticker, row));
    return [...byTicker.values()];
  }, [validRows]);
  const duplicateRows = validRows.length - uniqueValidRows.length;

  const loadActiveTickers = async () => {
    setLoadingTemplate(true);
    try {
      const [monthsResult, recommendationsResult, pricesResult] = await Promise.all([
        supabase.from("strategy_months").select("id, month_key, is_closed, benchmark_ticker, holdings(ticker)").eq("is_closed", false),
        supabase.from("recommendations").select("ticker, company_name, status, benchmark_ticker").in("status", ["draft", "open"]),
        supabase.from("market_prices").select("ticker, company_name, close_price, price_date"),
      ]);
      const error = monthsResult.error || recommendationsResult.error || pricesResult.error;
      if (error) throw error;

      const priceMap = new Map((pricesResult.data || []).map((item) => [cleanTicker(item.ticker), item]));
      const tickerMap = new Map();

      (monthsResult.data || []).forEach((month) => {
        (month.holdings || []).forEach((holding) => {
          const price = priceMap.get(cleanTicker(holding.ticker));
          addTicker(tickerMap, holding.ticker, { company_name: price?.company_name, current_price: price?.close_price, price_date: price?.price_date, used_in: `Portfolio · ${month.month_key || "Open month"}` });
        });
        const benchmarkPrice = priceMap.get(cleanTicker(month.benchmark_ticker));
        addTicker(tickerMap, month.benchmark_ticker, { company_name: benchmarkPrice?.company_name || "Benchmark", current_price: benchmarkPrice?.close_price, price_date: benchmarkPrice?.price_date, used_in: "Benchmark" });
      });

      (recommendationsResult.data || []).forEach((recommendation) => {
        const price = priceMap.get(cleanTicker(recommendation.ticker));
        addTicker(tickerMap, recommendation.ticker, { company_name: recommendation.company_name || price?.company_name, current_price: price?.close_price, price_date: price?.price_date, used_in: "Independent recommendation" });
        const benchmarkPrice = priceMap.get(cleanTicker(recommendation.benchmark_ticker));
        addTicker(tickerMap, recommendation.benchmark_ticker, { company_name: benchmarkPrice?.company_name || "Benchmark", current_price: benchmarkPrice?.close_price, price_date: benchmarkPrice?.price_date, used_in: "Benchmark" });
      });

      setActiveTickers([...tickerMap.values()].map((item) => ({ ...item, used_in: [...item.used_in].join(" | ") })).sort((a, b) => a.ticker.localeCompare(b.ticker)));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoadingTemplate(false);
    }
  };

  useEffect(() => { loadActiveTickers(); }, []);

  const downloadSmartTemplate = () => {
    if (!activeTickers.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const sheetRows = activeTickers.map((item) => ({
      Ticker: item.ticker,
      Company: item.company_name || "",
      Close: item.current_price === "" ? "" : item.current_price,
      Date: item.price_date || today,
      "Used In": item.used_in,
    }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    sheet["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 54 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "All Active Tickers");
    XLSX.writeFile(workbook, `alpha-platform-all-active-tickers-${today}.xlsx`);
  };

  const readFile = async (file) => {
    setMessage("");
    setResult(null);
    setFileName(file?.name || "");
    if (!file) return setRows([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: true });
      const normalised = raw.map(normaliseRow);
      setRows(normalised);
      if (!normalised.length) setMessage(isArabic ? "الملف لا يحتوي على بيانات" : "The file contains no data rows.");
    } catch (error) {
      setRows([]);
      setMessage(error.message);
    }
  };

  const importPrices = async () => {
    if (!uniqueValidRows.length || importing) return;
    setImporting(true);
    setMessage(isArabic ? "جاري تحديث قاعدة الأسعار وكل السجلات المفتوحة…" : "Updating the price master and every open record…");
    setResult(null);
    try {
      const now = new Date().toISOString();
      const templateMap = new Map(activeTickers.map((item) => [item.ticker, item]));
      const latestPayload = uniqueValidRows.map((row) => ({
        ticker: row.ticker,
        company_name: row.company_name || templateMap.get(row.ticker)?.company_name || null,
        close_price: Number(row.close_price),
        price_date: row.price_date,
        source: fileName || "Excel upload",
        updated_at: now,
      }));
      const historyPayload = uniqueValidRows.map((row) => ({ ticker: row.ticker, close_price: Number(row.close_price), price_date: row.price_date, source: fileName || "Excel upload" }));

      const { error: latestError } = await supabase.from("market_prices").upsert(latestPayload, { onConflict: "ticker" });
      if (latestError) throw latestError;
      const { error: historyError } = await supabase.from("price_history").upsert(historyPayload, { onConflict: "ticker,price_date" });
      if (historyError) throw historyError;
      const { data: applied, error: applyError } = await supabase.rpc("apply_latest_market_prices");
      if (applyError) throw applyError;
      const { error: queueError } = await supabase.rpc("queue_daily_performance_notifications");
      if (queueError) console.warn("Daily push queue was not created", queueError);
      void dispatchQueuedPushNotifications();

      setResult({ ...(applied || {}), unique_tickers: uniqueValidRows.length, duplicate_rows_ignored: duplicateRows });
      setMessage(isArabic ? "تم التحديث بنجاح. تم تطبيق كل رمز مرة واحدة على جميع المحافظ والتوصيات المفتوحة التي تستخدمه." : "Update completed. Each ticker was applied once across every open portfolio and recommendation that references it.");
      await loadActiveTickers();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="dashboard-shell admin-shell-v21">
      <DashboardHeader admin />
      <main className="price-import-page-v22 price-import-page-v34">
        <section className="admin-top-v21 price-import-top-v22">
          <div><span className="eyebrow">MASTER PRICE ENGINE</span><h1>{isArabic ? "تحديث كل الأسعار من ملف واحد" : "One sheet. Every active ticker."}</h1><p>{isArabic ? "حمّل قالبًا ذكيًا يجمع كل الرموز النشطة بدون تكرار، حدّث الأسعار، ثم ارفعه ليتم تطبيق كل رمز على كل المحافظ والتوصيات المرتبطة به." : "Download a smart template containing every unique active ticker, update the prices, then upload it once to refresh all linked portfolios and recommendations."}</p></div>
          <button className="button primary" type="button" disabled={loadingTemplate || !activeTickers.length} onClick={downloadSmartTemplate}><Download size={16}/>{loadingTemplate ? (isArabic ? "جاري التجميع…" : "Building template…") : (isArabic ? `تحميل قالب ${activeTickers.length} رمز` : `Download ${activeTickers.length}-ticker template`)}</button>
        </section>

        {message && <div className="notice-bar">{message}</div>}

        <section className="smart-template-banner-v34 panel-v21">
          <span><Layers3/></span><div><small>SMART CONSOLIDATION</small><h2>{isArabic ? "كل رمز يظهر مرة واحدة فقط" : "Every ticker appears once"}</h2><p>{isArabic ? "حتى لو السهم موجود في أكثر من محفظة أو توصية، القالب يجمعه في صف واحد، والتحديث ينسحب تلقائيًا على كل الأماكن المفتوحة." : "Even when a stock is used in several portfolios or recommendations, the template contains one row and the import propagates it to every open reference."}</p></div><b>{activeTickers.length}</b>
        </section>

        <section className="price-import-grid-v22">
          <article className="panel-v21 padded-v21 upload-panel-v22">
            <div className="panel-heading-v21"><div><span className="eyebrow">STEP 1</span><h2>{isArabic ? "اختار ملف الأسعار" : "Choose the completed price file"}</h2><p>{isArabic ? "الأعمدة المقبولة: Ticker أو Symbol، Close أو Price، Date، وCompany اختياري." : "Accepted columns: Ticker or Symbol, Close or Price, Date, and optional Company."}</p></div></div>
            <label className="drop-zone-v22"><UploadCloud size={42}/><b>{fileName || (isArabic ? "اضغط لاختيار Excel أو CSV" : "Click to choose Excel or CSV")}</b><small>.xlsx · .xls · .csv</small><input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => readFile(e.target.files?.[0])}/></label>
            <div className="template-rules-v22"><span><CheckCircle2/>{isArabic ? "القالب يجمع الأسهم والمؤشرات النشطة تلقائيًا" : "The template discovers active stocks and benchmarks automatically"}</span><span><CheckCircle2/>{isArabic ? "الصف المكرر داخل الملف يتم دمجه قبل الرفع" : "Duplicate rows in the upload are deduplicated before import"}</span><span><CheckCircle2/>{isArabic ? "السجلات المغلقة تظل ثابتة" : "Closed records remain frozen"}</span></div>
          </article>

          <article className="panel-v21 padded-v21 import-summary-panel-v22">
            <span className="eyebrow">STEP 2</span><h2>{isArabic ? "مراجعة قبل التحديث" : "Review before import"}</h2>
            <div className="import-counts-v22"><span><FileSpreadsheet/><small>{isArabic ? "كل الصفوف" : "Total rows"}</small><b>{rows.length}</b></span><span className="valid"><CheckCircle2/><small>{isArabic ? "رموز فريدة" : "Unique valid"}</small><b>{uniqueValidRows.length}</b></span><span className="invalid"><XCircle/><small>{isArabic ? "مشكلات / تكرار" : "Invalid / duplicate"}</small><b>{invalidRows.length + duplicateRows}</b></span></div>
            <button className="button green full" disabled={!uniqueValidRows.length || importing} onClick={importPrices}><RefreshCw size={16}/>{importing ? (isArabic ? "جاري التحديث…" : "Updating…") : (isArabic ? "تحديث كل السجلات المرتبطة" : "Update every linked record")}</button>
            {result && <div className="import-result-v22"><CheckCircle2/><div><b>{isArabic ? "اكتمل التحديث" : "Import completed"}</b><span>{isArabic ? `تم رفع ${result.unique_tickers || 0} رمز فريد. تم تحديث ${result.holdings_updated || 0} مركز وإعادة حساب ${result.open_months_recalculated || 0} شهر مفتوح.` : `${result.unique_tickers || 0} unique tickers imported, ${result.holdings_updated || 0} holdings updated and ${result.open_months_recalculated || 0} open months recalculated.`}</span></div></div>}
          </article>
        </section>

        <section className="panel-v21 price-preview-panel-v22">
          <div className="panel-heading-v21"><div><span className="eyebrow">PREVIEW</span><h2>{isArabic ? "معاينة البيانات" : "Data preview"}</h2><p>{isArabic ? "لن يتم رفع الصفوف التي بها مشكلة، وآخر صف صالح لكل رمز مكرر هو الذي سيتم استخدامه." : "Invalid rows are skipped; for duplicate tickers, the last valid row is used."}</p></div></div>
          <div className="table-scroll"><table className="data-table-v21 compact-table"><thead><tr><th>#</th><th>Ticker</th><th>{isArabic ? "الشركة" : "Company"}</th><th>{isArabic ? "سعر الإغلاق" : "Close"}</th><th>{isArabic ? "التاريخ" : "Date"}</th><th>{isArabic ? "الحالة" : "Status"}</th></tr></thead><tbody>{rows.slice(0, 200).map((row) => <tr key={`${row.row}-${row.ticker}`} className={row.errors.length ? "invalid-row-v22" : ""}><td>{row.row}</td><td><b className="ticker-chip">{row.ticker || "—"}</b></td><td>{row.company_name || "—"}</td><td>{Number.isFinite(row.close_price) ? formatNumber(row.close_price, 2, locale) : "—"}</td><td>{row.price_date}</td><td>{row.errors.length ? <span className="negative">{row.errors.join(", ")}</span> : <span className="positive">{isArabic ? "جاهز" : "Ready"}</span>}</td></tr>)}{!rows.length && <tr><td colSpan="6" className="muted-copy-v21">{isArabic ? "ارفع الملف وستظهر المعاينة هنا." : "Upload a file to preview the rows here."}</td></tr>}</tbody></table></div>
        </section>
      </main>
    </div>
  );
}
