import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { syncGamesOnce } from "@/lib/nba-game-sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function beijingNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) {
    return unauthorized;
  }

  let executionId: string | null = null;
  try {
    executionId = (
      await prisma.cronExecution.create({
        data: {
          job: "sync-games",
          trigger: request.headers.get("x-vercel-cron-schedule") || "manual"
        }
      })
    ).id;
    const result = await syncGamesOnce(prisma);
    await prisma.cronExecution.update({
      where: { id: executionId },
      data: {
        status: "success",
        details: JSON.stringify({ count: result.count, gameDate: result.gameDate }),
        completedAt: beijingNow()
      }
    });
    return NextResponse.json({
      ok: true,
      job: "sync-games",
      schedule: request.headers.get("x-vercel-cron-schedule"),
      result
    });
  } catch (error) {
    console.error("Cron sync-games failed", error);
    if (executionId) {
      await prisma.cronExecution
        .update({
          where: { id: executionId },
          data: {
            status: "failed",
            details: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            completedAt: beijingNow()
          }
        })
        .catch(() => undefined);
    }
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
