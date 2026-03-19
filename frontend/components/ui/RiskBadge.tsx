import React from "react";

export type RiskLevel = "low" | "medium" | "high" | "critical";

interface RiskBadgeProps {
  level: RiskLevel;
}

const COLOR_MAP: Record<RiskLevel, string> = {
  low: "bg-safe/20 text-safe border-safe/50",
  medium: "bg-warning/20 text-warning border-warning/60",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/60",
  critical: "bg-danger/20 text-danger border-danger/60",
};

export default function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${COLOR_MAP[level]}`}
    >
      {level}
    </span>
  );
}

