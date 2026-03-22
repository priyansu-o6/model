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
  
  const isRppgReady = result?.rppg_ready === true;

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

      {/* rPPG Heart Rate */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#6B7280]">🫀 rPPG Heart Rate</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isRppgReady 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-gray-500/20 text-gray-400'
          }`}>
            {isRppgReady ? 'SIGNAL PRESENT' : 'CALIBRATING...'}
          </span>
        </div>
        <div className="text-3xl font-mono text-[#00D4FF]">
          {isRppgReady && Number(result?.rppg_bpm) > 0 ? `${Math.round(Number(result.rppg_bpm))}` : '--'} 
          <span className="text-sm text-[#6B7280] ml-1">BPM</span>
        </div>
        <div className="text-xs text-[#6B7280] mt-1">
          {isRppgReady 
            ? (Number(result?.rppg_bpm) >= 50 && Number(result?.rppg_bpm) <= 120 
                ? '✅ Normal range' 
                : '⚠️ Abnormal range')
            : 'Collecting 10 seconds of data...'}
        </div>
      </div>
    </div>
  );
}
