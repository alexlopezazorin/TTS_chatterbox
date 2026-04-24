import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.RUNPOD_API_KEY!;
const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const res = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${id}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to check status" }, { status: 502 });
  }

  const data = await res.json();

  if (data.status === "COMPLETED") {
    return NextResponse.json({ status: "completed", audio: data.output.audio });
  }
  if (data.status === "FAILED") {
    return NextResponse.json({ status: "failed", error: data.output?.error ?? "Unknown error" });
  }
  return NextResponse.json({ status: "pending" });
}
