import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
        <LineChart data={data} margin={{ top: 18, right: 14, left: -8, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#788596", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => `${value}%`} tick={{ fill: "#788596", fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: "#111820", border: "1px solid #2b3541", borderRadius: 12, color: "#f6f8fb" }}
            labelStyle={{ color: "#c5a059", fontWeight: 800, marginBottom: 7 }}
            formatter={(value, name) => [formatPercent(value), name]}
          />
          <Legend wrapperStyle={{ fontSize: 10, color: "#94a0af" }} />
          <Line name={t("cumulativePortfolio")} type="monotone" dataKey="cumulativePortfolio" stroke="#1ec8e5" strokeWidth={3} dot={{ r: 3, fill: "#1ec8e5" }} activeDot={{ r: 5 }} />
          <Line name={t("cumulativeBenchmark")} type="monotone" dataKey="cumulativeBenchmark" stroke="#c5a059" strokeWidth={2.5} dot={{ r: 3, fill: "#c5a059" }} activeDot={{ r: 5 }} />
          <Line name={t("cumulativeAlpha")} type="monotone" dataKey="cumulativeAlpha" stroke="#e8edf4" strokeWidth={2} dot={{ r: 2.5, fill: "#e8edf4" }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
