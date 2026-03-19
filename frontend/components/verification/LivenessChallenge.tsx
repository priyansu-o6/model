"use client";

import { useMemo } from "react";

import { LivenessChallengeItem } from "@/lib/live-types";

type LivenessChallengeProps = {
  challenge: LivenessChallengeItem | null | undefined;
  completed: LivenessChallengeItem[] | undefined;
};

const challengeCopy: Record<string, { icon: string; label: string }> = {
  blink_twice: { icon: "👁️", label: "Please blink twice" },
  turn_left: { icon: "←", label: "Turn your head left" },
  turn_right: { icon: "→", label: "Turn your head right" },
  smile: { icon: "😊", label: "Please smile" },
  nod: { icon: "↕️", label: "Nod your head" },
};

export default function LivenessChallenge({ challenge, completed }: LivenessChallengeProps) {
  const secondsLeft = useMemo(() => {
    if (!challenge || challenge.state !== "ACTIVE") return 10;
    const elapsed = challenge.started_at ? (Date.now() - challenge.started_at) / 1000 : 0;
    const ttl = challenge.expires_in_seconds ?? 10;
    return Math.max(0, Math.ceil(ttl - elapsed));
  }, [challenge]);

  const text = challenge ? challengeCopy[challenge.type] : null;
  const stateColor =
    challenge?.state === "PASSED"
      ? "text-safe"
      : challenge?.state === "FAILED"
        ? "text-danger"
        : challenge?.state === "ACTIVE"
          ? "text-accent-cyan"
          : "text-text-muted";

  return (
    <section className="rounded-xl border border-bg-border bg-bg-surface/70 p-4">
      <div className="mb-2 text-xs text-text-muted">Liveness Challenge</div>
      {challenge ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={`text-sm font-semibold ${stateColor}`}>{challenge.state}</div>
            <div className="mt-1 text-sm text-text-primary">
              {text?.icon} {text?.label}
            </div>
          </div>
          <div className="relative h-12 w-12">
            <svg className="h-12 w-12 -rotate-90">
              <circle cx="24" cy="24" r="18" stroke="rgba(107,114,128,0.25)" strokeWidth="4" fill="none" />
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke={challenge.state === "FAILED" ? "#FF4444" : "#00D4FF"}
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${(2 * Math.PI * 18 * (10 - secondsLeft)) / 10}`}
                style={{ transition: "stroke-dashoffset 300ms linear" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-text-primary">
              {secondsLeft}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-text-muted">WAITING</div>
      )}

      <div className="mt-3 border-t border-bg-border pt-3">
        <div className="mb-2 text-xs text-text-muted">Completed</div>
        <div className="space-y-1">
          {(completed ?? []).length === 0 && <div className="text-xs text-text-muted">No completed challenges yet.</div>}
          {(completed ?? []).map((item, i) => (
            <div key={item.id ?? `${item.type}-${i}`} className="flex items-center gap-2 text-xs text-text-primary">
              <span>{item.state === "PASSED" ? "✅" : item.state === "FAILED" ? "❌" : "⏳"}</span>
              <span>{challengeCopy[item.type]?.label ?? item.type}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
