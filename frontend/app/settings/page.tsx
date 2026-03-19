"use client";

import { useState } from "react";

import { useToast } from "@/components/ui/ToastProvider";

type Tab = "profile" | "organization" | "integrations" | "security";

export default function SettingsPage() {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("profile");
  const [webhook, setWebhook] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl text-text-primary">Settings</h1>
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === "profile"} onClick={() => setTab("profile")}>Profile</TabBtn>
        <TabBtn active={tab === "organization"} onClick={() => setTab("organization")}>Organization</TabBtn>
        <TabBtn active={tab === "integrations"} onClick={() => setTab("integrations")}>Integrations</TabBtn>
        <TabBtn active={tab === "security"} onClick={() => setTab("security")}>Security</TabBtn>
      </div>

      {tab === "profile" && (
        <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h2 className="font-display text-sm">Profile</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input label="Name" placeholder="Your name" />
            <Input label="Email" placeholder="you@example.com" />
            <Input label="Avatar URL" placeholder="https://..." />
          </div>
          <button className="mt-4 rounded bg-accent-cyan px-4 py-2 text-sm font-semibold text-bg-base">Save Profile</button>
        </section>
      )}

      {tab === "organization" && (
        <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h2 className="font-display text-sm">Organization</h2>
          <div className="mt-3 text-sm text-text-muted">Manage organization profile, members, and compliance metadata.</div>
        </section>
      )}

      {tab === "integrations" && (
        <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h2 className="font-display text-sm">Integrations</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-text-muted">n8n Webhook URL</label>
              <input value={webhook} onChange={(e) => setWebhook(e.target.value)} className="mt-1 w-full rounded border border-bg-border bg-bg-base px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => pushToast("success", "Webhook test sent")}
                className="rounded border border-accent-cyan/50 px-3 py-2 text-xs text-accent-cyan"
              >
                Test Webhook
              </button>
              <button onClick={() => pushToast("info", "New API key generated")} className="rounded border border-bg-border px-3 py-2 text-xs">
                Generate API Key
              </button>
              <button onClick={() => pushToast("warning", "API key revoked")} className="rounded border border-warning/50 px-3 py-2 text-xs text-warning">
                Revoke API Key
              </button>
            </div>
            <div className="rounded border border-bg-border bg-bg-base/40 p-3 text-xs text-text-muted">
              Integration guides: Fintech KYC, Remote Hiring, Banking V-CIP.
            </div>
          </div>
        </section>
      )}

      {tab === "security" && (
        <section className="rounded-xl border border-bg-border bg-bg-surface/60 p-4">
          <h2 className="font-display text-sm">Security</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Input label="Current Password" placeholder="••••••••" type="password" />
              <Input label="New Password" placeholder="••••••••" type="password" />
              <button className="rounded bg-accent-cyan px-3 py-2 text-xs font-semibold text-bg-base">Change Password</button>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs text-text-muted">Active Sessions</h3>
              <div className="rounded border border-bg-border p-2 text-xs">Chrome on Windows • Active now</div>
              <button className="rounded border border-danger/50 px-3 py-1 text-xs text-danger">Revoke all sessions</button>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="mb-2 text-xs text-text-muted">Audit Logs (last 50 events)</h3>
            <div className="rounded border border-bg-border bg-bg-base/40 p-3 text-xs text-text-muted">
              Audit log viewer is connected to backend events in next iteration.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`rounded border px-3 py-1.5 text-xs ${active ? "border-accent-cyan text-accent-cyan" : "border-bg-border text-text-muted"}`}>
      {children}
    </button>
  );
}

function Input({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="text-xs text-text-muted">{label}</label>
      <input type={type} placeholder={placeholder} className="mt-1 w-full rounded border border-bg-border bg-bg-base px-3 py-2 text-sm" />
    </div>
  );
}
