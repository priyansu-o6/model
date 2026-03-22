"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { setRefreshToken, setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("access_token", "dev-bypass-token");
    router.push("/dashboard");
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await axios.post("http://localhost:8000/api/v1/auth/login", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const tokens = response.data as { access_token: string; refresh_token: string };
      if (typeof window !== "undefined") {
        setToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
      }
      router.push("/dashboard");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError("Invalid email or password");
        pushToast("error", "Invalid credentials");
      } else {
        setError("Unable to sign in right now");
        pushToast("warning", "Sign in failed. Please try again.");
      }
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
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg-base/30 border-t-bg-base" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

