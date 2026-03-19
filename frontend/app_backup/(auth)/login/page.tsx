"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { login, getMe } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens = await login(email, password);
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
      }
      const me = await getMe();
      setUser(me);
      router.replace("/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-base">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.12),transparent_55%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9),rgba(15,23,42,1))]" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-bg-border bg-bg-surface/80 p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-cyan/20">
            <div className="h-5 w-5 rounded-full border border-accent-cyan/70 bg-accent-cyan/30 shadow-[0_0_18px_rgba(0,212,255,0.8)]" />
          </div>
          <div>
            <div className="font-display text-lg text-text-primary">Pratyaksha</div>
            <div className="text-xs text-text-muted">Direct Evidence</div>
          </div>
        </div>
        <h2 className="mb-2 font-display text-xl text-text-primary">Sign in</h2>
        <p className="mb-6 text-xs text-text-muted">
          Access the forensic intelligence console to monitor and review verification sessions.
        </p>
        {error && (
          <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-xs">
            <label className="block text-text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-bg-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none ring-accent-cyan/40 focus:ring-1"
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="block text-text-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-bg-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none ring-accent-cyan/40 focus:ring-1"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-md bg-accent-cyan px-4 py-2 text-sm font-medium text-bg-base transition hover:bg-accent-cyan/80 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

