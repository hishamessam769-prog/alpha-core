import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, CalendarRange, Coins, Download, Eye, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Link, useParams } from "react-router-dom";
import AuthorAttribution from "../components/AuthorAttribution";
import Brand from "../components/Brand";
import DashboardHeader from "../components/DashboardHeader";
import InsightDrawer from "../components/InsightDrawer";
import { useLanguage } from "../context/LanguageContext";
import { usePlatformSettings } from "../context/SettingsContext";
import { supabase } from "../lib/supabase";
import { dateTimeLabel } from "../lib/calculations";

export default function WeeklyReportDetail() {
  const { slug } = useParams();
  const { isArabic } = useLanguage();
  const { settings } = usePlatformSettings();
  const locale = isArabic ? "ar-EG" : "en-GB";
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const reportRef = useRef(null);
  const [report, setReport] = useState(null);
  const [author, setAuthor] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("weekly_reports").select("*").eq("slug", slug).single();
      if (error) setMessage(error.message);
      setReport(data || null);
      if (data?.created_by) {
        const profileResult = await supabase.from("profiles").select("*").eq("id", data.created_by).maybeSingle();
        if (!profileResult.error) setAuthor(profileResult.data);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const exportPdf = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 1.8, backgroundColor: "#07131f", useCORS: true, logging: false, windowWidth: 1400 });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      let left = height;
      let position = 0;
      const image = canvas.toDataURL("image/jpeg", 0.94);
      pdf.setFillColor(7, 19, 31); pdf.rect(0, 0, width, pageHeight, "F"); pdf.addImage(image, "JPEG", 0, position, width, height); left -= pageHeight;
      while (left > 2) { position -= pageHeight; pdf.addPage(); pdf.setFillColor(7, 19, 31); pdf.rect(0, 0, width, pageHeight, "F"); pdf.addImage(image, "JPEG", 0, position, width, height); left -= pageHeight; }
      pdf.save(`ALPHA-WEEKLY-${report.slug}-V3.3.pdf`);
      window.dispatchEvent(new CustomEvent("alpha:meaningful-action", { detail: { action: "export_weekly_pdf" } }));
    } catch (error) { setMessage(error.message); } finally { setExporting(false); }
  };

  if (loading) return <div className="dashboard-shell"><DashboardHeader/><div className="loading-screen"><div className="loader-ring"/></div></div>;
  if (!report) return <div className="dashboard-shell"><DashboardHeader/><div className="empty-state-v21"><h1>{isArabic ? "التقرير غير موجود" : "Report not found"}</h1><Link className="button gold" to="/weekly-reports">{isArabic ? "العودة للتقارير" : "Back to reports"}</Link></div></div>;

  const aiSummary = isArabic
    ? `يغطي التقرير الفترة من ${new Date(`${report.week_start}T12:00:00`).toLocaleDateString(locale)} إلى ${new Date(`${report.week_end}T12:00:00`).toLocaleDateString(locale)}. الملخص: ${report.summary}. السوق: ${report.market_overview || "—"}. تحديث المحافظ: ${report.portfolio_update || "—"}. أهم ما نراقبه: ${report.watch_next || "—"}.`
    : `This report covers ${new Date(`${report.week_start}T12:00:00`).toLocaleDateString(locale)} to ${new Date(`${report.week_end}T12:00:00`).toLocaleDateString(locale)}. Executive summary: ${report.summary}. Market: ${report.market_overview || "—"}. Portfolio update: ${report.portfolio_update || "—"}. Key items to watch: ${report.watch_next || "—"}.`;

  return (
    <div className="dashboard-shell weekly-detail-shell-v23 weekly-detail-shell-v3">
      <DashboardHeader />
      {message && <div className="notice-bar">{message}</div>}
      <main ref={reportRef} className="weekly-detail-v23 weekly-detail-v3">
        <div className="weekly-detail-toolbar-v3" data-html2canvas-ignore="true"><Link className="back-link" to="/weekly-reports"><BackIcon size={15}/>{isArabic ? "كل التقارير" : "All reports"}</Link><div><InsightDrawer label={isArabic ? "اشرح التقرير" : "Explain this report"} title={isArabic ? "ملخص التقرير الأسبوعي" : "Weekly report brief"} summary={aiSummary}/><button className="button gold" type="button" onClick={exportPdf} disabled={exporting}><Download size={15}/>{exporting ? (isArabic ? "جاري التجهيز" : "Preparing") : "PDF"}</button></div></div>

        <div className="pdf-brand-strip-v31"><Brand staticMode/><span><small>{isArabic ? "تقرير أسبوعي منشور" : "PUBLISHED WEEKLY REPORT"}</small><b>{dateTimeLabel(report.updated_at || report.published_at, locale)}</b></span></div>

        <header className="weekly-detail-header-v3"><div className="weekly-report-label-v3"><span>ALPHA WEEKLY</span><b>W{getWeekNumber(report.week_end)}</b></div><span className="eyebrow">INSTITUTIONAL MARKET REPORT</span><h1>{report.title}</h1><p>{report.summary}</p><div className="weekly-report-meta-v3"><span><CalendarRange size={16}/><small>{isArabic ? "الفترة" : "REPORTING PERIOD"}</small><b>{new Date(`${report.week_start}T12:00:00`).toLocaleDateString(locale)} — {new Date(`${report.week_end}T12:00:00`).toLocaleDateString(locale)}</b></span><span><ShieldCheck size={16}/><small>{isArabic ? "آخر تحديث" : "LAST UPDATED"}</small><b>{dateTimeLabel(report.updated_at || report.published_at, locale)}</b></span></div></header>

        <section className="weekly-executive-summary-v3"><div><Sparkles/><span><small>EXECUTIVE SUMMARY</small><p>{report.summary}</p></span></div></section>

        <section className="weekly-sections-v23 weekly-sections-v3">
          <ReportSection number="01" icon={<BarChart3/>} eyebrow="MARKET RECAP" title={isArabic ? "ما حدث في السوق" : "What happened in the market"} body={report.market_overview}/>
          <ReportSection number="02" icon={<Layers3/>} eyebrow="PORTFOLIOS" title={isArabic ? "تحديث المحافظ" : "Portfolio update"} body={report.portfolio_update}/>
          <ReportSection number="03" icon={<Coins/>} eyebrow="ALTERNATIVES" title={isArabic ? "الذهب والأصول البديلة" : "Gold and alternative assets"} body={report.gold_update}/>
          <ReportSection number="04" icon={<Eye/>} eyebrow="NEXT WEEK" title={isArabic ? "ما نراقبه الأسبوع القادم" : "What we are watching next"} body={report.watch_next}/>
        </section>

        <AuthorAttribution profile={author} authorId={report.created_by} label={isArabic ? "أعده ونشره" : "RESEARCHED & PUBLISHED BY"}/>
        <footer className="report-disclaimer-v21"><ShieldCheck size={14}/>{isArabic ? settings.disclaimer_ar : settings.disclaimer_en}</footer>
      </main>
    </div>
  );
}

function ReportSection({ number, icon, eyebrow, title, body }) {
  return <article className="panel-v21 padded-v21 weekly-section-v23 weekly-section-v3"><header><span>{number}</span><i>{icon}</i></header><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{body || "—"}</p></article>;
}

function getWeekNumber(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  const first = new Date(date.getFullYear(), 0, 1);
  return String(Math.ceil((((date - first) / 86400000) + first.getDay() + 1) / 7)).padStart(2, "0");
}
