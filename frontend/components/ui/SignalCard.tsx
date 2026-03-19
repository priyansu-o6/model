import React from "react";

interface SignalCardProps {
  label: string;
  value: number;
  unit?: string;
}

export default function SignalCard({ label, value, unit }: SignalCardProps) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg-surface/80 p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 font-display text-xl text-accent-cyan">
        {value.toFixed(1)}
        {unit && <span className="ml-1 text-xs text-text-muted">{unit}</span>}
      </div>
    </div>
  );
}

