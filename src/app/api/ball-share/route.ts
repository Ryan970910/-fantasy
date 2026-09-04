import { NextResponse } from "next/server";
import { loadPlayerNameTranslations, normalizeTranslationName, translatePlayerName } from "@/lib/player-name-translations";
import { defaultBallShareSeason } from "@/lib/player-ball-share-sync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MetricKey = "UsageRate" | "TimePossession" | "Touches" | "PotentialAssists";

function percentile(rows: Array<Record<string, number | null>>, selected: Record<string, number | null>, key: MetricKey) {
  const property = `season${key}`;
  const value = selected[property];
  const values = rows.map((row) => row[property]).filter((item): item is number => typeof item === "number");
  if (typeof value !== "number" || !values.length) return 0;
  return Math.round((values.filter((item) => item <= value).length / values.length) * 100);
}

function roleFor(row: Record<string, number | null>) {
  const usage = row.seasonUsageRate || 0;
  const possession = row.seasonTimePossession || 0;
  const potentialAssists = row.seasonPotentialAssists || 0;
  if (possession >= 5 && potentialAssists >= 8) return "持球核心";
  if (usage >= 0.28) return "终结核心";
  if (potentialAssists >= 7) return "组织参与者";
  return "轮换角色";
}

function usageLevel(usage: number) {
  if (usage >= 0.3) return "核心球权";
  if (usage >= 0.25) return "高球权";
  if (usage >= 0.2) return "中等球权";
  return "低球权";
}

function metric(label: string, description: string, selected: Record<string, number | null>, peers: Array<Record<string, number | null>>, key: MetricKey) {
  const property = key[0].toLowerCase() + key.slice(1) as "usageRate" | "timePossession" | "touches" | "potentialAssists";
  const format = (value: number | null) => {
    if (typeof value !== "number") return "--";
    if (key === "UsageRate") return `${(value * 100).toFixed(1)}%`;
    if (key === "TimePossession") return `${value.toFixed(1)} min`;
    return value.toFixed(1);
  };
  const last5 = selected[`last5${key}`];
  const season = selected[`season${key}`];
  const difference = typeof last5 === "number" && typeof season === "number" ? last5 - season : 0;
  const differenceText = key === "UsageRate" ? `${difference >= 0 ? "+" : ""}${(difference * 100).toFixed(1)} pct` : `${difference >= 0 ? "+" : ""}${difference.toFixed(1)}${key === "TimePossession" ? " min" : ""}`;
  return { label, description, percentile: percentile(peers, selected, key), last5: format(last5), last10: format(selected[`last10${key}`]), season: format(season), trend: differenceText, rising: difference >= 0 };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (!query) return NextResponse.json({ error: "请输入球员姓名。" }, { status: 400 });
  const season = defaultBallShareSeason();
  try {
    const [rows, translations, identities] = await Promise.all([
      prisma.playerBallShare.findMany({ where: { season }, orderBy: { playerName: "asc" } }),
      loadPlayerNameTranslations(prisma),
      prisma.playerExternalIdentity.findMany({ include: { currentPosition: true } })
    ]);
    const normalizedQuery = normalizeTranslationName(query);
    const selected = rows.find((row) => normalizeTranslationName(row.playerName).includes(normalizedQuery) || normalizeTranslationName(translatePlayerName(row.playerName, translations)).includes(normalizedQuery));
    if (!selected) return NextResponse.json({ status: "NOT_FOUND", season, message: "未找到该球员的球权数据。" }, { status: 404 });

    const positionByPlayerId = new Map(identities.map((identity) => [identity.nbaPlayerId, identity.currentPosition?.position1 || "ALL"]));
    const selectedPosition = positionByPlayerId.get(selected.nbaPlayerId) || "ALL";
    const peers = rows.filter((row) => row.dataStatus === "AVAILABLE" && (positionByPlayerId.get(row.nbaPlayerId) || "ALL") === selectedPosition) as unknown as Array<Record<string, number | null>>;
    const player = selected as unknown as Record<string, number | null> & { playerName: string; currentTeam: string; dataStatus: string; unavailableReason: string | null; sourceUrl: string; syncedAt: Date; season: string };
    if (selected.dataStatus !== "AVAILABLE") {
      return NextResponse.json({ status: selected.dataStatus, season, player: { chineseName: translatePlayerName(selected.playerName, translations), englishName: selected.playerName, team: selected.currentTeam, reason: selected.unavailableReason } });
    }
    const usage = player.seasonUsageRate || 0;
    return NextResponse.json({
      status: "AVAILABLE",
      season,
      player: {
        chineseName: translatePlayerName(selected.playerName, translations), englishName: selected.playerName, team: selected.currentTeam,
        role: roleFor(player), usageLevel: usageLevel(usage),
        summary: `最近 5 场使用率相比赛季平均${(player.last5UsageRate || 0) >= usage ? "上升" : "下降"}，可结合持球、触球和潜在助攻判断进攻角色变化。`,
        metrics: [
          metric("使用率", "由自己终结的进攻回合占比", player, peers, "UsageRate"),
          metric("持球时间", "每场实际控制篮球的总时间", player, peers, "TimePossession"),
          metric("场均触球", "每场获得并控制篮球的次数", player, peers, "Touches"),
          metric("潜在助攻", "传球后队友一次运球内出手的机会", player, peers, "PotentialAssists")
        ],
        sourceUrl: selected.sourceUrl,
        syncedAt: selected.syncedAt
      }
    });
  } catch (error) {
    console.error("Ball share lookup failed", error);
    return NextResponse.json({ error: "近期球权数据暂时不可用，请稍后重试。" }, { status: 503 });
  }
}
