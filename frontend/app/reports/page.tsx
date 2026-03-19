"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const lineData = Array.from({ length: 14 }).map((_, i) => ({
  day: `D${i + 1}`,
  sessions: 12 + Math.round(Math.random() * 18),
  detections: 2 + Math.round(Math.random() * 8),
}));

const signalData = [
  { signal: "Xception", count: 42 },
  { signal: "Temporal", count: 26 },
  { signal: "rPPG", count: 19 },
  { signal: "Liveness", count: 24 },
  { signal: "Audio", count: 31 },
];

const pieData = [
  { name: "Authentic", value: 62, color: "#10B981" },
  { name: "Suspicious", value: 23, color: "#F59E0B" },
  { name: "Deepfake", value: 15, color: "#FF4444" },
];

export default function ReportsPage() {
  const [range, setRange] = useState("30d");
  const metrics = useMemo(
    () => ({
      total: 324,
      deepfakes: 49,
      rate: 15.1,
      avgProcessing: 8.4,
    }),
    [range],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl text-text-primary">Reports</h1>
        <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded border border-bg-border bg-bg-surface px-2 py-1 text-xs">
          <option value="7d">Last 7d</option>
          <option value="30d">Last 30d</option>
          <option value="90d">Last 90d</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Total Sessions" value={metrics.total} />
        <MetricCard label="Deepfakes Detected" value={metrics.deepfakes} tone="danger" />
        <MetricCard label="Detection Rate" value={`${metrics.rate}%`} tone="warning" />
        <MetricCard label="Avg Processing Time" value={`${metrics.avgProcessing}s`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h2 className="mb-2 font-display text-sm">Daily Sessions + Detections</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sessions" stroke="#00D4FF" strokeWidth={2} />
                <Line type="monotone" dataKey="detections" stroke="#FF4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h2 className="mb-2 font-display text-sm">Detections by Signal Type</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="signal" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#00D4FF" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h2 className="mb-2 font-display text-sm">Verdict Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h2 className="mb-2 font-display text-sm">Top Manipulation Types</h2>
          <table className="min-w-full text-left text-xs">
            <thead className="text-text-muted">
              <tr><th className="py-1">Type</th><th>Count</th><th>Share</th></tr>
            </thead>
            <tbody>
              <tr className="border-b border-bg-border/30"><td className="py-2">Face Swap</td><td>19</td><td>38%</td></tr>
              <tr className="border-b border-bg-border/30"><td className="py-2">Voice Clone</td><td>13</td><td>26%</td></tr>
              <tr className="border-b border-bg-border/30"><td className="py-2">Replay Attack</td><td>10</td><td>20%</td></tr>
              <tr><td className="py-2">GAN Artifact</td><td>8</td><td>16%</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "danger" | "warning" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-accent-cyan";
  return (
    <div className="rounded-xl border border-bg-border bg-bg-surface/70 p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`mt-1 font-display text-2xl ${color}`}>{value}</div>
    </div>
  );
}
