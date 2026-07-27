import { useMemo, useRef, useState } from "react";
import { Copy, Download, FileArchive, FileText, Sparkles, X } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { buildAiSummary, buildPortfolioReport, buildSocialCopy, safeFilePart } from "../lib/reporting";
import { dateTimeLabel, formatNumber, formatPercent } from "../lib/calculations";
import { createZipBlob, downloadBlob } from "../lib/zip";

export default function PortfolioReportStudio({ open, onClose, portfolio, month, months, isArabic, locale, onMessage }) {
  const [reportType, setReportType] = useState("monthly");
  const [activeText, setActiveText] = useState("ai");
  const [working, setWorking] = useState(false);
  const reportRef = useRef(null);
  const report = useMemo(() => month ? buildPortfolioReport({ portfolio, month, months, locale, isArabic, reportType }) : null, [portfolio, month, months, locale, isArabic, reportType]);
  const aiSummary = useMemo(() => report ? buildAiSummary(report, isArabic, locale) : "", [report, isArabic, locale]);
  const socialCopy = useMemo(() => report ? buildSocialCopy(report, isArabic) : "", [report, isArabic]);

  if (!open || !report) return null;

  const fileBase = `${safeFilePart(report.portfolioName)}-${month.month_key}-${reportType}`;

  const createPdfBlob = async () => {
    if (!reportRef.current) throw new Error(isArabic ? "تعذر تجهيز التقرير" : "Could not prepare the report.");
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: 1280,
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * usableWidth) / canvas.width;
    const image = canvas.toDataURL("image/jpeg", 0.94);
    let remaining = imageHeight;
    let y = margin;
    pdf.addImage(image, "JPEG", margin, y, usableWidth, imageHeight, undefined, "FAST");
    remaining -= pageHeight - margin * 2;
    while (remaining > 0) {
      pdf.addPage();
      y = margin - (imageHeight - remaining);
      pdf.addImage(image, "JPEG", margin, y, usableWidth, imageHeight, undefined, "FAST");
      remaining -= pageHeight - margin * 2;
    }

    // Text appendix keeps the key data machine-readable for AI and document tools.
    pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("ALPHA CORE - AI-READABLE DATA APPENDIX", margin, 20);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const ascii = (value) => String(value ?? "").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
    const appendix = [
      `Portfolio: ${ascii(report.portfolioName) || "ALPHA CORE Portfolio"}`,
      `Period: ${report.frequency} - ${report.monthLabel}`,
      `Status: ${report.status}`,
      `Last Updated: ${report.updatedAtLabel}`,
      `Benchmark: ${report.benchmarkTicker}`,
      `Portfolio Return: ${formatPercent(report.portfolioReturn)}`,
      `Benchmark Return: ${formatPercent(report.benchmarkReturn)}`,
      `Alpha: ${formatPercent(report.alpha)}`,
      `Cumulative Portfolio Return: ${formatPercent(report.cumulativePortfolio)}`,
      `Cumulative Benchmark Return: ${formatPercent(report.cumulativeBenchmark)}`,
      `Cumulative Alpha: ${formatPercent(report.cumulativeAlpha)}`,
      `Best Stock: ${report.best ? `${report.best.ticker} ${formatPercent(report.best.mtd)}` : "N/A"}`,
      `Worst Stock: ${report.worst ? `${report.worst.ticker} ${formatPercent(report.worst.mtd)}` : "N/A"}`,
      "",
      "Holdings:",
      ...report.rows.map((row) => `${row.ticker} | Weight ${formatNumber(row.weight, 2, locale)}% | Open ${formatNumber(row.open_price, 2, locale)} | Latest ${formatNumber(row.close_price, 2, locale)} | Return ${formatPercent(row.mtd)} | Contribution ${formatPercent(row.contribution)}`),
      "",
      `Disclaimer: ${ascii(report.disclaimer) || "Educational information only. Not personalised investment advice."}`,
    ];
    let textY = 30;
    for (const line of appendix) {
      const wrapped = pdf.splitTextToSize(line, usableWidth);
      if (textY + wrapped.length * 4.5 > pageHeight - 15) {
        pdf.addPage();
        textY = 18;
      }
      pdf.text(wrapped, margin, textY);
      textY += Math.max(4.5, wrapped.length * 4.5);
    }
    return pdf.output("blob");
  };

  const exportPdf = async () => {
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

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      onMessage?.(isArabic ? `تم نسخ ${label}` : `${label} copied.`);
    } catch {
      onMessage?.(isArabic ? "تعذر النسخ التلقائي. النص ظاهر وجاهز للنسخ." : "Automatic copy failed. The text is visible and ready to copy.");
    }
  };

  const createMarketingPackage = async () => {
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
          <button className="button gold" disabled={working} onClick={exportPdf}><Download size={15}/>{isArabic ? "Generate Portfolio Report" : "Generate Portfolio Report"}</button>
          <button className="button subtle" onClick={() => { setActiveText("ai"); copyText(aiSummary, "AI Summary"); }}><Sparkles size={15}/>Generate AI Summary</button>
          <button className="button green" disabled={working} onClick={createMarketingPackage}><FileArchive size={15}/>Create Marketing Package</button>
        </div>

        <div className="report-studio-layout-v231">
          <div className="report-preview-shell-v231">
            <PortfolioReportDocument report={report} locale={locale} isArabic={isArabic} reportRef={reportRef}/>
          </div>

          <aside className="report-copy-panel-v231" data-html2canvas-ignore="true">
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

function PortfolioReportDocument({ report, locale, isArabic, reportRef }) {
  return (
    <article className="portfolio-report-document-v231" ref={reportRef} dir={isArabic ? "rtl" : "ltr"}>
      <header className="portfolio-report-brand-v231">
        <div className="report-logo-v231"><b>AC</b><span><strong>ALPHA CORE</strong><small>INDEPENDENT PERFORMANCE INTELLIGENCE</small></span></div>
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
          <tbody>{report.rows.map((row) => <tr key={row.id || row.ticker}><td><b>{row.ticker}</b></td><td>{formatNumber(row.weight, 2, locale)}%</td><td>{formatNumber(row.open_price, 2, locale)}</td><td>{formatNumber(row.close_price, 2, locale)}</td><td>{formatPercent(row.mtd)}</td><td>{formatPercent(row.contribution)}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="portfolio-report-best-worst-v231">
        <div><small>{isArabic ? "أفضل سهم" : "Best stock"}</small><b>{report.best?.ticker || "—"}</b><span>{report.best ? formatPercent(report.best.mtd) : "—"}</span></div>
        <div><small>{isArabic ? "أسوأ سهم" : "Worst stock"}</small><b>{report.worst?.ticker || "—"}</b><span>{report.worst ? formatPercent(report.worst.mtd) : "—"}</span></div>
      </section>

      <section className="portfolio-report-section-v231"><h2>{isArabic ? "ملاحظات الاستراتيجية" : "Strategy notes"}</h2><p>{report.strategyNotes}</p></section>
      {report.changes.length > 0 && <section className="portfolio-report-section-v231"><h2>{isArabic ? "أهم التغييرات" : "Key changes"}</h2><ul>{report.changes.map((change) => <li key={change}>{change}</li>)}</ul></section>}
      <section className="portfolio-report-guidance-v231"><div><h2>{isArabic ? "تعليمات المستثمر الحالي" : "Existing investor guidance"}</h2><p>{report.currentGuidance}</p></div><div><h2>{isArabic ? "تعليمات المستثمر الجديد" : "New investor guidance"}</h2><p>{report.newGuidance}</p></div></section>
      <footer><b>ALPHA CORE</b><span>{report.disclaimer}</span><small>{dateTimeLabel(report.updatedAt, locale)}</small></footer>
    </article>
  );
}

function ReportKpi({ label, value, emphasis = false }) {
  return <div className={emphasis ? "emphasis" : ""}><small>{label}</small><b>{value}</b></div>;
}
