import {
  Area, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { formatPercent } from "../lib/calculations";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey}>
          <span style={{ color: item.color }}>{item.name}</span>
          <b>{formatPercent(item.value)}</b>
        </div>
      ))}
    </div>
  );
}

export default function PerformanceChart({ data }) {
  return (
    <div className="performance-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 18, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="alphaArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffffff" stopOpacity={0.17}/>
              <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/>
          <XAxis dataKey="label" tick={{ fill: "#758294", fontSize: 11 }} axisLine={false} tickLine={false}/>
          <YAxis tick={{ fill: "#758294", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`}/>
          <Tooltip content={<CustomTooltip />}/>
          <Legend wrapperStyle={{ fontSize: 11 }}/>
          <Area type="monotone" dataKey="cumulativeAlpha" name="Cumulative Alpha" stroke="#F5F7FA" fill="url(#alphaArea)" strokeWidth={1.4}/>
          <Line type="monotone" dataKey="cumulativePortfolio" name="Portfolio" stroke="#00B4D8" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }}/>
          <Line type="monotone" dataKey="cumulativeBenchmark" name="EGX30 Capped" stroke="#C5A059" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
