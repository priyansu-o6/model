"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";

const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Operations Dashboard",
};

function resolveTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Operations Dashboard";
  if (pathname.startsWith("/verify/live")) return "Live Verification";
  if (pathname.startsWith("/verify/upload")) return "Upload & Analyze";
  if (pathname.startsWith("/sessions")) return "Sessions";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Pratyaksha";
}

export default function Header() {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b border-bg-border bg-bg-surface/80 px-6">
      <div>
        <h1 className="font-display text-lg text-text-primary">{title}</h1>
        <p className="text-xs text-text-muted">Forensic intelligence &amp; biometric verification</p>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs text-safe">
          <span className="h-2 w-2 rounded-full bg-safe shadow-[0_0_10px_rgba(16,185,129,1)]" />
          <span className="tracking-[0.2em]">SYSTEM ONLINE</span>
        </div>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-bg-border bg-bg-base text-text-muted hover:text-text-primary">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-danger text-[9px]">
            3
          </span>
        </button>
      </div>
    </header>
  );
}

