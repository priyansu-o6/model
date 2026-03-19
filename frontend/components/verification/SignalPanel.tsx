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
        <div className="text-xs text-text-muted">🫀 rPPG Heart Rate</div>
        <div className="font-mono text-2xl text-accent-cyan">{Math.round(result.rppg_bpm ?? 0)} BPM</div>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rppgHistory}>
              <XAxis dataKey="idx" hide />
              <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip />
              <Line dot={false} dataKey="value" stroke="#00D4FF" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={`text-xs ${(result.rppg_bpm ?? 0) > 0 ? "text-safe" : "text-danger"}`}>
          {(result.rppg_bpm ?? 0) > 0 ? "SIGNAL PRESENT" : "NO SIGNAL"}
        </div>
      </section>

      <section className="rounded-xl border border-bg-border bg-bg-surface/70 p-3">
        <div className="text-xs text-text-muted">👁️ Blink Detection</div>
        <div className="text-lg text-text-primary">{Math.round(result.blink_rate ?? 0)} blinks/min</div>
        <div className="text-xs text-accent-cyan">{result.blink_pattern ?? "NORMAL"}</div>
        <div className="text-xs text-text-muted">Last: {result.last_blink_ts ?? "N/A"}</div>
      </section>

      <section className="rounded-xl border border-bg-border bg-bg-surface/70 p-3">
        <div className="text-xs text-text-muted">🔊 Audio Spoofing</div>
        <div className="text-lg text-text-primary">{spoofProb}%</div>
        <div className="text-xs text-text-muted">Type: {result.audio_attack_type ?? "NONE"}</div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-bg-border">
          <div className="h-full bg-danger transition-all" style={{ width: `${spoofProb}%` }} />
        </div>
      </section>

      <section className="rounded-xl border border-bg-border bg-bg-surface/70 p-3">
        <div className="text-xs text-text-muted">🧬 Temporal Consistency</div>
        <div className="text-lg text-text-primary">{Math.round(result.temporal_score ?? 0)}</div>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={temporalHistory}>
              <XAxis dataKey="idx" hide />
              <YAxis hide />
              <Tooltip />
              <Line dot={false} dataKey="value" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={`text-xs ${(result.temporal_score ?? 0) >= 60 ? "text-safe" : "text-danger"}`}>
          {(result.temporal_score ?? 0) >= 60 ? "CONSISTENT" : "INCONSISTENT"}
        </div>
      </section>

      <section className="rounded-xl border border-bg-border bg-bg-surface/70 p-3">
        <div className="text-xs text-text-muted">🎭 XceptionNet Score</div>
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
