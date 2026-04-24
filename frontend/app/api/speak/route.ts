import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.RUNPOD_API_KEY;
const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const LOCAL_API_URL = process.env.LOCAL_API_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "text cannot be empty" }, { status: 400 });
  }

  // Local dev: proxy to FastAPI and return audio directly
  if (!API_KEY || !ENDPOINT_ID) {
    const res = await fetch(`${LOCAL_API_URL}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data.detail ?? `HTTP ${res.status}` }, { status: res.status });
    }
    const buf = await res.arrayBuffer();
    const audio = Buffer.from(buf).toString("base64");
    return NextResponse.json({ audio });
  }

  // Production: submit async job to RunPod
  const res = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: { text } }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to start job" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ jobId: data.id });
}
