"use client";

type ResultCallback = (data: unknown) => void;

export class LiveWebSocketClient {
  private socket: WebSocket | null = null;
  private onResultCb: ResultCallback | null = null;

  connect(sessionId: string) {
    if (typeof window === "undefined") return;
    const url = `${process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000"}/ws/live/${sessionId}`;
    this.socket = new WebSocket(url);
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.onResultCb?.(data);
      } catch {
        // ignore parse errors
      }
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  sendFrame(blob: Blob, metadata: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const metaString = JSON.stringify(metadata);
    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(metaString + "\n");

    const reader = new FileReader();
    reader.onload = () => {
      const frameBytes = new Uint8Array(reader.result as ArrayBuffer);
      const combined = new Uint8Array(metaBytes.length + frameBytes.length);
      combined.set(metaBytes, 0);
      combined.set(frameBytes, metaBytes.length);
      this.socket?.send(combined);
    };
    reader.readAsArrayBuffer(blob);
  }

  onResult(callback: ResultCallback) {
    this.onResultCb = callback;
  }
}

