"use client";

export default function StatusBar() {
  return (
    <div className="flex h-8 items-center justify-between border-t border-bg-border bg-bg-surface/90 px-4 text-[11px] text-text-muted">
      <div className="flex items-center gap-4">
        <StatusDot color="bg-safe" label="Models" value="Mock (dev)" />
        <StatusDot color="bg-safe" label="PostgreSQL" value="Connected" />
        <StatusDot color="bg-safe" label="Redis" value="Connected" />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs font-mono text-text-muted">ACTIVE SESSIONS: 0</span>
      </div>
    </div>
  );
}

interface StatusDotProps {
  color: string;
  label: string;
  value: string;
}

function StatusDot({ color, label, value }: StatusDotProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color} shadow-[0_0_8px_rgba(0,0,0,0.6)]`} />
      <span>{label}:</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}

