import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const LOCAL_API_URL = process.env.LOCAL_API_URL ?? "http://localhost:8000";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "X-Accel-Buffering": "no",
};

function splitSentences(text: string): string[] {
  const parts = text.trim().split(/(?<=[.!?])\s+/);
  const result: string[] = [];
  let pending = "";
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    pending = pending ? `${pending} ${s}` : s;
    if (pending.length >= 20) {
      result.push(pending);
      pending = "";
    }
  }
  if (pending) result.push(pending);
  return result.length ? result : [text.trim()];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return new Response(JSON.stringify({ error: "text cannot be empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Local: proxy FastAPI streaming SSE directly
  if (!API_KEY || !ENDPOINT_ID) {
    const upstream = await fetch(`${LOCAL_API_URL}/speak/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: err.detail ?? `HTTP ${upstream.status}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(upstream.body, { headers: SSE_HEADERS });
  }

  // RunPod: submit one job per sentence, stream each result as it completes
  const sentences = splitSentences(text);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      for (const sentence of sentences) {
        let jobId: string;
        try {
          const jobRes = await fetch(
            `https://api.runpod.ai/v2/${ENDPOINT_ID}/run`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ input: { text: sentence } }),
            }
          );
          if (!jobRes.ok) {
            send({ error: `Failed to submit job: HTTP ${jobRes.status}` });
            controller.close();
            return;
          }
          jobId = (await jobRes.json()).id;
        } catch (e) {
          send({ error: String(e) });
          controller.close();
          return;
        }

        while (true) {
          await sleep(500);
          try {
            const statusRes = await fetch(
              `https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`,
              { headers: { Authorization: `Bearer ${API_KEY}` } }
            );
            const s = await statusRes.json();
            if (s.status === "COMPLETED") {
              if (s.output?.error) { send({ error: s.output.error }); controller.close(); return; }
              send({ audio: s.output?.audio });
              break;
            }
            if (s.status === "FAILED") {
              send({ error: s.error ?? s.output?.error ?? "Job failed" });
              controller.close();
              return;
            }
          } catch (e) {
            send({ error: String(e) });
            controller.close();
            return;
          }
        }
      }

      send({ done: true });
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
