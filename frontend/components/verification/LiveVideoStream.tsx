"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import FaceOverlay from "@/components/verification/FaceOverlay";
import { LiveDetectionResult } from "@/lib/live-types";

type LiveVideoStreamProps = {
  sessionId: string;
  active: boolean;
  onResult: (result: LiveDetectionResult) => void;
  onConnectionChange: (state: "connecting" | "connected" | "reconnecting" | "disconnected") => void;
  onFatalError: (message: string) => void;
  onStreamReady?: (stream: MediaStream | null) => void;
};

export default function LiveVideoStream({
  sessionId,
  active,
  onResult,
  onConnectionChange,
  onFatalError,
  onStreamReady,
}: LiveVideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameCounterRef = useRef(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  const [frameCount, setFrameCount] = useState(0);
  const [lastResult, setLastResult] = useState<LiveDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWsReady, setIsWsReady] = useState(false);

  const wsBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000",
    [],
  );

  useEffect(() => {
    if (!active) return;

    let mounted = true;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) return;
        streamRef.current = stream;
        onStreamReady?.(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (cameraError: unknown) {
        const name = (cameraError as { name?: string })?.name ?? "UnknownError";
        const message =
          name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera + microphone access and refresh."
            : name === "NotFoundError"
              ? "No camera was found on this device."
              : "Unable to start camera stream.";
        setError(message);
        onFatalError(message);
        onStreamReady?.(null);
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
    };
  }, [active, onFatalError, onStreamReady]);

  useEffect(() => {
    if (!active) return;

    function connect(isReconnect = false) {
      const url = `${wsBaseUrl}/ws/live/${sessionId}`;
      onConnectionChange(isReconnect ? "reconnecting" : "connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket ready");
        setIsWsReady(true);
        reconnectAttemptsRef.current = 0;
        onConnectionChange("connected");
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as LiveDetectionResult;
          setLastResult(parsed);
          onResult(parsed);
        } catch {
          // ignore malformed packets
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        onConnectionChange("reconnecting");
      };

      ws.onclose = () => {
        setIsWsReady(false);
        if (!active) {
          onConnectionChange("disconnected");
          return;
        }
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(5000, reconnectAttemptsRef.current * 1000);
        reconnectTimerRef.current = window.setTimeout(() => connect(true), delay);
      };
    }

    connect(false);

    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
      onConnectionChange("disconnected");
    };
  }, [active, onConnectionChange, onResult, sessionId, wsBaseUrl]);

  useEffect(() => {
    if (!active) return;
    const drawTimer = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const hasFace = lastResult?.face_detected ?? true;
      const faceBox = (lastResult as any)?.face_box;
      const riskScore = lastResult?.risk_score ?? 0;

      let boxColor = "#10B981";
      if (riskScore > 60) boxColor = "#FF4444";
      else if (riskScore >= 30) boxColor = "#F59E0B";

      if (!hasFace) {
        ctx.fillStyle = "#F59E0B";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("NO FACE DETECTED", canvas.width / 2, canvas.height / 2);
      } else if (faceBox) {
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
        
        ctx.fillStyle = boxColor;
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText("FACE DETECTED", faceBox.x, faceBox.y - 5);
      }
    }, 1000 / 30);

    return () => window.clearInterval(drawTimer);
  }, [active, lastResult]);

  useEffect(() => {
    if (!active || !isWsReady) return;
    const captureTimer = window.setInterval(() => {
      const ws = wsRef.current;
      const video = videoRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !video) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const scratch = document.createElement("canvas");
      scratch.width = video.videoWidth;
      scratch.height = video.videoHeight;
      const sctx = scratch.getContext("2d");
      if (!sctx) return;
      sctx.drawImage(video, 0, 0, scratch.width, scratch.height);
      frameCounterRef.current += 1;
      setFrameCount(frameCounterRef.current);

      scratch.toBlob((blob) => {
        if (!blob || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const metadata = {
          timestamp: Date.now(),
          session_id: sessionId,
          frame_number: frameCounterRef.current,
          width: scratch.width,
          height: scratch.height,
        };
        const metaBytes = new TextEncoder().encode(`${JSON.stringify(metadata)}\n`);
        blob.arrayBuffer().then((buffer) => {
          const frameBytes = new Uint8Array(buffer);
          const combined = new Uint8Array(metaBytes.length + frameBytes.length);
          combined.set(metaBytes, 0);
          combined.set(frameBytes, metaBytes.length);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(combined);
          }
        });
      }, "image/jpeg", 0.8);
    }, 200);

    return () => window.clearInterval(captureTimer);
  }, [active, sessionId, isWsReady]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-bg-border bg-black">
      {error ? (
        <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-sm text-danger">
          {error}
        </div>
      ) : (
        <>
          <video ref={videoRef} muted autoPlay playsInline className="h-full w-full scale-x-[-1] object-cover" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]" />
          <FaceOverlay
            canvasRef={canvasRef}
            gradcamData={lastResult?.gradcam_data}
            suspiciousRegions={lastResult?.suspicious_regions}
            faceDetected={lastResult?.face_detected ?? true}
          />
          <div
            className={`absolute right-3 top-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white
              ${(lastResult?.face_detected ?? true) && (lastResult?.risk_score ?? 0) < 30 ? "bg-safe/90" : "bg-danger/90"}`}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            LIVE
          </div>
          <div className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 font-mono text-xs text-text-primary">
            FRAME {frameCount}
          </div>
        </>
      )}
    </div>
  );
}
