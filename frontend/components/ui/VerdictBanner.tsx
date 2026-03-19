import React from "react";

import RiskBadge, { RiskLevel } from "./RiskBadge";

interface VerdictBannerProps {
  verdict: "authentic" | "suspicious" | "deepfake";
  confidence: number;
  riskScore: number;
}

export default function VerdictBanner({ verdict, confidence, riskScore }: VerdictBannerProps) {
  const level: RiskLevel =
    riskScore < 30 ? "low" : riskScore < 60 ? "medium" : riskScore < 80 ? "high" : "critical";

  const bg =
    verdict === "authentic"
      ? "bg-safe/15 border-safe/40"
      : verdict === "suspicious"
        ? "bg-warning/15 border-warning/40"
        : "bg-danger/15 border-danger/40";

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${bg}`}>
      <div>
        <div className="text-xs text-text-muted">Verdict</div>
        <div className="font-display text-lg capitalize text-text-primary">{verdict}</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-text-muted">Risk Score</div>
          <div className="font-mono text-lg text-accent-cyan">{riskScore.toFixed(1)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted">Confidence</div>
          <div className="font-mono text-lg text-text-primary">{Math.round(confidence * 100)}%</div>
        </div>
        <RiskBadge level={level} />
      </div>
    </div>
  );
}

