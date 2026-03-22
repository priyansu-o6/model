"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { getSessions } from "@/lib/api";
import { Session } from "@/lib/store";

const PAGE_SIZE = 20;

export default function SessionsPage() {
  const { pushToast } = useToast();
  const [items, setItems] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "risk" | "verdict">("date");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const start = Date.now();
    async function run() {
      setLoading(true);
      try {
        const res = await getSessions({ page, limit: PAGE_SIZE, mode: mode || undefined, status: statusFilter || undefined });
        if (!mounted) return;
        setItems((res.items ?? []) as Session[]);
        setTotal(Number(res.total ?? 0));
      } catch {
        pushToast("error", "Failed to load sessions");
      } finally {
        const elapsed = Date.now() - start;
        const delay = Math.max(0, 150 - elapsed);
        window.setTimeout(() => mounted && setLoading(false), delay);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [mode, page, pushToast, statusFilter]);

  const sorted = useMemo(() => {
    const next = [...items];
    next.sort((a, b) => {
      if (sortBy === "date") return +new Date(b.started_at) - +new Date(a.started_at);
      return 0;
    });
    return next.filter((s) => {
      if (riskFilter.length === 0) return true;
      const risk = Number((s as unknown as { risk_score?: number }).risk_score ?? 0);
      const level = risk >= 80 ? "critical" : risk >= 60 ? "high" : risk >= 30 ? "medium" : "low";
      return riskFilter.includes(level);
    });
  }, [items, riskFilter, sortBy]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  function toggleRisk(level: string) {
    setRiskFilter((prev) => (prev.includes(level) ? prev.filter((r) => r !== level) : [...prev, level]));
  }

  function exportSelected() {
    const payload = sorted.filter((s) => selectedIds.includes(s.id));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sessions-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} session(s)?`)) return;
    
    try {
      await Promise.all(
        selectedIds.map(id => 
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/sessions/${id}`, { method: 'DELETE' })
        )
      );
      const keep = items.filter((s) => !selectedIds.includes(s.id));
      setItems(keep);
      setSelected({});
      pushToast("success", `Deleted ${selectedIds.length} session(s)`);
    } catch (error) {
      console.error('Delete failed:', error);
      pushToast("error", "Delete failed - check console");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl text-text-primary">Sessions</h1>

      <div className="grid gap-2 rounded-xl border border-bg-border bg-bg-surface/60 p-3 md:grid-cols-6">
        <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-bg-border bg-bg-base px-2 py-1 text-xs">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="complete">Complete</option>
          <option value="failed">Failed</option>
        </select>
        <select aria-label="Filter by mode" value={mode} onChange={(e) => setMode(e.target.value)} className="rounded border border-bg-border bg-bg-base px-2 py-1 text-xs">
          <option value="">All Modes</option>
          <option value="live">Live</option>
          <option value="upload">Upload</option>
        </select>
        <div className="col-span-2 flex items-center gap-1 text-xs">
          {["low", "medium", "high", "critical"].map((level) => (
            <button
              key={level}
              onClick={() => toggleRisk(level)}
              className={`rounded border px-2 py-1 ${riskFilter.includes(level) ? "border-accent-cyan text-accent-cyan" : "border-bg-border text-text-muted"}`}
            >
              {level}
            </button>
          ))}
        </div>
        <select aria-label="Sort sessions" value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "risk" | "verdict")} className="rounded border border-bg-border bg-bg-base px-2 py-1 text-xs">
          <option value="date">Sort: Date</option>
          <option value="risk">Sort: Risk</option>
          <option value="verdict">Sort: Verdict</option>
        </select>
        <div className="flex gap-2">
          <button onClick={exportSelected} className="rounded border border-bg-border px-2 py-1 text-xs">Export selected</button>
          <button onClick={deleteSelected} className="rounded border border-danger/50 px-2 py-1 text-xs text-danger">Delete selected</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-bg-border bg-bg-surface/60 p-8 text-center">
          <div className="text-4xl">🧪</div>
          <p className="mt-2 text-sm text-text-muted">No verification sessions yet. Start your first verification.</p>
          <Link href="/verify/live" className="mt-3 inline-block rounded bg-accent-cyan px-3 py-2 text-xs font-semibold text-bg-base">
            Start Live Verification
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bg-border bg-bg-surface/60">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-bg-border text-text-muted">
              <tr>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Session ID</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Risk Score</th>
                <th className="px-3 py-2">Verdict</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const sData = s as any;
                const subject = sData.subject_name || (sData.media_path ? sData.media_path.split('/').pop() : "Unknown");
                
                let duration = "---";
                if (sData.started_at && sData.completed_at) {
                  const ms = new Date(sData.completed_at).getTime() - new Date(sData.started_at).getTime();
                  duration = `${(ms / 1000).toFixed(1)}s`;
                }
                
                const riskScore = sData.risk_score != null ? `${Math.round(Number(sData.risk_score))}` : "---";
                
                let verdictBadge = "---";
                if (sData.verdict) {
                  const v = String(sData.verdict).toLowerCase();
                  if (v.includes("auth")) {
                    verdictBadge = "✅ Authentic";
                  } else if (v.includes("susp")) {
                    verdictBadge = "⚠️ Suspicious";
                  } else if (v.includes("deep") || v.includes("fake")) {
                    verdictBadge = "🚨 Deepfake";
                  } else {
                    verdictBadge = String(sData.verdict);
                  }
                }
                
                return (
                <tr key={s.id} className="animate-[slideIn_220ms_ease] border-b border-bg-border/30 last:border-0 hover:bg-bg-border/30">
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Select session ${s.id}`}
                      type="checkbox"
                      checked={Boolean(selected[s.id])}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-text-muted">{s.id.slice(0, 12)}</td>
                  <td className="px-3 py-2">{subject}</td>
                  <td className="px-3 py-2 capitalize">{s.mode}</td>
                  <td className="px-3 py-2">{new Date(s.started_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-text-muted">{duration}</td>
                  <td className="px-3 py-2">{riskScore}</td>
                  <td className="px-3 py-2">
                    {verdictBadge !== "---" ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        verdictBadge.includes("✅") ? "bg-safe/20 text-safe" :
                        verdictBadge.includes("⚠️") ? "bg-warning/20 text-warning" :
                        "bg-danger/20 text-danger"
                      }`}>
                        {verdictBadge}
                      </span>
                    ) : "---"}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/sessions/${s.id}`} className="rounded border border-accent-cyan/40 px-2 py-1 text-accent-cyan">
                      Open
                    </Link>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          Page {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-bg-border px-2 py-1">
            Prev
          </button>
          <button onClick={() => setPage((p) => p + 1)} className="rounded border border-bg-border px-2 py-1">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
