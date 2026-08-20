import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { syncPlayerPositionsOnce } from "@/lib/player-position-sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await syncPlayerPositionsOnce(prisma);
    await prisma.cronExecution.create({ data: { job: "sync-player-positions", trigger: "vercel-cron", status: "success", details: JSON.stringify(result), completedAt: new Date() } });
    return NextResponse.json({ ok: true, job: "sync-player-positions", schedule: request.headers.get("x-vercel-cron-schedule"), result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cron sync-player-positions failed", error);
    try { await prisma.cronExecution.create({ data: { job: "sync-player-positions", trigger: "vercel-cron", status: "failed", details: message, completedAt: new Date() } }); } catch (logError) { console.error("Cron execution logging failed", logError); }
    return NextResponse.json({ ok: false, job: "sync-player-positions", error: message }, { status: 500 });
  }
}
