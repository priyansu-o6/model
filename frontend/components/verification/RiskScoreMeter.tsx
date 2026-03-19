"use client";

import { useMemo } from "react";

type RiskScoreMeterProps = {
  score: number;
  confidence?: number;
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function scoreColor(score: number): string {
  if (score <= 30) return "#10B981";
  if (score <= 60) return "#F59E0B";
  if (score <= 80) return "#FF6B00";
  return "#FF4444";
}

function riskLabel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score <= 30) return "LOW";
  if (score <= 60) return "MEDIUM";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

export default function RiskScoreMeter({ score, confidence = 0.8 }: RiskScoreMeterProps) {
  const safeScore = clamp(score);
  const color = scoreColor(safeScore);
  const label = riskLabel(safeScore);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 78;
  const circumference = 2 * Math.PI * r;
  const progress = safeScore / 100;
  const arcLength = circumference * progress;
  const confLength = circumference * clamp(confidence * 100) / 100;

  const gaugeStyle = useMemo(
    () => ({
      strokeDasharray: `${arcLength} ${circumference}`,
      stroke: color,
      transition: "stroke-dasharray 300ms ease, stroke 300ms ease",
    }),
    [arcLength, circumference, color],
  );

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-bg-border bg-bg-surface/70 p-4">
      <div className={`relative ${safeScore > 60 ? "animate-pulse" : ""}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(135 ${cx} ${cy})`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(107,114,128,0.2)" strokeWidth="14" />
            <circle
              cx={cx}
              cy={cy}
              r={r + 10}
              fill="none"
              stroke="rgba(0,212,255,0.2)"
              strokeWidth="4"
              strokeDasharray={`${confLength} ${2 * Math.PI * (r + 10)}`}
              style={{ transition: "stroke-dasharray 300ms ease" }}
            />
            <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="14" strokeLinecap="round" style={gaugeStyle} />
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-4xl leading-none text-text-primary">{Math.round(safeScore)}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-text-muted">/100</div>
        </div>
      </div>
      <div className="font-display text-sm tracking-wide" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
