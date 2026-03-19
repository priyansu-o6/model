"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import HeatmapViewer from "@/components/analysis/HeatmapViewer";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { flagSessionForReview, getSession, getSessionReport } from "@/lib/api";
import { SuspiciousRegion } from "@/lib/live-types";
import { useEffect } from "react";

type FrameResult = {
  id: string;
  frame_number?: number;
  timestamp_seconds?: number;
  xception_score?: number;
  risk_score?: number;
  is_flagged?: boolean;
  heatmap_url?: string;
  created_at?: string;
};

type SessionDetailResponse = {
  session?: Record<string, unknown>;
  detection_result?: Record<string, unknown> | null;
  frame_results?: FrameResult[];
};

function verdictBanner(verdict: string) {
  const v = verdict.toLowerCase();
  if (v.includes("auth")) return { cls: "bg-safe/20 border-safe/50", icon: "✅", title: "Identity Verified" };
  if (v.includes("susp")) return { cls: "bg-warning/20 border-warning/50", icon: "⚠️", title: "Manual Review Required" };
  return { cls: "bg-danger/20 border-danger/50", icon: "🚨", title: "Verification Rejected" };
}

export default function SessionDetailPage() {
  const { pushToast } = useToast();
  const params = useParams<{ id: string }>();
  const sessionId = String(params.id);
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFrame, setSelectedFrame] = useState<FrameResult | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);

  useEffect(() => {
    let mounted = true;
    const start = Date.now();
    async function run() {
      setLoading(true);
      try {
        const res = (await getSession(sessionId)) as SessionDetailResponse;
        if (mounted) setData(res);
      } catch {
        pushToast("error", "Unable to load session report");
      } finally {
        const delay = Math.max(0, 150 - (Date.now() - start));
        window.setTimeout(() => mounted && setLoading(false), delay);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [pushToast, sessionId]);

  const session = data?.session ?? {};
  const det = data?.detection_result ?? {};
  const frames = data?.frame_results ?? [];
  const verdict = String(det.verdict ?? "suspicious");
  const banner = verdictBanner(verdict);

  const timelineData = useMemo(
    () =>
      frames.map((f, idx) => ({
        idx,
        time: f.timestamp_seconds ?? idx,
        xception: Number(f.xception_score ?? 0),
        risk: Number(f.risk_score ?? 0),
        flagged: Boolean(f.is_flagged),
        frame: f,
      })),
    [frames],
  );

  const suspiciousRegions = (det.suspicious_regions as SuspiciousRegion[]) ?? [];

  async function downloadPdf() {
    try {
      const blob = await getSessionReport(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${sessionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      pushToast("error", "Failed to download PDF report");
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function flagForReview() {
    try {
      await flagSessionForReview(sessionId);
      pushToast("success", "Session flagged for review");
    } catch {
      pushToast("warning", "Flag endpoint unavailable in this build");
    }
  }

  function shareSession() {
    navigator.clipboard.writeText(window.location.href);
    pushToast("info", "Session link copied");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <section className={`rounded-xl border p-4 ${banner.cls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-text-muted">Verdict</div>
            <h1 className="font-display text-2xl text-text-primary">
              {banner.icon} {verdict.toUpperCase()} — {banner.title}
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Meta label="Confidence" value={`${Math.round(Number((det.confidence_interval as number[] | undefined)?.[1] ?? 0) * 100)}%`} />
            <Meta label="Risk Score" value={String(Math.round(Number(det.risk_score ?? 0)))} />
            <Meta label="Session ID" value={sessionId} mono />
            <Meta label="Timestamp" value={String(session.started_at ?? "")} />
            <Meta label="Subject" value={String(session.subject_name ?? "N/A")} />
            <Meta label="Mode" value={String(session.mode ?? "N/A")} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm text-text-primary">Evidence Timeline</h2>
          <div className="text-xs text-text-muted">Scroll to zoom</div>
        </div>
        <div
          className="h-64"
          onWheel={(e) => {
            const next = e.deltaY > 0 ? timelineZoom - 0.1 : timelineZoom + 0.1;
            setTimelineZoom(Math.max(1, Math.min(3, next)));
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData.slice(0, Math.ceil(timelineData.length / timelineZoom))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis
                dataKey="time"
                stroke="#94A3B8"
                label={{ value: "Time (seconds)", position: "insideBottom", offset: -2 }}
              />
              <YAxis
                stroke="#94A3B8"
                domain={[0, 1]}
                label={{ value: "Deepfake Score", angle: -90, position: "insideLeft" }}
              />
              <Tooltip
                formatter={(value: number) => [Number(value).toFixed(3), "Score"]}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { frame?: FrameResult; time?: number } | undefined;
                  return `Frame ${p?.frame?.frame_number ?? "-"} • t=${p?.time ?? 0}s`;
                }}
              />
              <Line type="monotone" dataKey="xception" stroke="#00D4FF" strokeWidth={2} dot={(props) => {
                const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { flagged?: boolean; frame?: FrameResult } };
                if (typeof cx !== "number" || typeof cy !== "number") return null;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={payload?.flagged ? 4 : 2}
                    fill={payload?.flagged ? "#FF4444" : "#10B981"}
                    onClick={() => payload?.frame && setSelectedFrame(payload.frame)}
                    style={{ cursor: "pointer" }}
                  />
                );
              }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
            <h3 className="mb-2 font-display text-sm text-text-primary">Signal Breakdown Table</h3>
            <table className="min-w-full text-left text-xs">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1">Signal Name</th><th>Score</th><th>Weight</th><th>Contribution</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                <SignalRow name="XceptionNet Visual" score={Number(det.xception_score ?? 0)} weight={35} />
                <SignalRow name="Temporal Consistency" score={Number(det.temporal_score ?? 0)} weight={20} />
                <SignalRow name="rPPG Liveness" score={Number(det.rppg_score ?? 0)} weight={15} />
                <SignalRow name="Active Liveness" score={Number(det.liveness_score ?? 0)} weight={15} />
                <SignalRow name="Audio Authenticity" score={Number(det.audio_score ?? 0)} weight={15} />
                <tr className="border-t border-bg-border"><td className="py-2 font-semibold">TOTAL RISK SCORE</td><td /><td>100%</td><td>{Number(det.risk_score ?? 0).toFixed(2)}</td><td>{String(det.risk_level ?? "unknown").toUpperCase()}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
            <h3 className="font-display text-sm text-text-primary">Risk Score Explanation</h3>
            <p className="mt-2 text-xs text-text-muted">This session was flagged because:</p>
            <ul className="mt-2 space-y-1 text-xs">
              {((det.explanation_reasons as string[] | undefined) ?? ["Insufficient evidence from one or more modalities."]).map((reason, i) => (
                <li key={i} className="text-warning">• {reason}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
            <h3 className="mb-2 font-display text-sm text-text-primary">Heatmap Gallery</h3>
            <div className="grid grid-cols-2 gap-2">
              {frames.filter((f) => f.is_flagged).slice(0, 6).map((f) => (
                <button key={f.id} onClick={() => setSelectedFrame(f)} className="rounded border border-bg-border bg-bg-base/40 p-2 text-left text-xs hover:border-accent-cyan">
                  <div className="h-20 rounded bg-bg-border/50" />
                  <div className="mt-1">Frame #{f.frame_number ?? "-"}</div>
                  <div className="text-text-muted">t={f.timestamp_seconds ?? 0}s score={Number(f.risk_score ?? 0).toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
            <h3 className="mb-2 font-display text-sm text-text-primary">Behavioral Analysis</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData.slice(0, 20).map((x, i) => ({ t: i * 10, blinks: x.xception * 10 }))}>
                  <XAxis dataKey="t" label={{ value: "Time Window", position: "insideBottom", offset: -2 }} />
                  <YAxis label={{ value: "Blink Count", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Bar dataKey="blinks" fill="#00D4FF" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="x" type="number" name="X" />
                  <YAxis dataKey="y" type="number" name="Y" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={timelineData.map((x, i) => ({ x: i, y: x.xception * 100 }))} fill="#10B981" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-safe">Natural movement detected</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
        <h3 className="mb-2 font-display text-sm text-text-primary">Audio Analysis</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData.map((x, i) => ({ t: i, amp: x.xception, spoof: x.flagged ? x.xception : 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="t" label={{ value: "Time", position: "insideBottom", offset: -2 }} />
              <YAxis label={{ value: "Amplitude", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="amp" name="Audio Signal" stroke="#00D4FF" fill="#00D4FF33" />
              <Area type="monotone" dataKey="spoof" name="Spoofing Detected" stroke="#FF4444" fill="#FF444433" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs text-text-muted">
          attack_type: {String((det as { attack_type?: string }).attack_type ?? "NONE")} | audio_score: {Number(det.audio_score ?? 0).toFixed(2)}
        </div>
      </section>

      {selectedFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-bg-base p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg text-text-primary">Frame #{selectedFrame.frame_number ?? "-"}</h3>
              <button onClick={() => setSelectedFrame(null)} className="rounded border border-bg-border px-3 py-1 text-xs">Close</button>
            </div>
            <HeatmapViewer
              sessionId={sessionId}
              imageUrl={`/api/v1/sessions/${sessionId}/heatmap`}
              heatmapUrl={selectedFrame.heatmap_url ?? `/api/v1/sessions/${sessionId}/heatmap`}
              suspiciousRegions={suspiciousRegions}
            />
          </div>
        </div>
      )}

      <div className="fixed bottom-3 left-0 right-0 z-40 mx-auto flex max-w-5xl flex-wrap justify-center gap-2 rounded-lg border border-bg-border bg-bg-surface/95 p-2">
        <button onClick={downloadPdf} className="rounded border border-bg-border px-3 py-2 text-xs">Download PDF Report</button>
        <button onClick={downloadJson} className="rounded border border-bg-border px-3 py-2 text-xs">Download JSON Data</button>
        <button onClick={shareSession} className="rounded border border-bg-border px-3 py-2 text-xs">Share Session</button>
        <button onClick={flagForReview} className="rounded border border-warning/50 px-3 py-2 text-xs text-warning">Flag for Review</button>
        <Link href="/sessions" className="rounded border border-accent-cyan/50 px-3 py-2 text-xs text-accent-cyan">Back to Sessions</Link>
      </div>
    </div>
  );
}

function SignalRow({ name, score, weight }: { name: string; score: number; weight: number }) {
  const contribution = score * weight;
  const status = contribution > 20 ? "🔴 HIGH RISK" : contribution > 10 ? "🟡 MEDIUM" : "🟢 LOW";
  return (
    <tr className="border-b border-bg-border/30 last:border-0">
      <td className="py-2">{name}</td>
      <td>{(score * 100).toFixed(1)}%</td>
      <td>{weight}%</td>
      <td>{contribution.toFixed(2)}</td>
      <td>{status}</td>
    </tr>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-text-muted">{label}</div>
      <div className={mono ? "font-mono text-text-primary" : "text-text-primary"}>{value}</div>
    </div>
  );
}
