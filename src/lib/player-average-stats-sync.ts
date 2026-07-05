import { randomUUID } from "node:crypto";
import { request } from "node:https";
import type { PrismaClient } from "@prisma/client";

const BBR_PER_GAME_URL = "https://www.basketball-reference.com/leagues/NBA_{year}_per_game.html";
const REQUEST_TIMEOUT_MS = 30000;
const SEASON_TYPE = "Regular Season";
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

type BbrRow = {
  bbrId: string;
  playerName: string;
  team: string;
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

const teamMap: Record<string, string> = {
  BRK: "BKN",
  CHO: "CHA",
  GSW: "GSW",
  NOH: "NOP",
  NOK: "NOP",
  PHO: "PHX",
  SAS: "SAS",
  UTA: "UTA"
};

function seasonLabel(startYear: number) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function bbrYearFromSeason(season: string) {
  return Number(`20${season.slice(-2)}`);
}

function defaultSeasons() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentStartYear = month >= 10 ? year : year - 1;
  return [seasonLabel(currentStartYear), seasonLabel(currentStartYear - 1)];
}

function fetchText(url: string) {
  return new Promise<string>((resolveText, rejectText) => {
    let statsRequest: ReturnType<typeof request>;
    const requestTimeout = setTimeout(() => {
      statsRequest.destroy(new Error(`Timed out after ${REQUEST_TIMEOUT_MS}ms`));
    }, REQUEST_TIMEOUT_MS);

    statsRequest = request(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "close",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        clearTimeout(requestTimeout);
        const body = Buffer.concat(chunks).toString("utf8");
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          rejectText(new Error(`${response.statusCode} ${response.statusMessage}: ${body.slice(0, 200)}`));
          return;
        }

        resolveText(body);
      });
    });

    statsRequest.on("error", (error) => {
      clearTimeout(requestTimeout);
      rejectText(error);
    });
    statsRequest.end();
  });
}

function htmlDecode(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'\u2019-]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTeam(value: string) {
  return teamMap[value] || value;
}

function numberValue(value: string | undefined) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function extractCell(rowHtml: string, dataStat: string) {
  const pattern = new RegExp(`<(?:td|th)[^>]*data-stat="${dataStat}"[^>]*>([\\s\\S]*?)<\\/(?:td|th)>`, "i");
  return htmlDecode(rowHtml.match(pattern)?.[1] || "");
}

function extractRawCell(rowHtml: string, dataStats: string[]) {
  for (const dataStat of dataStats) {
    const pattern = new RegExp(`<(?:td|th)[^>]*data-stat="${dataStat}"[^>]*>([\\s\\S]*?)<\\/(?:td|th)>`, "i");
    const match = rowHtml.match(pattern)?.[1];
    if (match !== undefined) {
      return match;
    }
  }

  return "";
}

function extractAnyCell(rowHtml: string, dataStats: string[]) {
  return htmlDecode(extractRawCell(rowHtml, dataStats));
}

function extractBbrId(rowHtml: string) {
  const playerCell = extractRawCell(rowHtml, ["name_display", "player"]);
  const href = playerCell.match(/href="\/players\/[^/]+\/([^"]+)\.html"/i)?.[1];
  return href || `name:${normalizeName(htmlDecode(playerCell))}`;
}

