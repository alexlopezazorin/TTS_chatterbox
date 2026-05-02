"use client";

import { useRef, useState } from "react";

type Status = "idle" | "loading" | "playing" | "error";

export default function Home() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const activeGenRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const playingRef = useRef(false);

  function cleanup() {
    activeGenRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    nextStartTimeRef.current = 0;
    playingRef.current = false;
  }

  async function scheduleChunk(base64: string, genId: number) {
    if (activeGenRef.current !== genId) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      nextStartTimeRef.current = 0;
    }
    const ctx = audioCtxRef.current;

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

    if (activeGenRef.current !== genId) return;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    if (!playingRef.current) {
      playingRef.current = true;
      setStatus("playing");
    }
  }

  async function handleSpeak() {
    if (!text.trim() || status === "loading") return;

    cleanup();
    const genId = activeGenRef.current;
    setStatus("loading");
    setErrorMsg("");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        if (activeGenRef.current !== genId) return;
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const data = JSON.parse(part.slice(6));
          if (data.error) {
            setStatus("error");
            setErrorMsg(data.error);
            return;
          }
          if (data.done) break;
          if (data.audio) await scheduleChunk(data.audio, genId);
        }
      }

      // Reset to idle once the last scheduled chunk finishes playing
      if (activeGenRef.current === genId && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        const remaining = (nextStartTimeRef.current - ctx.currentTime) * 1000;
        setTimeout(() => {
          if (activeGenRef.current === genId) setStatus("idle");
        }, Math.max(0, remaining) + 200);
      } else if (activeGenRef.current === genId) {
        setStatus("idle");
      }
    } catch (err) {
      if (activeGenRef.current === genId && !abort.signal.aborted) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      }
    }
  }

  function handleStop() {
    cleanup();
    setStatus("idle");
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-xl flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">TTS Demo</h1>

        <textarea
          className="w-full h-40 rounded-xl bg-gray-800 text-white placeholder-gray-500 p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter text to synthesize..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={status === "loading"}
        />

        <button
          onClick={status === "playing" ? handleStop : handleSpeak}
          disabled={status === "loading" || (status === "idle" && !text.trim())}
          className="self-end px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {status === "loading" ? "Generating…" : status === "playing" ? "Stop" : "Speak"}
        </button>

        {status === "loading" && (
          <p className="text-indigo-400 text-sm">Generating audio…</p>
        )}
        {status === "playing" && (
          <p className="text-indigo-400 text-sm">Playing…</p>
        )}
        {status === "error" && (
          <p className="text-red-400 text-sm">{errorMsg || "Something went wrong."}</p>
        )}
      </div>
    </main>
  );
}
