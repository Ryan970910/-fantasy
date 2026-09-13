import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadOfficialInjuries } from "@/lib/nba-injury-source";
import { loadPlayerNameTranslations, translatePlayerName } from "@/lib/player-name-translations";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    if (!await getCurrentUser()) return NextResponse.json({ error: "请先登录后查看伤病报告。" }, { status: 401, headers });
    const report = await loadOfficialInjuries();
    const translations = report.entries.length ? await loadPlayerNameTranslations(prisma) : new Map<string, string>();
    return NextResponse.json({ ...report, entries: report.entries.map(entry => ({ ...entry, name: translatePlayerName(entry.englishName, translations) })) }, { headers });
  } catch {
    return NextResponse.json({ error: "NBA 官方报告暂时无法读取，请稍后重试，或前往 NBA 官网查看原文。" }, { status: 503, headers });
  }
}
