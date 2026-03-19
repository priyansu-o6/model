"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import AudioWaveform from "@/components/verification/AudioWaveform";
import LivenessChallenge from "@/components/verification/LivenessChallenge";
import LiveVideoStream from "@/components/verification/LiveVideoStream";
import RiskScoreMeter from "@/components/verification/RiskScoreMeter";
import SignalPanel from "@/components/verification/SignalPanel";
import { endLiveSession, startLiveSession } from "@/lib/api";
import { LiveDetectionResult } from "@/lib/live-types";

type Stage = "start" | "active" | "complete";

export default function LiveVerificationPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("start");
  const [subjectName, setSubjectName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">(
    "disconnected",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveDetectionResult | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  async function beginVerification() {
    setError(null);
    try {
      const res = await startLiveSession(subjectName);
      setSessionId(res.session_id);
      setStage("active");
    } catch {
      setError("Unable to start live verification session.");
    }
  }

  async function finishVerification() {
    if (!sessionId) return;
    try {
      await endLiveSession(sessionId);
    } catch {
      // best effort
    } finally {
      if (audioStream) {
        for (const track of audioStream.getTracks()) track.stop();
        setAudioStream(null);
      }
      setStage("complete");
      router.push("/sessions");
    }
  }

  if (stage === "start") {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-xl border border-bg-border bg-bg-surface/70 p-6">
        <h1 className="font-display text-xl text-text-primary">Begin Verification</h1>
        <p className="mt-2 text-sm text-text-muted">Start a real-time session and stream live camera frames.</p>
        <div className="mt-4 space-y-2">
          <label htmlFor="subject-name" className="block text-xs text-text-muted">
            Subject Name
          </label>
          <input
            id="subject-name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            className="w-full rounded border border-bg-border bg-bg-base px-3 py-2 text-sm text-text-primary"
            placeholder="Enter subject name"
          />
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button
          className="mt-5 rounded bg-accent-cyan px-4 py-2 text-sm font-medium text-bg-base"
          onClick={beginVerification}
        >
          Start Live Verification
        </button>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-h-0 flex-col gap-4">
        {sessionId && (
          <LiveVideoStream
            sessionId={sessionId}
            active={stage === "active"}
            onResult={setResult}
            onConnectionChange={setConnection}
            onFatalError={setError}
            onStreamReady={setAudioStream}
          />
        )}
        <AudioWaveform stream={audioStream} spoofingProbability={result?.audio_spoof_probability ?? 0} />
      </div>

      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        <div className="rounded-xl border border-bg-border bg-bg-surface/70 p-3 text-xs text-text-muted">
          Session: <span className="font-mono text-text-primary">{sessionId}</span>
          <span className="ml-3">
            WS:{" "}
            <span className={connection === "connected" ? "text-safe" : connection === "reconnecting" ? "text-warning" : "text-danger"}>
              {connection}
            </span>
          </span>
          {error && <div className="mt-2 text-danger">{error}</div>}
        </div>

        <RiskScoreMeter score={result?.risk_score ?? 0} confidence={result?.confidence ?? 0.85} />
        <LivenessChallenge challenge={result?.challenge} completed={result?.completed_challenges} />
        <SignalPanel result={result} processing={connection !== "connected"} />

        <button
          className="sticky bottom-2 z-20 w-full rounded-md border border-danger/60 bg-danger px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-danger/30 hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-danger/50"
          onClick={finishVerification}
        >
          End Verification
        </button>
      </div>
    </div>
  );
}
