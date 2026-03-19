"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-20 max-w-xl rounded-xl border border-danger/40 bg-danger/10 p-6">
      <h2 className="font-display text-xl text-danger">Something went wrong</h2>
      <p className="mt-2 text-sm text-text-muted">{error.message || "An unexpected error occurred."}</p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded bg-danger px-4 py-2 text-sm font-semibold text-white"
      >
        Retry
      </button>
    </div>
  );
}
