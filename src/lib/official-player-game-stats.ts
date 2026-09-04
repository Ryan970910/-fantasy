import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const NBA_CDN_BOXSCORE_URL = "https://cdn.nba.com/static/json/liveData/boxscore/boxscore_";
const REQUEST_TIMEOUT_MS = 12000;
const SOURCE_URL = "https://cdn.nba.com/static/json/liveData/boxscore/";

type NbaBoxScorePlayer = {
  personId?: number | string;
  name?: string;
  nameI?: string;
  firstName?: string;
  familyName?: string;
  statistics?: {
    minutes?: string;
    points?: number;
    reboundsTotal?: number;
    assists?: number;
    steals?: number;
    blocks?: number;
    turnovers?: number;
    threePointersMade?: number;
    fieldGoalsMade?: number;
    fieldGoalsAttempted?: number;
    freeThrowsMade?: number;
    freeThrowsAttempted?: number;
    reboundsOffensive?: number;
    reboundsDefensive?: number;
  };
};

type NbaBoxScoreTeam = {
  teamTricode?: string;
  players?: NbaBoxScorePlayer[];
};

type PlayerGameStatsRow = {
  gameId: string;
  nbaPlayerId: string;
  playerName: string;
  team: string;
  season: string;
  gameDate: Date;
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
  sourceUrl: string;
};

type FinishedGame = {
  id: string;
  gameTimeUTC?: string;
};

function numberValue(value: number | undefined) {
  return Number.isFinite(value) ? value as number : 0;
}

function playerName(player: NbaBoxScorePlayer) {
  return player.name || player.nameI || [player.firstName, player.familyName].filter(Boolean).join(" ") || "";
}

function minutesValue(value: string | undefined) {
  const match = value?.match(/^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!match) {
    return 0;
  }

  return Number(match[1] || 0) + Number(match[2] || 0) / 60;
}

function seasonForGame(gameDate: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric"
  }).formatToParts(gameDate);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export function isRegularSeasonGame(gameId: string) {
  return gameId.startsWith("002");
}

export function parseBoxScorePlayerStats(
  gameId: string,
  gameTimeUTC: string | undefined,
  boxscore: { game?: { homeTeam?: NbaBoxScoreTeam; awayTeam?: NbaBoxScoreTeam } }
) {
  const gameDate = gameTimeUTC ? new Date(gameTimeUTC) : null;
  if (!gameDate || Number.isNaN(gameDate.getTime())) {
    throw new Error(`Game ${gameId} did not include a valid gameTimeUTC`);
  }

  const season = seasonForGame(gameDate);
  const rows: PlayerGameStatsRow[] = [];
  for (const team of [boxscore.game?.awayTeam, boxscore.game?.homeTeam]) {
    for (const player of team?.players || []) {
      const stats = player.statistics;
      const minutes = minutesValue(stats?.minutes);
      const nbaPlayerId = String(player.personId || "");
      const name = playerName(player);

      // A DNP is listed in a box score but is not a game played.
      if (!stats || minutes <= 0 || !nbaPlayerId || !name || !team?.teamTricode) {
        continue;
      }

      rows.push({
        gameId,
        nbaPlayerId,
        playerName: name,
        team: team.teamTricode,
        season,
        gameDate,
        minutes,
        points: numberValue(stats.points),
        rebounds: numberValue(stats.reboundsTotal),
        assists: numberValue(stats.assists),
        steals: numberValue(stats.steals),
        blocks: numberValue(stats.blocks),
        turnovers: numberValue(stats.turnovers),
        threesMade: numberValue(stats.threePointersMade),
        fieldGoalsMade: numberValue(stats.fieldGoalsMade),
        fieldGoalsAttempted: numberValue(stats.fieldGoalsAttempted),
        freeThrowsMade: numberValue(stats.freeThrowsMade),
        freeThrowsAttempted: numberValue(stats.freeThrowsAttempted),
        offensiveRebounds: numberValue(stats.reboundsOffensive),
        defensiveRebounds: numberValue(stats.reboundsDefensive),
        sourceUrl: `${NBA_CDN_BOXSCORE_URL}${gameId}.json`
      });
    }
  }

  return rows;
}

