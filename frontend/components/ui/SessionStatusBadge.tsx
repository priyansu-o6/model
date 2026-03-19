import React from "react";

export type SessionStatus = "pending" | "processing" | "complete" | "failed";

interface SessionStatusBadgeProps {
  status: SessionStatus;
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  pending: "bg-bg-border text-text-muted",
  processing: "bg-warning/20 text-warning",
  complete: "bg-safe/20 text-safe",
  failed: "bg-danger/20 text-danger",
};

export default function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

