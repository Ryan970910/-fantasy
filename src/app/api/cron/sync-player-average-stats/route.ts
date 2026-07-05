import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { syncPlayerAverageStatsOnce } from "@/lib/player-average-stats-sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await syncPlayerAverageStatsOnce(prisma);
    return NextResponse.json({
      ok: true,
      job: "sync-player-average-stats",
      schedule: request.headers.get("x-vercel-cron-schedule"),
      result
    });
  } catch (error) {
    console.error("Cron sync-player-average-stats failed", error);
    return NextResponse.json(
      {
        ok: false,
        job: "sync-player-average-stats",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
