"use client";

import { RefObject, useEffect, useRef } from "react";

import { SuspiciousRegion } from "@/lib/live-types";

type FaceOverlayProps = {
  gradcamData: string | null | undefined;
  suspiciousRegions: SuspiciousRegion[] | undefined;
  canvasRef: RefObject<HTMLCanvasElement>;
  faceDetected?: boolean;
};

function getGradcamSource(data: string): string {
  if (data.startsWith("data:image/")) return data;
  return `data:image/png;base64,${data}`;
}

export default function FaceOverlay({
  gradcamData,
  suspiciousRegions,
  canvasRef,
  faceDetected = true,
}: FaceOverlayProps) {
  const previousOverlayRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!faceDetected) {
      ctx.save();
      ctx.fillStyle = "rgba(245, 158, 11, 0.95)";
      ctx.font = "700 18px var(--font-display), sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NO FACE DETECTED", canvas.width / 2, 36);
      ctx.restore();
      return;
    }

    if (!gradcamData) return;

    const img = new Image();
    img.onload = () => {
      const previous = previousOverlayRef.current;
      const temp = document.createElement("canvas");
      temp.width = canvas.width;
      temp.height = canvas.height;
      const tctx = temp.getContext("2d");
      if (!tctx) return;

      if (previous) {
        tctx.globalAlpha = 0.5;
        tctx.drawImage(previous, 0, 0, temp.width, temp.height);
      }
      tctx.globalAlpha = 0.4;
      tctx.drawImage(img, 0, 0, temp.width, temp.height);

      ctx.save();
      ctx.drawImage(temp, 0, 0);
      ctx.restore();

      previousOverlayRef.current = temp;

      if ((suspiciousRegions ?? []).length > 0) {
        ctx.save();
        ctx.font = "600 11px var(--font-inter), sans-serif";
        for (const region of suspiciousRegions ?? []) {
          const box = region.bbox;
          if (!box) continue;
          const x = box.x;
          const y = Math.max(14, box.y - 6);
          ctx.fillStyle = "rgba(17, 24, 39, 0.85)";
          const label = `${region.region_name} ${Math.round(region.confidence)}%`;
          const width = ctx.measureText(label).width + 8;
          ctx.fillRect(x, y - 12, width, 14);
          ctx.fillStyle = "rgba(0, 212, 255, 0.95)";
          ctx.fillText(label, x + 4, y - 2);
        }
        ctx.restore();
      }
    };
    img.src = getGradcamSource(gradcamData);
  }, [gradcamData, suspiciousRegions, canvasRef, faceDetected]);

  return null;
}
