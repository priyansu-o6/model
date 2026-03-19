"use client";

import { useMemo, useState } from "react";

import { SuspiciousRegion } from "@/lib/live-types";

type HeatmapViewerProps = {
  sessionId: string;
  imageUrl: string;
  heatmapUrl?: string | null;
  suspiciousRegions: SuspiciousRegion[];
};

function regionColor(confidence: number): string {
  if (confidence > 70) return "#FF4444";
  if (confidence >= 40) return "#FF6B00";
  return "#F59E0B";
}

export default function HeatmapViewer({ sessionId, imageUrl, heatmapUrl, suspiciousRegions }: HeatmapViewerProps) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [opacity, setOpacity] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<SuspiciousRegion | null>(null);

  const hasRegions = (suspiciousRegions ?? []).length > 0;

  const manipulationIcon = useMemo(
    () => ({
      texture: "🧩",
      geometry: "📐",
      lighting: "💡",
      deepfake: "🎭",
      default: "⚠️",
    }),
    [],
  );

  function exportAsPng() {
    const base = new Image();
    base.crossOrigin = "anonymous";
    base.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = base.naturalWidth || 1280;
      canvas.height = base.naturalHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
      const finalize = () => {
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `pratyaksha-heatmap-${sessionId}.png`;
        a.click();
      };
      if (showOverlay && heatmapUrl) {
        const heat = new Image();
        heat.crossOrigin = "anonymous";
        heat.onload = () => {
          ctx.globalAlpha = opacity / 100;
          ctx.drawImage(heat, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
          finalize();
        };
        heat.onerror = finalize;
        heat.src = heatmapUrl;
        return;
      }
      finalize();
    };
    base.src = imageUrl;
  }

  return (
    <div className="grid gap-4 rounded-xl border border-bg-border bg-bg-surface/70 p-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border border-bg-border px-3 py-1 text-xs text-text-primary"
            onClick={() => setShowOverlay((s) => !s)}
          >
            {showOverlay ? "Hide Overlay" : "Show Overlay"}
          </button>
          <button className="rounded border border-bg-border px-3 py-1 text-xs text-text-primary" onClick={exportAsPng}>
            Export as PNG
          </button>
          <button className="rounded border border-bg-border px-2 py-1 text-xs text-text-primary" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
            Zoom -
          </button>
          <button className="rounded border border-bg-border px-2 py-1 text-xs text-text-primary" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}>
            Zoom +
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="overlay-opacity" className="text-xs text-text-muted">
            Overlay Opacity
          </label>
          <input
            id="overlay-opacity"
            type="range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-48"
          />
          <span className="text-xs font-mono text-text-primary">{opacity}%</span>
        </div>

        <div className="relative overflow-auto rounded bg-black/40">
          <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
            <img src={imageUrl} alt="Original frame" className="block max-w-full" />
            {showOverlay && heatmapUrl && (
              <img src={heatmapUrl} alt="Grad-CAM heatmap" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ opacity: opacity / 100 }} />
            )}
            {(suspiciousRegions ?? []).map((region, idx) => {
              const box = region.bbox;
              if (!box) return null;
              return (
                <div
                  key={region.id ?? `${region.region_name}-${idx}`}
                  className="absolute cursor-pointer"
                  style={{
                    left: box.x,
                    top: box.y,
                    width: box.width,
                    height: box.height,
                    border: `2px solid ${regionColor(region.confidence)}`,
                  }}
                  onMouseEnter={() => setHovered(region)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
            {hovered && (
              <div className="absolute left-3 top-3 max-w-xs rounded border border-bg-border bg-bg-surface/95 p-2 text-xs text-text-primary">
                <div className="font-semibold">{hovered.region_name}</div>
                <div>{Math.round(hovered.confidence)}%</div>
                <div className="text-text-muted">{hovered.description ?? "Potential manipulation artifact detected."}</div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div
            className="h-3 w-full rounded"
            style={{ background: "linear-gradient(90deg, #2563EB 0%, #10B981 35%, #F59E0B 68%, #FF4444 100%)" }}
          />
          <div className="mt-1 flex justify-between text-xs text-text-muted">
            <span>Safe</span>
            <span>Manipulated</span>
          </div>
        </div>
      </div>

      <aside className="rounded-lg border border-bg-border bg-bg-base/40 p-3">
        <h3 className="mb-3 font-display text-sm text-text-primary">Suspicious Regions Detected</h3>
        {!hasRegions && <div className="text-xs text-text-muted">No suspicious regions.</div>}
        <div className="space-y-3">
          {(suspiciousRegions ?? []).map((region, idx) => {
            const icon =
              manipulationIcon[(region.manipulation_type ?? "").toLowerCase() as keyof typeof manipulationIcon] ??
              manipulationIcon.default;
            return (
              <div key={region.id ?? `${region.region_name}-${idx}`} className="rounded border border-bg-border p-2">
                <div className="flex items-center justify-between text-sm text-text-primary">
                  <span>{region.region_name}</span>
                  <span>{icon}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-bg-border">
                  <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, region.confidence))}%`, backgroundColor: regionColor(region.confidence) }} />
                </div>
                <div className="mt-1 text-xs text-text-muted">{region.description ?? "Anomaly pattern detected."}</div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
