import { ArrowUpRight, CalendarClock, Clock3, Newspaper, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { splitEventLines } from "../lib/content";
import { dateTimeLabel } from "../lib/calculations";
import { RECOMMENDATION_IMAGE_TITLE } from "../lib/recommendationMedia";

export default function MarketNewsWidget({ reports = [], recommendations = [], updates = [], isArabic = false, locale = "en-GB" }) {
  const latestReport = reports[0];
  const latestUpdate = updates.find((item) => item.title !== RECOMMENDATION_IMAGE_TITLE);
  const parentRecommendation = recommendations.find((item) => item.id === latestUpdate?.recommendation_id);
  const events = splitEventLines(latestReport?.watch_next).slice(0, 3);
  const latestRecommendation = recommendations[0];
  return (
    <section className="market-news-widget-v32 panel-v21">
      <div className="market-news-heading-v32"><div><span className="eyebrow">MARKET NEWS & ECONOMIC EVENTS</span><h2>{isArabic ? "موجز السوق الآن" : "Market intelligence at a glance"}</h2><p>{isArabic ? "آخر تقرير وتحديث شركة وأهم ما نراقبه في مكان واحد." : "The latest report, company update and events the desk is watching in one view."}</p></div><Link to="/news">{isArabic ? "فتح غرفة الأخبار" : "Open newsroom"}<ArrowUpRight size={15}/></Link></div>
      <div className="market-news-grid-v32">
        <Link className="market-news-lead-v32" to={latestReport ? `/news/report/${latestReport.id}` : "/news"}><span><Newspaper/></span><div><small>{isArabic ? "أحدث تقرير" : "LATEST REPORT"}</small><h3>{latestReport?.title || (isArabic ? "لا يوجد تقرير منشور بعد" : "No published report yet")}</h3><p>{latestReport?.summary || (isArabic ? "سيظهر أحدث تقرير أسبوعي هنا تلقائيًا." : "The latest weekly report will appear here automatically.")}</p><em><Clock3 size={14}/>{dateTimeLabel(latestReport?.published_at || latestReport?.updated_at, locale)}</em></div><ArrowUpRight/></Link>
        <div className="market-news-side-v32">
          <Link to={latestUpdate ? `/news/update/${latestUpdate.id}` : latestRecommendation ? `/news/recommendation/${latestRecommendation.id}` : "/news"}><TrendingUp/><span><small>{isArabic ? "تحديث شركة" : "COMPANY UPDATE"}</small><b>{latestUpdate?.title || latestRecommendation?.title || (isArabic ? "لا يوجد تحديث حالي" : "No current update")}</b><p>{latestUpdate?.body || latestRecommendation?.thesis || latestRecommendation?.why_selected || "—"}</p><em>{parentRecommendation?.ticker || latestRecommendation?.ticker || "ALPHA"}</em></span><ArrowUpRight/></Link>
          <div className="market-events-mini-v32"><header><CalendarClock/><span><small>{isArabic ? "أحداث تحت المراقبة" : "EVENTS TO WATCH"}</small><b>{events.length || "—"}</b></span></header>{events.length ? events.map((event, index) => <p key={`${event}-${index}`}><i>{String(index + 1).padStart(2,"0")}</i><span>{event}</span></p>) : <p><i>01</i><span>{isArabic ? "أضف Watch Next في التقرير الأسبوعي ليظهر هنا." : "Add Watch Next items in the weekly report to populate this module."}</span></p>}<Link to="/news"><Sparkles/>{isArabic ? "كل الأخبار والتحليلات" : "All news & analysis"}</Link></div>
        </div>
      </div>
    </section>
  );
}
