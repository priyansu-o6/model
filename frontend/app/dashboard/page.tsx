"use client";

import { useEffect, useState } from "react";

import { getDashboardStats, getSessions, getSignalMetrics } from "@/lib/api";
import { DashboardStats, Session, useAppStore } from "@/lib/store";
import RiskBadge from "@/components/ui/RiskBadge";
import SessionStatusBadge from "@/components/ui/SessionStatusBadge";

type SignalMetrics = Record<string, { accuracy: number }>;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<SignalMetrics | null>(null);

  const { dashboardStats, setDashboardStats, sessions, setSessions } = useAppStore();

  useEffect(() => {
    async function load() {
      try {
        const [statsResp, sessionsResp, signalsResp] = await Promise.allSettled([
          getDashboardStats(),
          getSessions({ page: 1, limit: 10 }),
          getSignalMetrics(),
        ]);

        if (statsResp.status === "fulfilled") {
          setDashboardStats(statsResp.value as DashboardStats);
        }
        if (sessionsResp.status === "fulfilled") {
          setSessions((sessionsResp.value.items ?? []) as Session[]);
        }
        if (signalsResp.status === "fulfilled") {
          setSignals(signalsResp.value as SignalMetrics);
        }
      } catch {
        setError("Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setDashboardStats, setSessions]);

  const stats = dashboardStats ?? {
    total_sessions: 0,
    authentic_count: 0,
    deepfake_count: 0,
    suspicious_count: 0,
    average_risk_score: 0,
  };

  return (
    <div className="space-y-6">
      {/* Section A: Hero stats */}
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Verifications" value={stats.total_sessions} />
        <StatCard label="Flagged Sessions" value={stats.deepfake_count + stats.suspicious_count} tone="danger" />
        <StatCard label="Average Risk Score" value={Math.round(stats.average_risk_score)} />
        <StatCard label="Active Live Sessions" value={0} tone="safe" />
      </section>

      {/* Section B: Recent sessions table (simplified placeholder) */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-lg border border-bg-border bg-bg-surface/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm text-text-primary">Recent Verifications</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-bg-border text-text-muted">
                <tr>
                  <th className="px-2 py-2 font-medium">Session</th>
                  <th className="px-2 py-2 font-medium">Mode</th>
                  <th className="px-2 py-2 font-medium">Started</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-bg-border/40 last:border-0">
                    <td className="px-2 py-2 font-mono text-[11px] text-text-muted">{s.id.slice(0, 8)}</td>
                    <td className="px-2 py-2 text-xs capitalize text-text-primary">{s.mode}</td>
                    <td className="px-2 py-2 text-xs text-text-muted">
                      {new Date(s.started_at).toLocaleTimeString()}
                    </td>
                    <td className="px-2 py-2">
                      <SessionStatusBadge status={s.status as any} />
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-xs text-text-muted">
                      No sessions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-lg border border-bg-border bg-bg-surface/70 p-4">
          <h2 className="mb-3 font-display text-sm text-text-primary">Risk Distribution</h2>
          <p className="text-xs text-text-muted">Charts will be added in a later session.</p>
        </div>
      </section>

      {/* Section C: Signal accuracy (simplified cards) */}
      <section className="grid gap-3 md:grid-cols-5">
        {signals &&
          Object.entries(signals).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-bg-border bg-bg-surface/70 p-3">
              <div className="text-xs uppercase tracking-wide text-text-muted">{key}</div>
              <div className="mt-1 font-display text-lg text-accent-cyan">{Math.round(value.accuracy * 100)}%</div>
            </div>
          ))}
      </section>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "danger" | "safe";
}

function StatCard({ label, value, tone = "default" }: StatCardProps) {
  const color =
    tone === "danger" ? "text-danger" : tone === "safe" ? "text-safe" : "text-accent-cyan";

  return (
    <div className="rounded-lg border-l-2 border-accent-cyan bg-bg-surface/80 px-4 py-3 shadow-sm">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`font-display text-2xl ${color}`}>{value}</div>
    </div>
  );
}

