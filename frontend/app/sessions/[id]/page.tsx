"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { flagSessionForReview, getSession, getSessionReport } from "@/lib/api";
import { SuspiciousRegion } from "@/lib/live-types";

type FrameResult = {
  id: string;
  frame_number?: number;
  timestamp_ms?: number;
  timestamp_seconds?: number;
  xception_score?: number;
  risk_score?: number;
  is_flagged?: boolean;
  heatmap_url?: string;
  created_at?: string;
};

type SessionResult = {
  face_detected?: boolean;
  verdict?: string;
  risk_score?: number;
  risk_level?: string;
  xception_score?: number;
  temporal_score?: number;
  rppg_score?: number;
  liveness_score?: number;
  audio_score?: number;
  explanation_reasons?: string[];
  suspicious_regions?: SuspiciousRegion[];
  confidence_interval?: number[];
  attack_type?: string;
  gradcam_path?: string;
};

type SessionDetailResponse = {
  id?: string;
  user_id?: string;
  mode?: string;
  status?: string;
  subject_name?: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  result?: SessionResult;
  frame_results?: FrameResult[];
};

function verdictBanner(verdict: string) {
  const v = verdict.toLowerCase();
  if (v.includes("auth")) return { cls: "bg-safe/20 border-safe/50", icon: "✅", title: "Identity Verified" };
  if (v.includes("susp")) return { cls: "bg-warning/20 border-warning/50", icon: "⚠️", title: "Manual Review Required" };
  return { cls: "bg-danger/20 border-danger/50", icon: "🚨", title: "Verification Rejected" };
}

function verdictExplanation(verdict: string, isAIMode: boolean) {
  const v = verdict.toLowerCase();
  if (v.includes("auth")) {
    return isAIMode 
      ? "AI Image Detector analysis found no signs of synthetic generation. This appears to be a genuine image."
      : "MesoNet analysis found no signs of manipulation. This appears to be a genuine person.";
  }
  if (v.includes("susp")) {
    return isAIMode
      ? "AI Image Detector raised concerns. We recommend a human reviewer verify this session manually."
      : "MesoNet raised concerns. We recommend a human reviewer verify this session manually.";
  }
  return isAIMode
    ? "AI Image Detector analysis found signs of synthetic generation."
    : "MesoNet analysis detected signs of digital manipulation.";
}

function normalizeToPercent(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const numeric = Number(value);
  return numeric <= 1 ? numeric * 100 : numeric;
}

function scoreColorClass(percent: number | null) {
  if (percent == null) return "text-text-muted";
  if (percent < 40) return "text-safe";
  if (percent <= 70) return "text-warning";
  return "text-danger";
}

function humanizeReason(reason: string, isAIMode: boolean) {
  return reason
    .replaceAll("xception_score", isAIMode ? "AI Generated detector" : "MesoNet Deepfake detector");
}

