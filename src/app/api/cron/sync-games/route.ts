import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { syncGamesOnce } from "@/lib/nba-game-sync";
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
    const result = await syncGamesOnce(prisma);
    return NextResponse.json({
      ok: true,
      job: "sync-games",
      schedule: request.headers.get("x-vercel-cron-schedule"),
      result
    });
  } catch (error) {
    console.error("Cron sync-games failed", error);
    return NextResponse.json(
      {
        ok: false,
        job: "sync-games",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
