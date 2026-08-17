import { Component, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  Gauge,
  History,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardHeader from "../components/DashboardHeader";
import PlatformFooter from "../components/PlatformFooter";
import Reveal from "../components/Reveal";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  calculateJournalAnalytics,
  extractThndrPortfolioValue,
  describeJournalAmount,
  formatJournalCurrency,
  journalPercent,
  localDateInput,
} from "../lib/journal";

const TIMEFRAMES = ["1D", "1W", "1M", "YTD", "1Y", "ALL", "CUSTOM"];

function localizeError(message, isArabic) {
  if (!isArabic) return message;
  if (/baseline/i.test(message)) return "تعذر حفظ رأس مال البداية. تأكد من تشغيل ملف SQL الخاص بالتحديث.";
  if (/snapshot/i.test(message)) return "تعذر حفظ القراءة اليومية. حاول مرة أخرى.";
  return message;
}

async function journalRequest(session, method = "GET", body = null, query = "") {
  if (!session?.access_token) throw new Error("Authentication required.");
  const response = await fetch(`/api/my-journal${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}


class JournalChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, message: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    console.error("Journal chart render failed without affecting saved data:", error, info);
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, message: "" });
    }
  }

  render() {
    if (this.state.failed) {
      return <div className="journal-chart-empty"><BarChart3/><b>{this.props.fallbackLabel}</b><small>{this.state.message}</small></div>;
    }
    return this.props.children;
  }
}

function normalizeJournalSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const id = String(snapshot.id || "").trim();
  const snapshotDate = String(snapshot.snapshot_date || "").trim();
  const portfolioValue = Number(snapshot.portfolio_value);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate) || !Number.isFinite(portfolioValue) || portfolioValue <= 0) return null;
  return {
    ...snapshot,
    id,
    snapshot_date: snapshotDate,
    portfolio_value: portfolioValue,
    session_note: String(snapshot.session_note || ""),
  };
}

function MetricCard({ icon: Icon, label, value, sub, tone = "cyan", badge }) {
  return (
    <article className={`journal-metric-card journal-tone-${tone}`}>
      <div className="journal-metric-icon"><Icon size={18}/></div>
      <small>{label}</small>
      <strong>{value}</strong>
      {sub && <span>{sub}</span>}
      {badge && <em>{badge}</em>}
    </article>
  );
}

function formatDateLabel(date, locale) {
  if (!date) return "—";
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

function chartCurrency(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(0)}K`;
  return number.toFixed(0);
}


async function loadScreenshotImage(file) {
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    const bitmap = await window.createImageBitmap(file);
    return { image: bitmap, cleanup: () => bitmap.close?.() };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Could not decode screenshot image."));
    image.src = objectUrl;
  });
  return { image, cleanup: () => URL.revokeObjectURL(objectUrl) };
}

/**
 * Thndr screenshots use bright text on a nearly-black canvas. OCR performs far
 * better after we invert that palette so the screenshot becomes black text on
 * white, then force it into a high-contrast monochrome image.
 */
async function preprocessThndrScreenshot(file) {
  const { image, cleanup } = await loadScreenshotImage(file);
  try {
    const sourceWidth = Number(image.width || image.naturalWidth || 0);
    const sourceHeight = Number(image.height || image.naturalHeight || 0);
    if (!sourceWidth || !sourceHeight) throw new Error("Invalid screenshot dimensions.");

    // Upscale phone screenshots before thresholding so comma separators remain
    // distinct characters for Tesseract. Cap the width to protect mobile memory.
    const desiredScale = sourceWidth < 1000 ? 2.2 : 1.35;
    const scale = Math.max(1, Math.min(desiredScale, 1800 / sourceWidth));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is not available.");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = frame.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = Math.round((pixels[i] * 0.299) + (pixels[i + 1] * 0.587) + (pixels[i + 2] * 0.114));
      const inverted = 255 - gray;
      // Pure B/W after inversion: Thndr's white/grey wealth label and number
      // become black, while its black background becomes white.
      const monochrome = inverted < 170 ? 0 : 255;
      pixels[i] = monochrome;
      pixels[i + 1] = monochrome;
      pixels[i + 2] = monochrome;
      pixels[i + 3] = 255;
    }
    ctx.putImageData(frame, 0, 0);

    // The Thndr total-wealth block sits below the notification/status area and
    // above the asset cards. OCR this focused band first to avoid stock values,
    // percentages, battery numbers and notification text competing with it.
    const cropX = Math.round(canvas.width * 0.035);
    const cropY = Math.round(canvas.height * 0.12);
    const cropWidth = Math.round(canvas.width * 0.93);
    const cropHeight = Math.round(canvas.height * 0.30);
    const focusCanvas = document.createElement("canvas");
    focusCanvas.width = cropWidth;
    focusCanvas.height = cropHeight;
    const focusCtx = focusCanvas.getContext("2d");
    if (!focusCtx) throw new Error("Focused OCR canvas is not available.");
    focusCtx.fillStyle = "#ffffff";
    focusCtx.fillRect(0, 0, cropWidth, cropHeight);
    focusCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    return { fullCanvas: canvas, focusCanvas };
  } finally {
    cleanup?.();
  }
}

class JournalPageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Private Journal page crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="dashboard-shell journal-shell">
          <DashboardHeader />
          <main className="journal-page">
            <section className="journal-entry-card" style={{ maxWidth: 760, margin: "32px auto" }}>
              <span className="eyebrow">PRIVATE JOURNAL · RECOVERY MODE</span>
              <h2>Journal display error</h2>
              <p style={{ color: "var(--muted)" }}>Your saved journal data was not deleted. Reload this page to retry the visual layer.</p>
              <small style={{ display: "block", marginBottom: 16, color: "#fca5a5" }}>{this.state.error?.message || String(this.state.error)}</small>
              <button className="button primary" type="button" onClick={() => window.location.reload()}>Reload journal</button>
            </section>
          </main>
          <PlatformFooter />
        </div>
      );
    }
    return this.props.children;
  }
}

function MyJournalContent() {
  const { session, loading: authLoading } = useAuth();
  const { isArabic } = useLanguage();
  const locale = isArabic ? "ar-EG" : "en-EG";
  const [settings, setSettings] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [displayReady, setDisplayReady] = useState(false);
  const [initialLoadError, setInitialLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [timeframe, setTimeframe] = useState("ALL");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [baselineForm, setBaselineForm] = useState({ capital: "", date: "" });
  const [snapshotForm, setSnapshotForm] = useState({ date: localDateInput(), value: "", note: "" });
  const screenshotInputRef = useRef(null);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);

  const load = async ({ initial = false } = {}) => {
    if (!session?.access_token) return false;
    try {
      if (initial) {
        setLoading(true);
        setDisplayReady(false);
        setInitialLoadError("");
      }
      const payload = await journalRequest(session);
      const safeSnapshots = Array.isArray(payload.snapshots)
        ? payload.snapshots.map(normalizeJournalSnapshot).filter(Boolean)
        : [];
      setSettings(payload.settings || null);
      setSnapshots(safeSnapshots);
      if (payload.settings) {
        setBaselineForm({
          capital: String(payload.settings.baseline_capital || ""),
          date: payload.settings.baseline_date || "",
        });
      } else {
        setShowSettings(true);
      }
      if (initial) setInitialLoadError("");
      setMessage("");
      return true;
    } catch (error) {
      console.error("Journal load failed:", error);
      const detail = localizeError(error.message || String(error), isArabic);
      if (initial) setInitialLoadError(detail);
      else setMessage(detail);
      return false;
    } finally {
      if (initial) {
        setLoading(false);
        setInitialDataLoaded(true);
      }
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!session?.access_token) {
      setLoading(false);
      setInitialLoadError(isArabic ? "يجب تسجيل الدخول لفتح السجل الخاص." : "Sign in to open your private journal.");
      setInitialDataLoaded(true);
      return;
    }

    setInitialDataLoaded(false);
    setDisplayReady(false);
    load({ initial: true });
  }, [authLoading, session?.access_token]);

  // Keep the real dashboard mounted but invisible while its data, calculations,
  // fonts and chart layout settle. This prevents the default 0 EGP state from
  // ever being painted to the user, while still giving Recharts real dimensions.
  useEffect(() => {
    if (!initialDataLoaded || initialLoadError) return;
    let cancelled = false;
    let frameOne = 0;
    let frameTwo = 0;

    const revealAfterPaint = () => {
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => {
          if (!cancelled) setDisplayReady(true);
        });
      });
    };

    if (document.fonts?.ready) {
      document.fonts.ready.then(revealAfterPaint).catch(revealAfterPaint);
    } else {
      revealAfterPaint();
    }

    return () => {
      cancelled = true;
      if (frameOne) window.cancelAnimationFrame(frameOne);
      if (frameTwo) window.cancelAnimationFrame(frameTwo);
    };
  }, [initialDataLoaded, initialLoadError]);

  const analytics = useMemo(() => calculateJournalAnalytics({
    snapshots,
    settings,
    timeframe,
    customFrom,
    customTo,
    isArabic,
  }), [snapshots, settings, timeframe, customFrom, customTo, isArabic]);

  const historyRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return [...analytics.selected].reverse().filter((row) => {
      if (!normalized) return true;
      return `${row.snapshot_date} ${row.portfolio_value} ${row.session_note || ""}`.toLowerCase().includes(normalized);
    });
  }, [analytics.selected, search]);

  const baselinePreview = baselineForm.capital
    ? `${formatJournalCurrency(baselineForm.capital, locale)} · ${describeJournalAmount(baselineForm.capital, isArabic)}`
    : (isArabic ? "أدخل رأس مال البداية" : "Enter your starting capital");
  const snapshotPreview = snapshotForm.value
    ? `${formatJournalCurrency(snapshotForm.value, locale)} · ${describeJournalAmount(snapshotForm.value, isArabic)}`
    : (isArabic ? "اكتب إجمالي قيمة المحفظة اليوم" : "Enter today’s total portfolio value");

  const extractBalanceFromScreenshot = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setMessage(isArabic ? "اختر صورة Screenshot صالحة." : "Choose a valid screenshot image.");
      return;
    }
    if (!window.Tesseract?.recognize) {
      setMessage(isArabic ? "تعذر تحميل أداة قراءة الصور. تأكد من اتصال الإنترنت ثم حاول مرة أخرى." : "The screenshot reader could not load. Check your internet connection and try again.");
      return;
    }

    try {
      setOcrBusy(true);
      setMessage("");
      setOcrStatus(isArabic ? "⏳ جاري تجهيز الصورة ورفع التباين..." : "⏳ Preparing and enhancing the screenshot...");
      const { focusCanvas, fullCanvas } = await preprocessThndrScreenshot(file);

      const logger = (progress) => {
        if (progress?.status === "recognizing text" && Number.isFinite(progress.progress)) {
          const pct = Math.max(1, Math.round(progress.progress * 100));
          setOcrStatus(isArabic ? `⏳ جاري قراءة إجمالي الثروة... ${pct}%` : `⏳ Reading total wealth... ${pct}%`);
        }
      };

      let result;
      try {
        // Arabic is needed to anchor on "إجمالي الثروة"; English helps preserve
        // comma-formatted Western digits used by Thndr.
        result = await window.Tesseract.recognize(focusCanvas, "ara+eng", { logger });
      } catch (languageError) {
        console.warn("Arabic OCR pack unavailable, retrying numeric OCR in English.", languageError);
        result = await window.Tesseract.recognize(focusCanvas, "eng", { logger });
      }

      let extracted = extractThndrPortfolioValue(result?.data?.text || "");

      // Very unusual screenshots may place the wealth panel outside the normal
      // band. Only then OCR the full inverted image as a fallback.
      if (!extracted?.value) {
        setOcrStatus(isArabic ? "⏳ إعادة فحص الصورة كاملة..." : "⏳ Re-checking the full screenshot...");
        const fullResult = await window.Tesseract.recognize(fullCanvas, "eng", { logger });
        extracted = extractThndrPortfolioValue(fullResult?.data?.text || "");
      }

      if (!extracted?.value) {
        setOcrStatus(isArabic ? "لم أتمكن من قراءة إجمالي الثروة. جرّب Screenshot كامل وواضح من الصفحة الرئيسية في Thndr." : "The total wealth value was not detected. Try a clear, full Thndr home screenshot.");
        return;
      }

      const normalizedValue = Number(extracted.value.toFixed(2));
      setSnapshotForm((current) => ({ ...current, value: String(normalizedValue) }));
      setOcrStatus(isArabic ? `✅ تم استخراج إجمالي الثروة: ${formatJournalCurrency(normalizedValue, locale)}` : `✅ Total wealth extracted: ${formatJournalCurrency(normalizedValue, locale)}`);
    } catch (error) {
      console.error("Screenshot OCR failed", error);
      setOcrStatus(isArabic ? "تعذر قراءة الصورة. حاول بصورة أوضح أو أدخل الرقم يدويًا." : "The screenshot could not be read. Try a clearer image or enter the value manually.");
    } finally {
      setOcrBusy(false);
    }
  };

  const saveBaseline = async (event) => {
    event.preventDefault();
    const capital = Number(baselineForm.capital);
    if (!Number.isFinite(capital) || capital <= 0) {
      setMessage(isArabic ? "برجاء إدخال رأس مال بداية صحيح." : "Enter a valid starting capital.");
      return;
    }
    try {
      setSaving(true);
      const payload = await journalRequest(session, "PUT", { baselineCapital: capital, baselineDate: baselineForm.date || null });
      setSettings(payload.settings);
      setShowSettings(false);
      setMessage(isArabic ? "تم حفظ رأس مال البداية." : "Starting capital saved.");
    } catch (error) {
      setMessage(localizeError(error.message || String(error), isArabic));
    } finally {
      setSaving(false);
    }
  };

  const saveSnapshot = async (event) => {
    event.preventDefault();
    try {
      if (!settings?.baseline_capital) {
        setShowSettings(true);
        setMessage(isArabic ? "حدد رأس مال البداية أولًا قبل إضافة القراءات." : "Set your starting capital before adding snapshots.");
        return;
      }

      // OCR always writes a plain numeric string, but strip commas defensively
      // so a manually pasted formatted amount cannot trigger an invalid number.
      const normalizedValue = String(snapshotForm.value || "").replace(/,/g, "").trim();
      const portfolioValue = Number(normalizedValue);
      const snapshotDate = String(snapshotForm.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate) || !Number.isFinite(portfolioValue) || portfolioValue <= 0) {
        setMessage(isArabic ? "أدخل تاريخًا وقيمة صحيحة للمحفظة." : "Enter a valid date and portfolio value.");
        return;
      }

      setSaving(true);
      const body = {
        snapshotDate,
        portfolioValue,
        sessionNote: String(snapshotForm.note || "").trim(),
        ...(editingId ? { id: editingId } : {}),
      };

      // The API/DB write happens first. Nothing below can undo a successful save.
      const payload = await journalRequest(session, editingId ? "PATCH" : "POST", body);
      const savedSnapshot = normalizeJournalSnapshot(payload?.snapshot);
      if (!savedSnapshot) throw new Error("Snapshot was saved but the server returned an invalid snapshot payload.");

      // Keep a tiny device-side recovery copy. Supabase remains the source of truth.
      try {
        const backupKey = `alpha-journal-last-snapshot-${session?.user?.id || "current"}`;
        window.localStorage?.setItem(backupKey, JSON.stringify(savedSnapshot));
      } catch (backupError) {
        console.warn("Journal local recovery backup failed:", backupError);
      }

      setSnapshotForm({ date: localDateInput(), value: "", note: "" });
      setOcrStatus("");
      setEditingId(null);
      setMessage(isArabic ? "تم حفظ القراءة اليومية بنجاح." : "Daily snapshot saved successfully.");

      // Refresh from the database instead of relying on a potentially malformed
      // optimistic state update. If a visual component fails, the DB row is safe.
      const refreshed = await load({ initial: false });
      setMessage(refreshed
        ? (isArabic ? "تم حفظ القراءة اليومية بنجاح." : "Daily snapshot saved successfully.")
        : (isArabic ? "تم حفظ القراءة في قاعدة البيانات، لكن تعذر تحديث الشاشة الآن. أعد فتح الصفحة." : "The snapshot was saved to the database, but the screen could not refresh. Reopen the page."));
    } catch (error) {
      console.error("Journal snapshot save failed:", error);
      const detail = error?.message || String(error);
      setMessage(localizeError(detail, isArabic));
      if (typeof window !== "undefined") window.alert(`Error saving: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  const editSnapshot = (row) => {
    setEditingId(row.id);
    setSnapshotForm({ date: row.snapshot_date, value: String(row.portfolio_value), note: row.session_note || "" });
    setOcrStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSnapshotForm({ date: localDateInput(), value: "", note: "" });
    setOcrStatus("");
  };

  const deleteSnapshot = async (row) => {
    const ok = window.confirm(isArabic ? `حذف قراءة ${row.snapshot_date} نهائيًا؟` : `Delete the ${row.snapshot_date} snapshot permanently?`);
    if (!ok) return;
    try {
      setSaving(true);
      await journalRequest(session, "DELETE", null, `?id=${encodeURIComponent(row.id)}`);
      setSnapshots((current) => current.filter((item) => item.id !== row.id));
      if (editingId === row.id) cancelEdit();
      setMessage(isArabic ? "تم حذف القراءة." : "Snapshot deleted.");
    } catch (error) {
      setMessage(localizeError(error.message || String(error), isArabic));
    } finally {
      setSaving(false);
    }
  };

  const latestSnapshot = snapshots.at(-1) || null;
  const latestPrevious = snapshots.length > 1 ? snapshots.at(-2) : null;
  const latestDailyPnl = latestSnapshot
    ? Number(latestSnapshot.portfolio_value) - Number(latestPrevious?.portfolio_value || settings?.baseline_capital || latestSnapshot.portfolio_value)
    : 0;

  return (
    <div className="dashboard-shell journal-shell">
      <DashboardHeader />
      {!displayReady && !initialLoadError && <div className="journal-hydration-overlay" role="status" aria-live="polite">
        <div className="journal-hydration-card">
          <span className="journal-hydration-orb"><RefreshCw size={24}/></span>
          <span className="eyebrow">PRIVATE · PERSONAL PERFORMANCE JOURNAL</span>
          <h2>{isArabic ? "جاري تجهيز سجل محفظتك…" : "Preparing your private journal…"}</h2>
          <p>{isArabic ? "نزامن رأس مال البداية والقراءات ونحسب الأداء قبل عرض أي أرقام." : "Syncing your baseline, snapshots and analytics before showing any figures."}</p>
          <div className="journal-hydration-bars" aria-hidden="true"><i/><i/><i/></div>
        </div>
      </div>}
      {initialLoadError && initialDataLoaded && <main className="journal-load-error">
        <section className="journal-entry-card">
          <span className="eyebrow">PRIVATE JOURNAL · LOAD ERROR</span>
          <h2>{isArabic ? "تعذر تحميل بيانات السجل" : "Could not load journal data"}</h2>
          <p>{initialLoadError}</p>
          <button className="button primary" type="button" onClick={() => { setInitialDataLoaded(false); setDisplayReady(false); load({ initial: true }); }}><RefreshCw size={16}/>{isArabic ? "إعادة المحاولة" : "Try again"}</button>
        </section>
      </main>}
      {message && displayReady && <div className="notice-bar journal-notice">{message}</div>}
      <main className={`journal-page journal-dashboard-content ${displayReady ? "is-ready" : "is-hydrating"}`} aria-busy={!displayReady}>
        <Reveal as="section" className="journal-hero">
          <div className="journal-hero-copy">
            <span className="eyebrow">PRIVATE · PERSONAL PERFORMANCE JOURNAL</span>
            <h1>{isArabic ? "سجل محفظتك الشخصية. خاص بك وحدك." : "Your private portfolio performance journal"}</h1>
            <p>{isArabic ? "سجّل إجمالي قيمة محفظتك يوميًا، راقب العائد والتذبذب وأقصى هبوط، واحتفظ بسجل أداء منفصل تمامًا عن أرقام منصة ALPHA العامة." : "Log your total portfolio value each session, measure returns, volatility and drawdown, and keep the record completely separate from ALPHA’s public platform metrics."}</p>
            <div className="journal-privacy-chip"><ShieldCheck size={16}/><span>{isArabic ? "محمي بـ User ID وRLS — لا يمكن لمستخدم آخر قراءة بياناتك" : "Protected by User ID + RLS — other users cannot read your data"}</span></div>
          </div>
          <div className="journal-current-card">
            <small>{isArabic ? "إجمالي المحفظة الحالي" : "Current portfolio value"}</small>
            <strong>{formatJournalCurrency(latestSnapshot?.portfolio_value || settings?.baseline_capital || 0, locale)}</strong>
            <span className={latestDailyPnl >= 0 ? "positive" : "negative"}>{latestDailyPnl >= 0 ? "+" : ""}{formatJournalCurrency(latestDailyPnl, locale)}</span>
            <button className="button subtle" type="button" onClick={() => setShowSettings(true)}><Settings size={15}/>{isArabic ? "إعدادات البداية" : "Baseline settings"}</button>
          </div>
        </Reveal>

        <section className="journal-entry-grid">
          <Reveal as="form" className="journal-entry-card" onSubmit={saveSnapshot}>
            <header><div><span className="eyebrow">DAILY SNAPSHOT</span><h2>{editingId ? (isArabic ? "تعديل القراءة" : "Edit snapshot") : (isArabic ? "سجّل جلسة اليوم" : "Log today’s session")}</h2></div>{editingId && <button className="journal-icon-button" type="button" onClick={cancelEdit}><X/></button>}</header>
            <div className="journal-form-grid">
              <label><span><CalendarDays size={14}/>{isArabic ? "تاريخ الجلسة" : "Session date"}</span><input type="date" value={snapshotForm.date} onChange={(event) => setSnapshotForm((current) => ({ ...current, date: event.target.value }))}/></label>
              <label className="journal-value-field">
                <span><Activity size={14}/>{isArabic ? "إجمالي قيمة المحفظة" : "Total portfolio value"}</span>
                <div className="journal-value-input-row">
                  <input type="number" step="0.01" inputMode="decimal" placeholder="12,850,000" value={snapshotForm.value} onChange={(event) => { setSnapshotForm((current) => ({ ...current, value: event.target.value })); setOcrStatus(""); }}/>
                  <button className="journal-camera-button" type="button" disabled={ocrBusy} onClick={() => screenshotInputRef.current?.click()} aria-label={isArabic ? "استخراج الرصيد من Screenshot" : "Extract balance from screenshot"} title={isArabic ? "ارفع Screenshot من Thndr لاستخراج إجمالي المحفظة تلقائيًا" : "Upload a Thndr screenshot to extract the portfolio total automatically"}>
                    <Camera size={19}/>
                    <span>{ocrBusy ? (isArabic ? "قراءة..." : "Reading...") : (isArabic ? "Screenshot" : "Screenshot")}</span>
                  </button>
                  <input ref={screenshotInputRef} className="journal-screenshot-input" type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={extractBalanceFromScreenshot}/>
                </div>
                <em className={ocrBusy ? "journal-ocr-loading" : ""}>{ocrStatus || snapshotPreview}</em>
              </label>
              <label className="journal-note-field"><span><Sparkles size={14}/>{isArabic ? "ملاحظة الجلسة (اختياري)" : "Session note (optional)"}</span><input type="text" maxLength={1000} placeholder={isArabic ? "مثال: صعود ORHD وRAYA" : "Example: ORHD & RAYA rally"} value={snapshotForm.note} onChange={(event) => setSnapshotForm((current) => ({ ...current, note: event.target.value }))}/></label>
            </div>
            <button className="button primary journal-save-button" disabled={saving} type="submit"><Save size={16}/>{saving ? (isArabic ? "جاري الحفظ…" : "Saving…") : editingId ? (isArabic ? "حفظ التعديل" : "Save changes") : (isArabic ? "تسجيل Snapshot اليومي" : "Save daily snapshot")}</button>
          </Reveal>

          <Reveal as="section" className="journal-baseline-card" delay={40}>
            <header><Target/><div><span className="eyebrow">BASELINE</span><h2>{isArabic ? "رأس مال البداية" : "Starting baseline"}</h2></div></header>
            <strong>{formatJournalCurrency(settings?.baseline_capital || 0, locale)}</strong>
            <p>{settings?.baseline_date ? formatDateLabel(settings.baseline_date, locale) : (isArabic ? "يمكنك إضافة تاريخ البداية لزيادة وضوح السجل." : "Add a baseline date for a cleaner performance record.")}</p>
            <button className="button subtle" type="button" onClick={() => setShowSettings(true)}><Pencil size={15}/>{settings ? (isArabic ? "تعديل البداية" : "Edit baseline") : (isArabic ? "تحديد البداية" : "Set baseline")}</button>
          </Reveal>
        </section>

        <Reveal as="section" className="journal-analytics-panel" delay={70}>
          <header className="journal-panel-heading">
            <div><span className="eyebrow">TIMEFRAME ANALYTICS</span><h2>{isArabic ? "حلّل الأداء لأي فترة" : "Analyse performance over any timeframe"}</h2><p>{isArabic ? "كل الحسابات أدناه تتغير فورًا حسب الفترة المختارة." : "Every metric below recalculates instantly for the selected period."}</p></div>
            <button className="button subtle compact" onClick={load} type="button"><RefreshCw size={14}/>{isArabic ? "تحديث" : "Refresh"}</button>
          </header>
          <div className="journal-timeframe-bar">
            {TIMEFRAMES.map((item) => <button key={item} className={timeframe === item ? "active" : ""} type="button" onClick={() => setTimeframe(item)}>{item === "CUSTOM" ? (isArabic ? "مخصص" : "Custom") : item}</button>)}
          </div>
          {timeframe === "CUSTOM" && <div className="journal-custom-range"><label>{isArabic ? "من" : "From"}<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)}/></label><span>→</span><label>{isArabic ? "إلى" : "To"}<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)}/></label></div>}
          <div className="journal-period-label"><CalendarDays size={14}/><span>{formatDateLabel(analytics.startDate, locale)} — {formatDateLabel(analytics.endDate, locale)}</span><em>{analytics.observationCount} {isArabic ? "قراءة" : "snapshots"}</em></div>

          <div className="journal-metrics-grid">
            <MetricCard icon={TrendingUp} label={isArabic ? "العائد التراكمي" : "Cumulative return"} value={journalPercent(analytics.cumulativeReturnPct)} sub={formatJournalCurrency(analytics.cumulativePnl, locale)} tone={analytics.cumulativeReturnPct >= 0 ? "green" : "red"}/>
            <MetricCard icon={Activity} label={isArabic ? "P&L الفترة" : "Period P&L"} value={formatJournalCurrency(analytics.cumulativePnl, locale)} sub={`${isArabic ? "بداية الفترة" : "Period baseline"}: ${formatJournalCurrency(analytics.periodStartValue, locale)}`} tone={analytics.cumulativePnl >= 0 ? "green" : "red"}/>
            <MetricCard icon={CalendarDays} label={isArabic ? "تغير آخر جلسة" : "Latest daily P&L"} value={journalPercent(analytics.dailyReturnPct)} sub={formatJournalCurrency(analytics.dailyPnl, locale)} tone={analytics.dailyReturnPct >= 0 ? "green" : "red"}/>
            <MetricCard icon={Gauge} label={isArabic ? "تذبذب المحفظة" : "Portfolio volatility"} value={`${analytics.annualizedVolatilityPct.toFixed(2)}%`} sub={analytics.volatility.description} badge={analytics.volatility.title} tone={analytics.volatility.key === "high" ? "red" : analytics.volatility.key === "moderate" ? "amber" : "cyan"}/>
            <MetricCard icon={BarChart3} label={isArabic ? "عائد التذبذب الاسترشادي" : "Indicative return / volatility"} value={Number.isFinite(analytics.riskAdjustedRatio) ? analytics.riskAdjustedRatio.toFixed(2) : "—"} sub={analytics.riskAdjustedGuidance} tone={Number(analytics.riskAdjustedRatio) >= 0 ? "purple" : "red"}/>
            <MetricCard icon={TrendingDown} label={isArabic ? "أقصى هبوط" : "Max drawdown"} value={`${analytics.maxDrawdownPct.toFixed(2)}%`} sub={isArabic ? "من أعلى قمة إلى أدنى قاع داخل الفترة" : "Peak-to-trough decline inside the period"} tone="red"/>
            <MetricCard icon={CheckCircle2} label={isArabic ? "أيام الربح" : "Winning days"} value={`${analytics.winDays} · ${analytics.winRatePct.toFixed(0)}%`} sub={`${isArabic ? "مقابل" : "vs"} ${analytics.lossDays} ${isArabic ? "أيام خسارة" : "loss days"}`} tone="green"/>
            <MetricCard icon={History} label={isArabic ? "مشاهدات العائد" : "Return observations"} value={String(analytics.returnObservationCount)} sub={isArabic ? "تُستخدم لحساب التذبذب ونسبة الربح والخسارة" : "Used for volatility and win/loss statistics"} tone="cyan"/>
          </div>
        </Reveal>

        <Reveal as="section" className="journal-chart-card" delay={100}>
          <header><div><span className="eyebrow">PERFORMANCE TREND</span><h2>{isArabic ? "مسار قيمة المحفظة" : "Portfolio value trajectory"}</h2></div><span className="journal-chart-current">{formatJournalCurrency(analytics.currentValue, locale)}</span></header>
          <div className="journal-chart-wrap">
            {analytics.chartPoints.length >= 2 ? <JournalChartErrorBoundary resetKey={`${timeframe}-${analytics.chartPoints.length}-${analytics.currentValue}`} fallbackLabel={isArabic ? "تم حفظ البيانات، لكن تعذر عرض الرسم مؤقتًا" : "Data is saved, but the chart could not render temporarily"}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.chartPoints} margin={{ top: 18, right: 14, left: 8, bottom: 6 }}>
                  <defs><linearGradient id="journalValueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.32}/><stop offset="100%" stopColor="#38bdf8" stopOpacity={0.01}/></linearGradient></defs>
                  <CartesianGrid stroke="rgba(148,163,184,.09)" vertical={false}/>
                  <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fill: "#7f91a8", fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={chartCurrency} tick={{ fill: "#7f91a8", fontSize: 10 }} axisLine={false} tickLine={false} width={48}/>
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="journal-tooltip"><b>{formatDateLabel(label, locale)}</b><strong>{formatJournalCurrency(payload[0].value, locale)}</strong>{payload[0]?.payload?.note && <small>{payload[0].payload.note}</small>}</div> : null}/>
                  <Area type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={3} fill="url(#journalValueFill)" dot={{ r: 3, fill: "#10b981", stroke: "#0b1120", strokeWidth: 2 }} activeDot={{ r: 6 }}/>
                </AreaChart>
              </ResponsiveContainer>
            </JournalChartErrorBoundary> : <div className="journal-chart-empty"><BarChart3/><b>{isArabic ? "أضف قراءتين أو أكثر لرؤية الاتجاه" : "Add two or more snapshots to build your trend"}</b></div>}
          </div>
        </Reveal>

        <Reveal as="section" className="journal-history-card" delay={130}>
          <header className="journal-panel-heading"><div><span className="eyebrow">HISTORY LOG</span><h2>{isArabic ? "سجل القراءات اليومية" : "Daily snapshot history"}</h2><p>{isArabic ? "ابحث وعدّل أو احذف أي جلسة. كل التعديلات تخص حسابك فقط." : "Search, edit or delete any session. Every change is isolated to your account."}</p></div><label className="journal-history-search"><Search/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? "بحث بالتاريخ أو الملاحظة" : "Search date or note"}/></label></header>
          <div className="journal-history-table-wrap">
            <table className="journal-history-table">
              <thead><tr><th>{isArabic ? "التاريخ" : "Date"}</th><th>{isArabic ? "القيمة" : "Portfolio value"}</th><th>{isArabic ? "الملاحظة" : "Session note"}</th><th>{isArabic ? "آخر تحديث" : "Updated"}</th><th>{isArabic ? "إجراء" : "Actions"}</th></tr></thead>
              <tbody>
                {historyRows.map((row) => <tr key={row.id}><td><b>{formatDateLabel(row.snapshot_date, locale)}</b></td><td><strong>{formatJournalCurrency(row.portfolio_value, locale)}</strong></td><td><span>{row.session_note || "—"}</span></td><td><small>{row.updated_at ? new Date(row.updated_at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</small></td><td><div className="journal-row-actions"><button type="button" title={isArabic ? "تعديل" : "Edit"} onClick={() => editSnapshot(row)}><Pencil/></button><button className="danger" type="button" title={isArabic ? "حذف" : "Delete"} onClick={() => deleteSnapshot(row)}><Trash2/></button></div></td></tr>)}
                {!historyRows.length && <tr><td colSpan="5"><div className="journal-empty"><History/><b>{loading ? (isArabic ? "جاري تحميل السجل…" : "Loading history…") : (isArabic ? "لا توجد قراءات ضمن الفترة الحالية" : "No snapshots in the current range")}</b></div></td></tr>}
              </tbody>
            </table>
          </div>
        </Reveal>

        <section className="journal-methodology-note"><ShieldCheck/><div><b>{isArabic ? "ملاحظة منهجية" : "Methodology note"}</b><p>{isArabic ? "التذبذب محسوب كإنحراف معياري لعوائد الجلسات ومُسنّن باستخدام √252. مؤشر العائد مقابل التذبذب استرشادي ويستخدم متوسط العائد اليومي السنوي مع معدل خالٍ من المخاطر = صفر. لا يتم دمج أي من هذه البيانات مع نتائج المحافظ العامة للمنصة." : "Volatility is the sample standard deviation of session returns annualised using √252. The return-to-volatility indicator is indicative and uses annualised mean daily return with a zero risk-free rate. None of this private data is merged into ALPHA’s public portfolio performance."}</p></div></section>
      </main>

      {displayReady && showSettings && <div className="journal-modal-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setShowSettings(false)}><form className="journal-settings-modal" onSubmit={saveBaseline}><header><div><span className="eyebrow">PRIVATE SETTINGS</span><h2>{isArabic ? "إعداد رأس مال البداية" : "Starting capital settings"}</h2></div>{settings && <button type="button" className="journal-icon-button" onClick={() => setShowSettings(false)}><X/></button>}</header><p>{isArabic ? "هذا الرقم هو نقطة البداية لحساب النمو الكلي. يمكنك تعديله لاحقًا، لكن تغييره سيعيد تفسير الأداء التاريخي." : "This number is the baseline used to measure your total growth. You can edit it later, but changing it will reinterpret historical performance."}</p><label><span>{isArabic ? "رأس المال الأولي" : "Initial capital"}</span><input autoFocus type="number" step="0.01" inputMode="decimal" value={baselineForm.capital} onChange={(event) => setBaselineForm((current) => ({ ...current, capital: event.target.value }))}/><em>{baselinePreview}</em></label><label><span>{isArabic ? "تاريخ البداية (اختياري)" : "Baseline date (optional)"}</span><input type="date" value={baselineForm.date} onChange={(event) => setBaselineForm((current) => ({ ...current, date: event.target.value }))}/></label><button className="button primary full" disabled={saving}><Save/>{saving ? (isArabic ? "جاري الحفظ…" : "Saving…") : (isArabic ? "حفظ رأس مال البداية" : "Save baseline")}</button></form></div>}
      <PlatformFooter/>
    </div>
  );
}


export default function MyJournal() {
  return <JournalPageErrorBoundary><MyJournalContent /></JournalPageErrorBoundary>;
}