function parseBbrRows(html: string) {
  const tableHtml = html.match(/<table[^>]*id="per_game_stats"[\s\S]*?<\/table>/i)?.[0] || "";
  if (!tableHtml) {
    throw new Error("Basketball Reference per_game_stats table was not found");
  }

  const rows: BbrRow[] = [];
  for (const match of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1];
    const playerName = extractAnyCell(rowHtml, ["name_display", "player"]);
    if (!playerName || playerName === "Player") {
      continue;
    }

    rows.push({
      bbrId: extractBbrId(rowHtml),
      playerName,
      team: normalizeTeam(extractAnyCell(rowHtml, ["team_name_abbr", "team_id"])),
      gamesPlayed: Math.trunc(numberValue(extractAnyCell(rowHtml, ["games", "g"]))),
      minutes: numberValue(extractCell(rowHtml, "mp_per_g")),
      points: numberValue(extractCell(rowHtml, "pts_per_g")),
      rebounds: numberValue(extractCell(rowHtml, "trb_per_g")),
      assists: numberValue(extractCell(rowHtml, "ast_per_g")),
      steals: numberValue(extractCell(rowHtml, "stl_per_g")),
      blocks: numberValue(extractCell(rowHtml, "blk_per_g")),
      turnovers: numberValue(extractCell(rowHtml, "tov_per_g")),
      threesMade: numberValue(extractCell(rowHtml, "fg3_per_g")),
      fieldGoalsMade: numberValue(extractCell(rowHtml, "fg_per_g")),
      fieldGoalsAttempted: numberValue(extractCell(rowHtml, "fga_per_g")),
      freeThrowsMade: numberValue(extractCell(rowHtml, "ft_per_g")),
      freeThrowsAttempted: numberValue(extractCell(rowHtml, "fta_per_g")),
      offensiveRebounds: numberValue(extractCell(rowHtml, "orb_per_g")),
      defensiveRebounds: numberValue(extractCell(rowHtml, "drb_per_g"))
    });
  }

  return rows.filter((row) => row.gamesPlayed > 0);
}

function chooseSeasonRows(rows: BbrRow[]) {
  const byPlayer = new Map<string, BbrRow[]>();
  for (const row of rows) {
    const existing = byPlayer.get(row.bbrId) || [];
    existing.push(row);
    byPlayer.set(row.bbrId, existing);
  }

  return Array.from(byPlayer.values()).map((playerRows) =>
    playerRows.find((row) => row.team === "TOT") || playerRows[0]
  );
}

async function upsertStatsChunk(prisma: PrismaClient, rows: BbrRow[], season: string, sourceUrl: string) {
  if (rows.length === 0) {
    return;
  }

  const params: Array<string | number> = [];
  const values = rows.map((row, rowIndex) => {
    const offset = rowIndex * 23;
    params.push(
      randomUUID(),
      `bbr:${row.bbrId}`,
      row.playerName,
      row.team,
      season,
      SEASON_TYPE,
      "Basketball Reference per-game fallback",
      sourceUrl,
      row.gamesPlayed,
      row.minutes,
      row.points,
      row.rebounds,
      row.assists,
      row.steals,
      row.blocks,
      row.turnovers,
      row.threesMade,
      row.fieldGoalsMade,
      row.fieldGoalsAttempted,
      row.freeThrowsMade,
      row.freeThrowsAttempted,
      row.offensiveRebounds,
      row.defensiveRebounds
    );

    const placeholders = Array.from({ length: 23 }, (_, columnIndex) => `$${offset + columnIndex + 1}`).join(",");
    return `(${placeholders},now() AT TIME ZONE 'Asia/Shanghai')`;
  }).join(",");

  await prisma.$executeRawUnsafe(
    `INSERT INTO "PlayerAverageStats" (
      "id", "nbaPlayerId", "playerName", "team", "season", "seasonType", "source", "sourceUrl",
      "gamesPlayed", "minutes", "points", "rebounds", "assists", "steals", "blocks", "turnovers",
      "threesMade", "fieldGoalsMade", "fieldGoalsAttempted", "freeThrowsMade", "freeThrowsAttempted",
      "offensiveRebounds", "defensiveRebounds", "updatedAt"
    )
    VALUES ${values}
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
    ...params
  );
}

export async function syncPlayerAverageStatsOnce(prisma: PrismaClient, seasons = defaultSeasons()) {
  const results: Array<{ season: string; sourceUrl: string; rows: number }> = [];

  for (const season of seasons) {
    const sourceUrl = BBR_PER_GAME_URL.replace("{year}", String(bbrYearFromSeason(season)));
    const html = await fetchText(sourceUrl);
    const rows = chooseSeasonRows(parseBbrRows(html));

    let rowCount = 0;
    for (let index = 0; index < rows.length; index += 100) {
      const chunk = rows.slice(index, index + 100);
      await upsertStatsChunk(prisma, chunk, season, sourceUrl);
      rowCount += chunk.length;
    }

    results.push({
      season,
      sourceUrl,
      rows: rowCount
    });
  }

  return {
    syncedAtBeijing: new Date(Date.now() + BEIJING_OFFSET_MS).toISOString().replace("Z", ""),
    seasonType: SEASON_TYPE,
    source: "Basketball Reference per-game fallback",
    results
  };
}
