"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const OFFER_COLORS: Record<string, string> = {
  未接触: "#64748b",
  交渉中: "#3b82f6",
  獲得済み: "#10b981",
  却下: "#ef4444",
};

const PLATFORM_COLORS: Record<string, string> = {
  kickstarter: "#05ce78",
  indiegogo: "#eb1478",
};

interface ChartProps {
  offerChartData: Array<{ name: string; count: number }>;
  categoryChartData: Array<{ name: string; count: number }>;
  platformChartData: Array<{ name: string; count: number }>;
  raisedChartData: Array<{ name: string; raisedM: number }>;
}

export function DashboardCharts({
  offerChartData,
  categoryChartData,
  platformChartData,
  raisedChartData,
}: ChartProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="オファー状況">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={offerChartData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
            >
              {offerChartData.map((entry) => (
                <Cell key={entry.name} fill={OFFER_COLORS[entry.name] ?? "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
          {offerChartData.map((d) => (
            <span key={d.name} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: OFFER_COLORS[d.name] }}
              />
              {d.name} ({d.count})
            </span>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="プラットフォーム別">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={platformChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {platformChartData.map((entry) => (
                <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] ?? "#3b82f6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="カテゴリ別分布">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={categoryChartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#94a3b8"
              fontSize={11}
              width={100}
              tickFormatter={(v) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)}
            />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
            <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="調達額 Top 8（百万ドル）">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={raisedChartData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" stroke="#94a3b8" fontSize={12} />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#94a3b8"
              fontSize={10}
              width={120}
              tickFormatter={(v) => (v.length > 16 ? `${v.slice(0, 16)}…` : v)}
            />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #334155" }}
              formatter={(value: number) => [`$${value}M`, "調達額"]}
            />
            <Bar dataKey="raisedM" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}
