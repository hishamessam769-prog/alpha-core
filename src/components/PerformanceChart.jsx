import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPercent } from "../lib/calculations";
import { useLanguage } from "../context/LanguageContext";

export default function PerformanceChart({ data = [] }) {
  const { t } = useLanguage();
  return (
    <div className="performance-chart" role="img" aria-label={t("performanceOverview")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 24, right: 18, left: -4, bottom: 6 }}>
          <defs>
            <linearGradient id="portfolioAreaV3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#37b7ff" stopOpacity=".26"/><stop offset="88%" stopColor="#37b7ff" stopOpacity="0"/></linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} strokeDasharray="4 6" />
          <XAxis dataKey="label" tick={{ fill: "#738196", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24}/>
          <YAxis tickFormatter={(value) => `${value}%`} tick={{ fill: "#738196", fontSize: 10 }} axisLine={false} tickLine={false} width={48}/>
          <Tooltip cursor={{ stroke: "rgba(32,211,255,.30)", strokeDasharray: "4 4" }} contentStyle={{ background: "rgba(7,20,33,.97)", border: "1px solid #23415c", borderRadius: 14, color: "#f3f8fc", boxShadow: "0 24px 70px rgba(0,0,0,.45)" }} labelStyle={{ color: "#77e4ff", fontWeight: 800, marginBottom: 8 }} formatter={(value, name) => [formatPercent(value), name]}/>
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: "#94a0af", paddingTop: 12 }}/>
          <Area name={t("cumulativePortfolio")} type="monotone" dataKey="cumulativePortfolio" fill="url(#portfolioAreaV3)" stroke="none" animationDuration={1000}/>
          <Line name={t("cumulativePortfolio")} type="monotone" dataKey="cumulativePortfolio" stroke="#37b7ff" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 3, stroke: "#07131f" }} animationDuration={1100}/>
          <Line name={t("cumulativeBenchmark")} type="monotone" dataKey="cumulativeBenchmark" stroke="#8b5cf6" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} animationDuration={1200}/>
          <Line name={t("cumulativeAlpha")} type="monotone" dataKey="cumulativeAlpha" stroke="#f2f5f8" strokeWidth={1.6} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} animationDuration={1300}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