async function fetchBoxScore(gameId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${NBA_CDN_BOXSCORE_URL}${gameId}.json`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<{ game?: { homeTeam?: NbaBoxScoreTeam; awayTeam?: NbaBoxScoreTeam } }>;
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertPlayerGameStats(prisma: PrismaClient, rows: PlayerGameStatsRow[]) {
  if (rows.length === 0) {
    return;
  }

  const params: Array<string | number | Date> = [];
  const values = rows.map((row, rowIndex) => {
    const offset = rowIndex * 22;
    params.push(
      randomUUID(), row.gameId, row.nbaPlayerId, row.playerName, row.team, row.season, row.gameDate,
      row.minutes, row.points, row.rebounds, row.assists, row.steals, row.blocks, row.turnovers,
      row.threesMade, row.fieldGoalsMade, row.fieldGoalsAttempted, row.freeThrowsMade, row.freeThrowsAttempted,
      row.offensiveRebounds, row.defensiveRebounds, row.sourceUrl
    );
    return `(${Array.from({ length: 22 }, (_, index) => `$${offset + index + 1}`).join(",")},now() AT TIME ZONE 'Asia/Shanghai')`;
  }).join(",");

  await prisma.$executeRawUnsafe(
    `INSERT INTO "PlayerGameStats" (
      "id", "gameId", "nbaPlayerId", "playerName", "team", "season", "gameDate", "minutes", "points",
      "rebounds", "assists", "steals", "blocks", "turnovers", "threesMade", "fieldGoalsMade",
      "fieldGoalsAttempted", "freeThrowsMade", "freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds",
      "sourceUrl", "updatedAt"
    ) VALUES ${values}
    ON CONFLICT ("gameId", "nbaPlayerId") DO UPDATE SET
      "playerName" = EXCLUDED."playerName", "team" = EXCLUDED."team", "season" = EXCLUDED."season",
      "gameDate" = EXCLUDED."gameDate", "minutes" = EXCLUDED."minutes", "points" = EXCLUDED."points",
      "rebounds" = EXCLUDED."rebounds", "assists" = EXCLUDED."assists", "steals" = EXCLUDED."steals",
      "blocks" = EXCLUDED."blocks", "turnovers" = EXCLUDED."turnovers", "threesMade" = EXCLUDED."threesMade",
      "fieldGoalsMade" = EXCLUDED."fieldGoalsMade", "fieldGoalsAttempted" = EXCLUDED."fieldGoalsAttempted",
      "freeThrowsMade" = EXCLUDED."freeThrowsMade", "freeThrowsAttempted" = EXCLUDED."freeThrowsAttempted",
      "offensiveRebounds" = EXCLUDED."offensiveRebounds", "defensiveRebounds" = EXCLUDED."defensiveRebounds",
      "sourceUrl" = EXCLUDED."sourceUrl", "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'`,
    ...params
  );
}

export async function syncFinishedGamePlayerStats(prisma: PrismaClient, games: FinishedGame[]) {
  const completedGames = games.filter((game) => isRegularSeasonGame(game.id));
  const results = await Promise.allSettled(completedGames.map(async (game) => {
    const boxscore = await fetchBoxScore(game.id);
    return parseBoxScorePlayerStats(game.id, game.gameTimeUTC, boxscore);
  }));
  const rows = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);

  for (let index = 0; index < rows.length; index += 100) {
    await upsertPlayerGameStats(prisma, rows.slice(index, index + 100));
  }

  return {
    games: completedGames.length,
    players: rows.length,
    seasons: [...new Set(rows.map((row) => row.season))],
    errors: results.flatMap((result, index) => result.status === "rejected"
      ? [`${completedGames[index].id}: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`]
      : [])
  };
}

export { SOURCE_URL };