export default function SessionDetailPage() {
  const { pushToast } = useToast();
  const params = useParams<{ id: string }>();
  const sessionId = String(params.id);
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const start = Date.now();
    async function run() {
      setLoading(true);
      try {
        const res = (await getSession(sessionId)) as SessionDetailResponse;
        console.log("Session data:", JSON.stringify(res, null, 2));
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

  const session = data ?? {};
  const result = session.result ?? {};
  const verdict = String(result.verdict ?? "suspicious");
  const banner = verdictBanner(verdict);
  const isAIMode = (result.explanation_reasons || []).some(
    (r: string) => {
      const lower = r?.toLowerCase() || "";
      return lower.includes('aigenerated') || lower.includes('ai generated') || lower.includes('ai image') || lower.includes('detection_mode:aigenerated');
    }
  ) || (Number(result.xception_score) > 0.9 && result.face_detected === false);
  const verdictDetails = verdictExplanation(verdict, isAIMode);
  const confidenceInterval = result.confidence_interval ?? [];
  const confidenceWidth =
    confidenceInterval.length > 1
      ? (() => {
          const low = Number(confidenceInterval[0]);
          const high = Number(confidenceInterval[1]);
          if (Number.isNaN(low) || Number.isNaN(high)) return null;
          const delta = Math.abs(high - low);
          return delta <= 1 ? delta * 100 : delta;
        })()
      : null;
  const confidenceLevel =
    confidenceWidth == null ? "N/A" : confidenceWidth <= 10 ? "High" : confidenceWidth <= 25 ? "Medium" : "Low";
  const confidenceLow = confidenceInterval.length > 1 ? normalizeToPercent(confidenceInterval[0]) : null;
  const confidenceHigh = confidenceInterval.length > 1 ? normalizeToPercent(confidenceInterval[1]) : null;
  const riskScorePercent = normalizeToPercent(result.risk_score);
  const riskBarWidth = riskScorePercent == null ? 0 : Math.max(0, Math.min(100, riskScorePercent));
  const startedAtText = session.started_at ? new Date(session.started_at).toLocaleString("en-IN") : "";

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
      <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
        <h2 className="font-display text-sm text-text-primary">Risk Legend</h2>
        <p className="mt-2 text-xs text-text-muted">🟢 LOW (0-30): Likely authentic</p>
        <p className="text-xs text-text-muted">🟡 MEDIUM (30-60): Needs review</p>
        <p className="text-xs text-text-muted">🔴 HIGH (60-80): Likely fake</p>
        <p className="text-xs text-text-muted">🔴 CRITICAL (80-100): Confirmed fake</p>
      </section>

      <section className={`rounded-xl border p-4 ${banner.cls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-text-muted">Verdict</div>
            <h1 className="font-display text-2xl text-text-primary">
              {banner.icon} {verdict.toUpperCase()} — {banner.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-text-primary/90">{verdictDetails}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Meta
              label="Confidence"
              value={
                confidenceWidth == null
                  ? "N/A"
                  : `${confidenceLevel} (${Math.round(confidenceWidth)}% interval width)`
              }
            />
            <div>
              <div className="text-text-muted">Risk Score</div>
              <div className="text-text-primary">{riskScorePercent == null ? "N/A" : `${Math.round(riskScorePercent)}`}</div>
              <div className="mt-1 text-text-muted">Risk Score (0 = Safe, 100 = Definite Fake)</div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-bg-border/70">
                <div
                  className={`h-full ${
                    riskBarWidth < 40 ? "bg-safe" : riskBarWidth <= 70 ? "bg-warning" : "bg-danger"
                  }`}
                  style={{ width: `${riskBarWidth}%` }}
                />
              </div>
            </div>
            <Meta label="Session ID" value={sessionId} mono />
            <Meta label="Timestamp" value={startedAtText} />
            <Meta label="Subject" value={session.subject_name || "Not provided"} />
            <Meta label="Mode" value={session.mode === "live" ? "Live Verification" : session.mode === "upload" ? "File Upload" : String(session.mode ?? "N/A")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          {confidenceLow == null || confidenceHigh == null
            ? "Confidence interval unavailable for this session."
            : `We are 95% confident the true risk score is between ${confidenceLow.toFixed(1)} and ${confidenceHigh.toFixed(1)}.`}
        </p>
      </section>

      <section className="space-y-4">
        <div className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h3 className="mb-2 font-display text-sm text-text-primary">Signal Breakdown Table</h3>
          <table className="min-w-full text-left text-xs">
            <thead className="text-text-muted">
              <tr>
                <th className="py-1">Signal Name</th><th>Score</th><th>Weight</th><th>Contribution</th><th>Status</th><th>What this means</th>
              </tr>
            </thead>
            <tbody>
              <SignalRow 
                name={isAIMode ? "AI Generated Detector (SDXL)" : "MesoNet Face Swap Detector"} 
                score={result.xception_score} 
                weight={100} 
                meaning={isAIMode ? "Detects StyleGAN, SDXL, Gemini synthetic AI-generated faces" : "Neural network detecting face-swap artifacts in images"} 
              />
              <tr className="border-t border-bg-border"><td className="py-2 font-semibold">TOTAL RISK SCORE</td><td className={scoreColorClass(riskScorePercent)}>{riskScorePercent == null ? "N/A" : `${riskScorePercent.toFixed(1)}%`}</td><td>100%</td><td>{result.risk_score == null ? "N/A" : Number(result.risk_score).toFixed(2)}</td><td>{String(result.risk_level ?? "unknown").toUpperCase()}</td><td>Combined weighted risk from MesoNet</td></tr>
            </tbody>
          </table>
        </div>

        {session.result?.gradcam_path && (
          <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-6">
            <h2 className="text-lg font-semibold text-[#F9FAFB] mb-2">
              GradCAM Heatmap
            </h2>
            <p className="text-[#6B7280] text-sm mb-4">
              Highlighted regions show where the AI detected manipulation. 
              Red areas indicate high suspicion, blue areas are clean.
            </p>
            <img
              src={`data:image/jpeg;base64,${session.result.gradcam_path}`}
              alt="GradCAM Heatmap"
              className="rounded-lg max-w-sm w-full"
            />
            {session.result.suspicious_regions && 
             session.result.suspicious_regions.length > 0 && 
             Number(session.result.risk_score) > 30 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-[#F9FAFB] mb-2">
                  Suspicious Regions Detected:
                </h3>
                {session.result.suspicious_regions.map((region: any, i: number) => (
                  <div key={i} className="flex justify-between py-1 border-b border-[#1F2937]">
                    <span className="text-[#F9FAFB] text-sm">{region.region}</span>
                    <span className="text-[#FF4444] text-sm font-mono">
                      {region.confidence}% confidence
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h3 className="font-display text-sm text-text-primary">Why was this flagged?</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {(result.explanation_reasons ?? [])
              .filter((r: string) => !r?.startsWith('detection_mode:'))
              .map((reason: string, i: number) => (
              <li key={i} className="text-warning">⚠️ {humanizeReason(reason, isAIMode)}</li>
            ))}
          </ul>
        </div>
      </section>

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

function SignalRow({ name, score, weight, meaning }: { name: string; score?: number; weight: number; meaning: string }) {
  const percent = normalizeToPercent(score);
  const normalized = percent == null ? null : percent / 100;
  const contribution = normalized == null ? null : normalized * weight;
  const status = contribution == null ? "N/A" : contribution > 20 ? "🔴 HIGH RISK" : contribution > 10 ? "🟡 MEDIUM" : "🟢 LOW";
  return (
    <tr className="border-b border-bg-border/30 last:border-0">
      <td className="py-2">{name}</td>
      <td className={scoreColorClass(percent)}>{percent == null ? "N/A" : `${percent.toFixed(1)}%`}</td>
      <td>{weight}%</td>
      <td>{contribution == null ? "N/A" : contribution.toFixed(2)}</td>
      <td>{status}</td>
      <td className="text-text-muted">{meaning}</td>
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
