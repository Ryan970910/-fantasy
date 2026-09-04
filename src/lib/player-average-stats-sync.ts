import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { SOURCE_URL } from "@/lib/official-player-game-stats";

const SEASON_TYPE = "Regular Season";
const SOURCE = "NBA official liveData CDN (calculated from final box scores)";
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

type AggregatedPlayerStats = {
  nbaPlayerId: string;
  playerName: string;
  team: string;
  season: string;
  gamesPlayed: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threesMade: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
};

function average(total: number, gamesPlayed: number) {
  return gamesPlayed > 0 ? total / gamesPlayed : 0;
}

async function upsertAverages(prisma: PrismaClient, rows: AggregatedPlayerStats[]) {
  if (rows.length === 0) {
    return;
  }

  const params: Array<string | number> = [];
  const values = rows.map((row, rowIndex) => {
    const offset = rowIndex * 23;
    params.push(
      randomUUID(), row.nbaPlayerId, row.playerName, row.team, row.season, SEASON_TYPE, SOURCE, SOURCE_URL,
      row.gamesPlayed,
      average(row.minutes, row.gamesPlayed), average(row.points, row.gamesPlayed), average(row.rebounds, row.gamesPlayed),
      average(row.assists, row.gamesPlayed), average(row.steals, row.gamesPlayed), average(row.blocks, row.gamesPlayed),
      average(row.turnovers, row.gamesPlayed), average(row.threesMade, row.gamesPlayed),
      average(row.fieldGoalsMade, row.gamesPlayed), average(row.fieldGoalsAttempted, row.gamesPlayed),
      average(row.freeThrowsMade, row.gamesPlayed), average(row.freeThrowsAttempted, row.gamesPlayed),
      average(row.offensiveRebounds, row.gamesPlayed), average(row.defensiveRebounds, row.gamesPlayed)
    );
    return `(${Array.from({ length: 23 }, (_, index) => `$${offset + index + 1}`).join(",")},now() AT TIME ZONE 'Asia/Shanghai')`;
  }).join(",");

  await prisma.$executeRawUnsafe(
    `INSERT INTO "PlayerAverageStats" (
      "id", "nbaPlayerId", "playerName", "team", "season", "seasonType", "source", "sourceUrl",
      "gamesPlayed", "minutes", "points", "rebounds", "assists", "steals", "blocks", "turnovers",
      "threesMade", "fieldGoalsMade", "fieldGoalsAttempted", "freeThrowsMade", "freeThrowsAttempted",
      "offensiveRebounds", "defensiveRebounds", "updatedAt"
    ) VALUES ${values}
    ON CONFLICT ("nbaPlayerId", "season", "seasonType") DO UPDATE SET
      "playerName" = EXCLUDED."playerName", "team" = EXCLUDED."team", "source" = EXCLUDED."source",
      "sourceUrl" = EXCLUDED."sourceUrl", "gamesPlayed" = EXCLUDED."gamesPlayed", "minutes" = EXCLUDED."minutes",
      "points" = EXCLUDED."points", "rebounds" = EXCLUDED."rebounds", "assists" = EXCLUDED."assists",
      "steals" = EXCLUDED."steals", "blocks" = EXCLUDED."blocks", "turnovers" = EXCLUDED."turnovers",
      "threesMade" = EXCLUDED."threesMade", "fieldGoalsMade" = EXCLUDED."fieldGoalsMade",
      "fieldGoalsAttempted" = EXCLUDED."fieldGoalsAttempted", "freeThrowsMade" = EXCLUDED."freeThrowsMade",
      "freeThrowsAttempted" = EXCLUDED."freeThrowsAttempted", "offensiveRebounds" = EXCLUDED."offensiveRebounds",
      "defensiveRebounds" = EXCLUDED."defensiveRebounds", "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'`,
    ...params
  );
}

export async function syncPlayerAverageStatsOnce(prisma: PrismaClient, requestedSeasons?: string[]) {
  const seasons = requestedSeasons && requestedSeasons.length > 0
    ? requestedSeasons
    : (await prisma.$queryRaw<Array<{ season: string }>>`
      SELECT DISTINCT "season" FROM "PlayerGameStats" ORDER BY "season" DESC
    `).map((row) => row.season);
  if (seasons.length === 0) {
    return { syncedAtBeijing: new Date(Date.now() + BEIJING_OFFSET_MS).toISOString().replace("Z", ""), seasonType: SEASON_TYPE, source: SOURCE, results: [] };
  }

  const rows = await prisma.$queryRaw<AggregatedPlayerStats[]>`
    SELECT
      "nbaPlayerId",
      (ARRAY_AGG("playerName" ORDER BY "gameDate" DESC))[1] AS "playerName",
      (ARRAY_AGG("team" ORDER BY "gameDate" DESC))[1] AS "team",
      "season",
      COUNT(*)::int AS "gamesPlayed",
      SUM("minutes") AS "minutes",
      SUM("points")::float AS "points",
      SUM("rebounds")::float AS "rebounds",
      SUM("assists")::float AS "assists",
      SUM("steals")::float AS "steals",
      SUM("blocks")::float AS "blocks",
      SUM("turnovers")::float AS "turnovers",
      SUM("threesMade")::float AS "threesMade",
      SUM("fieldGoalsMade")::float AS "fieldGoalsMade",
      SUM("fieldGoalsAttempted")::float AS "fieldGoalsAttempted",
      SUM("freeThrowsMade")::float AS "freeThrowsMade",
      SUM("freeThrowsAttempted")::float AS "freeThrowsAttempted",
      SUM("offensiveRebounds")::float AS "offensiveRebounds",
      SUM("defensiveRebounds")::float AS "defensiveRebounds"
    FROM "PlayerGameStats"
    WHERE "season" = ANY(${seasons})
    GROUP BY "nbaPlayerId", "season"
  `;

  for (let index = 0; index < rows.length; index += 100) {
    await upsertAverages(prisma, rows.slice(index, index + 100));
  }

  return {
    syncedAtBeijing: new Date(Date.now() + BEIJING_OFFSET_MS).toISOString().replace("Z", ""),
    seasonType: SEASON_TYPE,
    source: SOURCE,
    results: seasons.map((season) => ({ season, sourceUrl: SOURCE_URL, rows: rows.filter((row) => row.season === season).length }))
  };
}
