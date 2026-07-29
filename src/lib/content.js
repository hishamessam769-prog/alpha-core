export function splitEventLines(value = "") {
  return String(value || "")
    .split(/\n|\r|•|\|/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function articleReadTime(...parts) {
  const words = parts.filter(Boolean).join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.ceil(words / 190));
}

export function buildNewsItems({ reports = [], recommendations = [], updates = [] }) {
  const recommendationMap = Object.fromEntries(recommendations.map((item) => [item.id, item]));
  const reportItems = reports.map((item) => {
    const slug = String(item.slug || "");
    const isMarketNews = slug.startsWith("market-news-");
    const isEconomicUpdate = slug.startsWith("economic-update-");
    const isArticle = isMarketNews || isEconomicUpdate;
    return {
      id: item.id,
      kind: "report",
      contentType: isEconomicUpdate ? "economic" : isMarketNews ? "market" : "weekly",
      category: isEconomicUpdate ? "Economic update" : isMarketNews ? "Market news & analysis" : "Research report",
      title: item.title,
      summary: item.summary,
      publishedAt: item.published_at || item.updated_at || item.week_end,
      authorId: item.created_by,
      route: `/news/report/${item.id}`,
      sourceRoute: isArticle ? null : `/weekly-reports/${item.slug}`,
      readTime: articleReadTime(item.summary, item.market_overview, item.portfolio_update, item.gold_update, item.watch_next),
      accent: isEconomicUpdate ? "violet" : isMarketNews ? "cyan" : "blue",
      content: [item.market_overview, item.portfolio_update, item.gold_update, item.watch_next].filter(Boolean).join(" "),
    };
  });
  const recommendationItems = recommendations.map((item) => ({
    id: item.id,
    kind: "recommendation",
    category: item.sector ? `Stock recommendation · ${item.sector}` : "Stock recommendation",
    title: item.title || `${item.company_name} stock recommendation`,
    summary: item.thesis || item.why_selected || item.company_story || `Investment recommendation for ${item.company_name}.`,
    publishedAt: item.recommendation_date || item.published_at || item.updated_at,
    authorId: item.created_by,
    route: `/news/recommendation/${item.id}`,
    sourceRoute: `/recommendations/${item.id}`,
    readTime: articleReadTime(item.company_story, item.why_selected, item.positives, item.risks, item.valuation),
    accent: "blue",
    ticker: item.ticker,
    content: [item.company_name, item.ticker, item.sector, item.company_story, item.why_selected, item.positives, item.risks, item.valuation].filter(Boolean).join(" "),
  }));
  const updateItems = updates.filter((item) => recommendationMap[item.recommendation_id]).map((item) => {
    const parent = recommendationMap[item.recommendation_id] || {};
    return {
      id: item.id,
      kind: "update",
      category: "Market update",
      title: item.title || `${parent.company_name || parent.ticker || "Company"} update`,
      summary: item.body || "Published company update.",
      publishedAt: item.update_date || item.created_at || item.updated_at,
      authorId: item.created_by || parent.created_by,
      route: `/news/update/${item.id}`,
      sourceRoute: parent.id ? `/recommendations/${parent.id}` : "/recommendations",
      readTime: articleReadTime(item.body),
      accent: "green",
      ticker: parent.ticker,
      parent,
      content: [parent.company_name, parent.ticker, item.title, item.body].filter(Boolean).join(" "),
    };
  });
  return [...reportItems, ...updateItems, ...recommendationItems]
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}

export function mapProfiles(rows = []) {
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

export function authorRole(profile, activity = {}) {
  if (profile?.title) return profile.title;
  if (profile?.position) return profile.position;
  if (profile?.is_super_admin) return "Founder & Super Admin";
  if (profile?.is_admin) return "Platform Administrator";
  if ((activity.portfolios || 0) > 0 || (activity.recommendations || 0) > 0) return "Investment Analyst";
  if ((activity.reports || 0) > 0) return "Research Instructor";
  return "Platform Member";
}
