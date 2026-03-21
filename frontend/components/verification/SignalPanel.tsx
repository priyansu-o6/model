"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { LiveDetectionResult } from "@/lib/live-types";

type SignalPanelProps = {
  result: LiveDetectionResult | null;
  processing?: boolean;
};

function dataToSeries(values: number[] | undefined): Array<{ idx: number; value: number }> {
  return (values ?? []).slice(-30).map((value, idx) => ({ idx, value }));
}

export default function SignalPanel({ result, processing = false }: SignalPanelProps) {
  if (!result) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-bg-border bg-bg-surface/70" />
        ))}
      </div>
    );
  }

  const rppgHistory = dataToSeries(result.rppg_history);
  const temporalHistory = dataToSeries(result.temporal_history);
  const spoofProb = Math.round((result.audio_spoof_probability ?? 0) * 100);
  const xception = Math.round((result.xception_score ?? 0) * 100);

  return (
    <div className="grid gap-3">
      <section className="rounded-xl border border-bg-border bg-bg-surface/70 p-3">
        <div className="text-xs text-text-muted">🎭 MesoNet Deepfake Score</div>
        <div className={`text-2xl ${xception >= 70 ? "text-danger" : "text-accent-cyan"}`}>{xception}%</div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-bg-border">
          <div className="h-full bg-accent-cyan transition-all" style={{ width: `${xception}%` }} />
        </div>
        <div className="mt-1 text-xs text-text-muted">
          {processing ? <span className="animate-pulse">ANALYZING...</span> : "Stable"}
        </div>
      </section>
    </div>
  );
}
