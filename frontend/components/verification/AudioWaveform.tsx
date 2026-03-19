"use client";

import { useEffect, useRef } from "react";

type AudioWaveformProps = {
  stream: MediaStream | null;
  spoofingProbability?: number;
};

export default function AudioWaveform({ stream, spoofingProbability = 0 }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const barWidth = width / dataArray.length;
      const baseColor = spoofingProbability > 0.6 ? "#FF4444" : "#00D4FF";
      for (let i = 0; i < dataArray.length; i += 1) {
        const v = dataArray[i] / 255;
        const barHeight = v * height;
        ctx.fillStyle = baseColor;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }
      if (spoofingProbability > 0) {
        ctx.fillStyle = `rgba(255, 68, 68, ${Math.min(0.6, spoofingProbability)})`;
        ctx.fillRect(0, 0, width, height);
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close().catch(() => undefined);
    };
  }, [stream, spoofingProbability]);

  return (
    <section className="rounded-xl border border-bg-border bg-bg-surface/70 p-3">
      <div className="mb-2 text-xs text-text-muted">Audio Waveform (FFT)</div>
      <canvas ref={canvasRef} width={420} height={90} className="h-24 w-full rounded bg-bg-base/70" />
      <div className={`mt-2 text-xs ${spoofingProbability > 0.6 ? "text-danger" : "text-safe"}`}>
        {spoofingProbability > 0.6 ? "SYNTHETIC VOICE DETECTED" : "AUTHENTIC VOICE"}
      </div>
    </section>
  );
}
