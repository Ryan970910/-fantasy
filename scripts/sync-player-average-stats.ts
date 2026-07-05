import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { request } from "node:https";
import { resolve } from "node:path";

const NBA_STATS_URL = "https://stats.nba.com/stats/leaguedashplayerstats";
const REQUEST_TIMEOUT_MS = 25000;
const SEASON_TYPE = "Regular Season";

type StatsRow = Record<string, string | number | null>;

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= rawValue.replace(/^"|"$/g, "");
  }
}

function seasonLabel(startYear: number) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function defaultSeasons() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentStartYear = month >= 10 ? year : year - 1;
  return [seasonLabel(currentStartYear), seasonLabel(currentStartYear - 1)];
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function buildStatsUrl(season: string) {
  const params = new URLSearchParams({
    College: "",
    Conference: "",
    Country: "",
    DateFrom: "",
    DateTo: "",
    Division: "",
    DraftPick: "",
    DraftYear: "",
    GameScope: "",
    GameSegment: "",
    Height: "",
    LastNGames: "0",
    LeagueID: "00",
    Location: "",
    MeasureType: "Base",
    Month: "0",
    OpponentTeamID: "0",
    Outcome: "",
    PORound: "0",
    PaceAdjust: "N",
    PerMode: "PerGame",
    Period: "0",
    PlayerExperience: "",
    PlayerPosition: "",
    PlusMinus: "N",
    Rank: "N",
    Season: season,
    SeasonSegment: "",
    SeasonType: SEASON_TYPE,
    ShotClockRange: "",
    StarterBench: "",
    TeamID: "0",
    VsConference: "",
    VsDivision: "",
    Weight: ""
  });

  return `${NBA_STATS_URL}?${params.toString()}`;
}

async function fetchOfficialStats(season: string) {
  const sourceUrl = buildStatsUrl(season);
  const payload = await new Promise<unknown>((resolvePayload, rejectPayload) => {
    let statsRequest: ReturnType<typeof request>;
    const requestTimeout = setTimeout(() => {
      statsRequest.destroy(new Error(`Timed out after ${REQUEST_TIMEOUT_MS}ms`));
    }, REQUEST_TIMEOUT_MS);
    statsRequest = request(sourceUrl, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "close",
        Origin: "https://www.nba.com",
        Referer: "https://www.nba.com/stats/players/traditional",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "x-nba-stats-origin": "stats",
        "x-nba-stats-token": "true"
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        clearTimeout(requestTimeout);
        const body = Buffer.concat(chunks).toString("utf8");
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          rejectPayload(new Error(`${response.statusCode} ${response.statusMessage}: ${body.slice(0, 200)}`));
          return;
        }

        try {
          resolvePayload(JSON.parse(body));
        } catch (error) {
          rejectPayload(error);
        }
      });
    });

    statsRequest.on("error", (error) => {
      clearTimeout(requestTimeout);
      rejectPayload(error);
    });
    statsRequest.end();
  });

  const resultPayload = payload as {
    resultSets?: Array<{ headers?: string[]; rowSet?: Array<Array<string | number | null>> }>;
    resultSet?: { headers?: string[]; rowSet?: Array<Array<string | number | null>> };
  };
  const resultSet = resultPayload.resultSets?.[0] || resultPayload.resultSet;
  const headers: string[] = resultSet?.headers || [];
  const rows: Array<Array<string | number | null>> = resultSet?.rowSet || [];

  if (!headers.length || !rows.length) {
    throw new Error(`NBA official stats returned no player rows for ${season}`);
  }

  return {
    sourceUrl,
    rows: rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])) as StatsRow)
  };
}

async function syncSeason(season: string) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const officialStats = await fetchOfficialStats(season);

  try {
    let synced = 0;
    for (const row of officialStats.rows) {
      const nbaPlayerId = textValue(row.PLAYER_ID);
      const playerName = textValue(row.PLAYER_NAME);
      const team = textValue(row.TEAM_ABBREVIATION);

      if (!nbaPlayerId || !playerName || !team) {
        continue;
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "PlayerAverageStats" (
          "id", "nbaPlayerId", "playerName", "team", "season", "seasonType", "source", "sourceUrl",
          "gamesPlayed", "minutes", "points", "rebounds", "assists", "steals", "blocks", "turnovers",
          "threesMade", "fieldGoalsMade", "fieldGoalsAttempted", "freeThrowsMade", "freeThrowsAttempted",
          "offensiveRebounds", "defensiveRebounds", "updatedAt"
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,now() AT TIME ZONE 'Asia/Shanghai')
        ON CONFLICT ("nbaPlayerId", "season", "seasonType") DO UPDATE SET
          "playerName" = EXCLUDED."playerName",
          "team" = EXCLUDED."team",
          "source" = EXCLUDED."source",
          "sourceUrl" = EXCLUDED."sourceUrl",
          "gamesPlayed" = EXCLUDED."gamesPlayed",
          "minutes" = EXCLUDED."minutes",
          "points" = EXCLUDED."points",
          "rebounds" = EXCLUDED."rebounds",
          "assists" = EXCLUDED."assists",
          "steals" = EXCLUDED."steals",
          "blocks" = EXCLUDED."blocks",
          "turnovers" = EXCLUDED."turnovers",
          "threesMade" = EXCLUDED."threesMade",
          "fieldGoalsMade" = EXCLUDED."fieldGoalsMade",
          "fieldGoalsAttempted" = EXCLUDED."fieldGoalsAttempted",
          "freeThrowsMade" = EXCLUDED."freeThrowsMade",
          "freeThrowsAttempted" = EXCLUDED."freeThrowsAttempted",
          "offensiveRebounds" = EXCLUDED."offensiveRebounds",
          "defensiveRebounds" = EXCLUDED."defensiveRebounds",
          "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'`,
        randomUUID(),
        nbaPlayerId,
        playerName,
        team,
        season,
        SEASON_TYPE,
        "NBA official LeagueDashPlayerStats",
        officialStats.sourceUrl,
        Math.trunc(numberValue(row.GP)),
        numberValue(row.MIN),
        numberValue(row.PTS),
        numberValue(row.REB),
        numberValue(row.AST),
        numberValue(row.STL),
        numberValue(row.BLK),
        numberValue(row.TOV),
        numberValue(row.FG3M),
        numberValue(row.FGM),
        numberValue(row.FGA),
        numberValue(row.FTM),
        numberValue(row.FTA),
        numberValue(row.OREB),
        numberValue(row.DREB)
      );
      synced += 1;
    }

    return {
      season,
      sourceUrl: officialStats.sourceUrl,
      synced
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  loadEnvFile();
  const seasonArgs = process.argv
    .filter((arg) => arg.startsWith("--season="))
    .map((arg) => arg.split("=", 2)[1])
    .filter(Boolean);
  const seasons = seasonArgs.length > 0 ? seasonArgs : defaultSeasons();
  const results = [];

  for (const season of seasons) {
    results.push(await syncSeason(season));
  }

  console.log(JSON.stringify({
    syncedAtBeijing: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace("Z", ""),
    seasonType: SEASON_TYPE,
    results
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
