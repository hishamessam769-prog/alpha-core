import { useMemo, useRef, useState } from "react";
import { Copy, Download, FileArchive, FileText, Sparkles, X } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { buildAiSummary, buildPortfolioReport, buildSocialCopy, safeFilePart } from "../lib/reporting";
import { dateTimeLabel, formatNumber, formatPercent } from "../lib/calculations";
import { createZipBlob, downloadBlob } from "../lib/zip";
import { useAuth } from "../context/AuthContext";
import { usePlatformSettings } from "../context/SettingsContext";

export default function PortfolioReportStudio({ open, onClose, portfolio, month, months, isArabic, locale, onMessage }) {
  const { profile } = useAuth();
  const { settings } = usePlatformSettings();
  const [reportType, setReportType] = useState("monthly");
  const [activeText, setActiveText] = useState("ai");
  const [working, setWorking] = useState(false);
  const reportRef = useRef(null);
  const report = useMemo(() => month ? buildPortfolioReport({ portfolio, month, months, locale, isArabic, reportType }) : null, [portfolio, month, months, locale, isArabic, reportType]);
  const aiSummary = useMemo(() => report ? buildAiSummary(report, isArabic, locale) : "", [report, isArabic, locale]);
  const socialCopy = useMemo(() => report ? buildSocialCopy(report, isArabic) : "", [report, isArabic]);

  const isSuperAdmin = Boolean(profile?.is_super_admin);

  if (!isSuperAdmin || !open || !report) return null;

  const fileBase = `${safeFilePart(report.portfolioName)}-${month.month_key}-${reportType}`;

  const waitForExportAssets = async (root) => {
    if (document.fonts?.ready) await document.fonts.ready;
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(images.map((image) => {
      if (image.complete) return image.decode?.().catch(() => undefined) || Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };

  const createA4Canvas = async () => {
    if (!reportRef.current) throw new Error(isArabic ? "تعذر تجهيز التقرير" : "Could not prepare the report.");

    const stage = document.createElement("div");
    stage.className = "portfolio-export-stage-v344";
    const exportDocument = reportRef.current.cloneNode(true);
    exportDocument.classList.add("portfolio-report-export-v344");
    exportDocument.querySelectorAll(".exclude-from-export,[data-export-exclude='true'],[data-html2canvas-ignore='true']").forEach((element) => element.remove());
    stage.appendChild(exportDocument);
    document.body.appendChild(stage);

    try {
      await waitForExportAssets(exportDocument);
      const sourceCanvas = await html2canvas(exportDocument, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(794, exportDocument.scrollWidth),
        width: exportDocument.scrollWidth,
        height: exportDocument.scrollHeight,
        ignoreElements: (element) => element.classList?.contains("exclude-from-export") || element.dataset?.exportExclude === "true",
      });

      // A4 at 300 DPI. The report is proportionally fitted inside one page,
      // preventing clipped cards, overlapping text, or accidental extra pages.
      const a4Canvas = document.createElement("canvas");
      a4Canvas.width = 2480;
      a4Canvas.height = 3508;
      const context = a4Canvas.getContext("2d");
      if (!context) throw new Error(isArabic ? "تعذر إنشاء صفحة A4" : "Could not create the A4 export canvas.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, a4Canvas.width, a4Canvas.height);

      const margin = 94; // Approximately 8 mm at 300 DPI.
      const availableWidth = a4Canvas.width - margin * 2;
      const availableHeight = a4Canvas.height - margin * 2;
      const fitScale = Math.min(availableWidth / sourceCanvas.width, availableHeight / sourceCanvas.height);
      const drawWidth = Math.round(sourceCanvas.width * fitScale);
      const drawHeight = Math.round(sourceCanvas.height * fitScale);
      const drawX = Math.round((a4Canvas.width - drawWidth) / 2);
      const drawY = margin;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);
      return a4Canvas;
    } finally {
      stage.remove();
    }
  };

  const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(isArabic ? "تعذر إنشاء الملف" : "Could not create the export file.")), type, quality);
  });

  const createPdfBlob = async () => {
    const a4Canvas = await createA4Canvas();
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const image = a4Canvas.toDataURL("image/jpeg", 0.96);
    pdf.addImage(image, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    return pdf.output("blob");
  };

  const createImageBlob = async () => {
    const a4Canvas = await createA4Canvas();
    return canvasToBlob(a4Canvas, "image/png");
  };

  const exportPdf = async () => {
    if (!isSuperAdmin) return;
    setWorking(true);
    try {
      const blob = await createPdfBlob();
      downloadBlob(blob, `${fileBase}.pdf`);
      onMessage?.(isArabic ? "تم إنشاء Portfolio Report PDF" : "Portfolio Report PDF generated.");
    } catch (error) {
      onMessage?.(error.message);
    } finally {
      setWorking(false);
    }
  };

  const exportImage = async () => {
    if (!isSuperAdmin) return;
    setWorking(true);
    try {
      const blob = await createImageBlob();
      downloadBlob(blob, `${fileBase}-linkedin-a4.png`);
      onMessage?.(isArabic ? "تم إنشاء صورة A4 عالية الجودة لـ LinkedIn" : "High-resolution A4 LinkedIn image generated.");
    } catch (error) {
      onMessage?.(error.message);
    } finally {
      setWorking(false);
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      onMessage?.(isArabic ? `تم نسخ ${label}` : `${label} copied.`);
    } catch {
      onMessage?.(isArabic ? "تعذر النسخ التلقائي. النص ظاهر وجاهز للنسخ." : "Automatic copy failed. The text is visible and ready to copy.");
    }
  };

  const createMarketingPackage = async () => {
    if (!isSuperAdmin) return;
    setWorking(true);
    try {
      const pdfBlob = await createPdfBlob();
      const packageBlob = await createZipBlob([
        { name: `${fileBase}.pdf`, data: pdfBlob },
        { name: `${fileBase}-ai-summary.txt`, data: aiSummary },
        { name: `${fileBase}-social-media-copy.txt`, data: socialCopy },
      ]);
      downloadBlob(packageBlob, `${fileBase}-marketing-package.zip`);
      onMessage?.(isArabic ? "تم إنشاء Marketing Package: PDF + AI Summary + Social Media Copy" : "Marketing Package created: PDF + AI Summary + Social Media Copy.");
    } catch (error) {
      onMessage?.(error.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="report-studio-overlay-v231" role="dialog" aria-modal="true">
      <div className="report-studio-modal-v231">
        <header className="report-studio-toolbar-v231" data-html2canvas-ignore="true">
          <div>
            <span className="eyebrow">ALPHA CORE REPORT STUDIO</span>
            <h2>{isArabic ? "تقرير المحفظة وحزمة التسويق" : "Portfolio report and marketing package"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button>
        </header>

        <div className="report-studio-actions-v231" data-html2canvas-ignore="true">
          <label>{isArabic ? "نوع التقرير" : "Report type"}
            <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
              <option value="daily">{isArabic ? "يومي" : "Daily"}</option>
              <option value="weekly">{isArabic ? "أسبوعي" : "Weekly"}</option>
              <option value="monthly">{isArabic ? "شهري" : "Monthly"}</option>
            </select>
          </label>
          <button className="button gold" disabled={working} onClick={exportPdf}><Download size={15}/>{isArabic ? "تحميل تقرير A4 PDF" : "Download A4 PDF"}</button>
          <button className="button subtle" disabled={working} onClick={exportImage}><Download size={15}/>{isArabic ? "صورة A4 لـ LinkedIn" : "LinkedIn A4 Image"}</button>
          <button className="button subtle" onClick={() => { setActiveText("ai"); copyText(aiSummary, "AI Summary"); }}><Sparkles size={15}/>Generate AI Summary</button>
          <button className="button green" disabled={working} onClick={createMarketingPackage}><FileArchive size={15}/>Create Marketing Package</button>
        </div>

        <div className="report-studio-layout-v231">
          <div className="report-preview-shell-v231">
            <PortfolioReportDocument report={report} locale={locale} isArabic={isArabic} reportRef={reportRef} settings={settings}/>
          </div>

          <aside className="report-copy-panel-v231 exclude-from-export" data-html2canvas-ignore="true" data-export-exclude="true">
            <div className="copy-tabs-v231">
              <button className={activeText === "ai" ? "active" : ""} onClick={() => setActiveText("ai")}><Sparkles size={13}/>AI Summary</button>
              <button className={activeText === "social" ? "active" : ""} onClick={() => setActiveText("social")}><FileText size={13}/>Social Copy</button>
            </div>
            <textarea readOnly value={activeText === "ai" ? aiSummary : socialCopy}/>
            <button className="button subtle full" onClick={() => copyText(activeText === "ai" ? aiSummary : socialCopy, activeText === "ai" ? "AI Summary" : "Social Media Copy")}><Copy size={15}/>{isArabic ? "نسخ النص" : "Copy text"}</button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PortfolioReportDocument({ report, locale, isArabic, reportRef, settings }) {
  return (
    <article className="portfolio-report-document-v231" ref={reportRef} dir={isArabic ? "rtl" : "ltr"}>
      <header className="portfolio-report-brand-v231">
        <div className="report-logo-v231">{settings.logo_url ? <img src={settings.logo_url} alt="ALPHA PLATFORM" crossOrigin="anonymous"/> : <b>AC</b>}<span><strong>ALPHA CORE</strong><small>INDEPENDENT PERFORMANCE INTELLIGENCE</small></span></div>
        <div><small>{report.frequency}</small><b>{report.monthLabel}</b></div>
      </header>

      <section className="portfolio-report-title-v231">
        <span>{report.status}</span>
        <h1>{report.portfolioName}</h1>
        <p>{isArabic ? "تقرير أداء المحفظة مقابل المؤشر المرجعي" : "Portfolio performance report versus the selected benchmark"}</p>
        <div><span>{isArabic ? "آخر تحديث" : "Last updated"}: {report.updatedAtLabel}</span><span>{isArabic ? "المؤشر" : "Benchmark"}: {report.benchmarkTicker}</span></div>
      </section>

      <section className="portfolio-report-kpis-v231">
        <ReportKpi label={isArabic ? "عائد المحفظة" : "Portfolio Return"} value={formatPercent(report.portfolioReturn)}/>
        <ReportKpi label={isArabic ? "عائد المؤشر" : "Benchmark Return"} value={formatPercent(report.benchmarkReturn)}/>
        <ReportKpi label="Alpha" value={formatPercent(report.alpha)} emphasis/>
        <ReportKpi label={isArabic ? "العائد التراكمي للمحفظة" : "Cumulative Portfolio"} value={formatPercent(report.cumulativePortfolio)}/>
        <ReportKpi label={isArabic ? "العائد التراكمي للمؤشر" : "Cumulative Benchmark"} value={formatPercent(report.cumulativeBenchmark)}/>
        <ReportKpi label={isArabic ? "الألفا التراكمية" : "Cumulative Alpha"} value={formatPercent(report.cumulativeAlpha)} emphasis/>
      </section>

      <section className="portfolio-report-section-v231">
        <h2>{isArabic ? "الأسهم والأوزان والأداء" : "Holdings, weights and performance"}</h2>
        <table>
          <thead><tr><th>{isArabic ? "السهم" : "Ticker"}</th><th>{isArabic ? "الوزن" : "Weight"}</th><th>{isArabic ? "سعر البداية" : "Open"}</th><th>{isArabic ? "السعر الحالي" : "Latest"}</th><th>{isArabic ? "العائد" : "Return"}</th><th>{isArabic ? "المساهمة" : "Contribution"}</th></tr></thead>
          <tbody>{report.rows.map((row) => <tr key={row.id || row.ticker}><td><b>{row.ticker}</b>{row.investment_thesis && <small className="report-thesis-v31">{row.investment_thesis}</small>}</td><td>{formatNumber(row.weight, 2, locale)}%</td><td>{formatNumber(row.open_price, 2, locale)}</td><td>{formatNumber(row.close_price, 2, locale)}</td><td>{formatPercent(row.mtd)}</td><td>{formatPercent(row.contribution)}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="portfolio-report-best-worst-v231">
        <div><small>{isArabic ? "أفضل سهم" : "Best stock"}</small><b>{report.best?.ticker || "—"}</b><span>{report.best ? formatPercent(report.best.mtd) : "—"}</span></div>
        <div><small>{isArabic ? "أسوأ سهم" : "Worst stock"}</small><b>{report.worst?.ticker || "—"}</b><span>{report.worst ? formatPercent(report.worst.mtd) : "—"}</span></div>
      </section>

      <section className="portfolio-report-section-v231"><h2>{isArabic ? "ملاحظات الاستراتيجية" : "Strategy notes"}</h2><p>{report.strategyNotes}</p></section>
      {report.changes.length > 0 && <section className="portfolio-report-section-v231"><h2>{isArabic ? "أهم التغييرات" : "Key changes"}</h2><ul>{report.changes.map((change) => <li key={change}>{change}</li>)}</ul></section>}
      <section className="portfolio-report-guidance-v231"><div><h2>{isArabic ? "تعليمات المستثمر الحالي" : "Existing investor guidance"}</h2><p>{report.currentGuidance}</p></div><div><h2>{isArabic ? "تعليمات المستثمر الجديد" : "New investor guidance"}</h2><p>{report.newGuidance}</p></div></section>
      <footer><b>ALPHA CORE</b><span>{(isArabic ? settings.disclaimer_ar : settings.disclaimer_en) || report.disclaimer}</span><small>{dateTimeLabel(report.updatedAt, locale)}</small></footer>
    </article>
  );
}

function ReportKpi({ label, value, emphasis = false }) {
  return <div className={emphasis ? "emphasis" : ""}><small>{label}</small><b>{value}</b></div>;
}
