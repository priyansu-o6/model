"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "warning" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  pushToast: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLE_MAP: Record<ToastType, string> = {
  success: "border-safe/60 bg-safe/20 text-safe",
  warning: "border-warning/60 bg-warning/20 text-warning",
  error: "border-danger/60 bg-danger/20 text-danger",
  info: "border-accent-cyan/60 bg-accent-cyan/20 text-accent-cyan",
};

const ICON_MAP: Record<ToastType, string> = {
  success: "✓",
  warning: "⚠",
  error: "✕",
  info: "i",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`flex min-w-[240px] items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg ${STYLE_MAP[toast.type]}`}>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
              {ICON_MAP[toast.type]}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
