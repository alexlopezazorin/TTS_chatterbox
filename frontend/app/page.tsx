"use client";

import { useRef, useState } from "react";

type Status = "idle" | "loading" | "playing" | "error";

export default function Home() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeGenRef = useRef(0);

  function cleanup() {
    activeGenRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
  }

  function playAudio(b64: string, genId: number) {
    if (activeGenRef.current !== genId) return;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      setStatus("idle");
      URL.revokeObjectURL(url);
      audioRef.current = null;
    };
    audio.onerror = () => setStatus("error");
    setStatus("playing");
    audio.play();
  }

  async function pollUntilDone(jobId: string, genId: number) {
    while (true) {
      if (activeGenRef.current !== genId) return;

      await new Promise((r) => setTimeout(r, 2000));

      if (activeGenRef.current !== genId) return;

      const res = await fetch(`/api/speak/${jobId}`);
      const data = await res.json();

      if (activeGenRef.current !== genId) return;

      if (data.status === "completed") {
        playAudio(data.audio, genId);
        return;
      }
      if (data.status === "failed") {
        setStatus("error");
        setErrorMsg(data.error ?? "Synthesis failed.");
        return;
      }
    }
  }

  async function handleSpeak() {
    if (!text.trim() || status === "loading") return;

    cleanup();
    const genId = activeGenRef.current;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Local dev: audio returned immediately
      if (data.audio) {
        playAudio(data.audio, genId);
      } else {
        // Production: poll RunPod for result
        pollUntilDone(data.jobId, genId);
      }
    } catch (err) {
      if (activeGenRef.current === genId) {
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
