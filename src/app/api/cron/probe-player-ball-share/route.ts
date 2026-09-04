import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { probePlayerBallShareTracking } from "@/lib/player-ball-share-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ ok: true, job: "probe-player-ball-share", result: await probePlayerBallShareTracking() });
  } catch (error) {
    console.error("Ball share probe failed", error);
    return NextResponse.json({ ok: false, job: "probe-player-ball-share", error: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
