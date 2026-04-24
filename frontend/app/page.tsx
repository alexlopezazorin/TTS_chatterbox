"use client";

import { useRef, useState } from "react";

type Status = "idle" | "loading" | "playing" | "error";

export default function Home() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function handleSpeak() {
    if (!text.trim() || status === "loading") return;

    // Stop any audio already playing
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setStatus("idle");
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setStatus("error");
        setErrorMsg("Failed to play audio.");
      };

      setStatus("playing");
      audio.play();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  function handleStop() {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setStatus("idle");
  }

  const buttonLabel =
    status === "loading" ? "Generating…" : status === "playing" ? "Stop" : "Speak";

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
          {buttonLabel}
        </button>

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
