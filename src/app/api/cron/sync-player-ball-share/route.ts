import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { syncPlayerBallShareOnce } from "@/lib/player-ball-share-sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function beijingNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  const running = await prisma.cronExecution.findFirst({
    where: { job: "sync-player-ball-share", status: "running", startedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } }
  });
  if (running) return NextResponse.json({ ok: false, error: "A player ball share sync is already running." }, { status: 409 });

  let executionId: string | null = null;
  try {
    executionId = (await prisma.cronExecution.create({ data: { job: "sync-player-ball-share", trigger: request.headers.get("x-vercel-cron-schedule") || "manual" } })).id;
    const result = await syncPlayerBallShareOnce(prisma);
    await prisma.cronExecution.update({ where: { id: executionId }, data: { status: "success", details: JSON.stringify(result), completedAt: beijingNow() } });
    return NextResponse.json({ ok: true, job: "sync-player-ball-share", result });
  } catch (error) {
    console.error("Ball share sync failed", error);
    if (executionId) await prisma.cronExecution.update({ where: { id: executionId }, data: { status: "failed", details: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), completedAt: beijingNow() } }).catch(() => undefined);
    return NextResponse.json({ ok: false, job: "sync-player-ball-share", error: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }
}
