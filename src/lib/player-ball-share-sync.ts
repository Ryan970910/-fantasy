import type { PrismaClient } from "@prisma/client";
import { request } from "node:https";
import { normalizeTranslationName } from "./player-name-translations";
import { fetchOfficialPlayers, type OfficialPlayer } from "./player-position-sync";

const NBA_STATS_URL = "https://stats.nba.com/stats";
const SEASON_TYPE = "Regular Season";
const REQUEST_TIMEOUT_MS = 30000;
const REQUEST_DELAY_MS = 3500;
const RETRY_DELAY_MS = 5000;

type MetricName = "usageRate" | "timePossession" | "touches" | "potentialAssists";
export type TrackingRow = { playerId: string; playerName: string; team: string; gamesPlayed: number; value: number };
export type TrackingWindows = Record<0 | 5 | 10, Map<string, TrackingRow>>;
export type MetricWindows = Record<MetricName, TrackingWindows>;

const METRIC_CONFIG: Record<MetricName, { endpoint: string; measure: string; column: string }> = {
  usageRate: { endpoint: "leaguedashplayerstats", measure: "Advanced", column: "USG_PCT" },
  timePossession: { endpoint: "leaguedashptstats", measure: "Possessions", column: "TIME_OF_POSS" },
  touches: { endpoint: "leaguedashptstats", measure: "Possessions", column: "TOUCHES" },
  potentialAssists: { endpoint: "leaguedashptstats", measure: "Passing", column: "POTENTIAL_AST" }
};

export type BallShareStatus = "AVAILABLE" | "ROOKIE" | "TEAM_CHANGED" | "NO_TRACKING_DATA";
export type BallShareSyncRow = {
  nbaPlayerId: string;
  playerName: string;
  normalizedPlayerName: string;
  currentTeam: string;
  sourceTeam: string | null;
  season: string;
  dataStatus: BallShareStatus;
  unavailableReason: string | null;
  gamesPlayed: number;
  last5UsageRate: number | null;
  last10UsageRate: number | null;
  seasonUsageRate: number | null;
  last5TimePossession: number | null;
  last10TimePossession: number | null;
  seasonTimePossession: number | null;
  last5Touches: number | null;
  last10Touches: number | null;
  seasonTouches: number | null;
  last5PotentialAssists: number | null;
  last10PotentialAssists: number | null;
  seasonPotentialAssists: number | null;
  sourceUrl: string;
};

function seasonLabel(startYear: number) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export function defaultBallShareSeason(now = new Date()) {
  const startYear = now.getMonth() + 1 >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  return seasonLabel(startYear);
}

function seasonStartYear(season: string) {
  return Number(season.slice(0, 4));
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function resultRows(payload: unknown, metricColumn: string) {
  const set = (payload as { resultSets?: Array<{ headers?: string[]; rowSet?: unknown[][] }> }).resultSets?.[0];
  const headers = set?.headers || [];
  if (!headers.includes("PLAYER_ID") || !headers.includes(metricColumn)) {
    throw new Error(`NBA Tracking response is missing PLAYER_ID or ${metricColumn}`);
  }
  return (set?.rowSet || []).map((row) => {
    const value = (name: string) => row[headers.indexOf(name)];
    return {
      playerId: String(value("PLAYER_ID") || ""),
      playerName: String(value("PLAYER_NAME") || ""),
      team: String(value("TEAM_ABBREVIATION") || ""),
      gamesPlayed: Math.trunc(numberValue(value("GP"))),
      value: numberValue(value(metricColumn))
    };
  }).filter((row) => row.playerId && row.playerName);
}

function requestUrl(endpoint: string, season: string, lastNGames: 0 | 5 | 10, measureType?: string) {
  const params = new URLSearchParams({
    College: "", Conference: "", Country: "", DateFrom: "", DateTo: "", Division: "", DraftPick: "", DraftYear: "", GameScope: "", Height: "",
    LastNGames: String(lastNGames), LeagueID: "00", Location: "", Month: "0", OpponentTeamID: "0", Outcome: "", PORound: "0", PerMode: "PerGame",
    PlayerExperience: "", PlayerOrTeam: "Player", PlayerPosition: "", Season: season, SeasonSegment: "", SeasonType: SEASON_TYPE, StarterBench: "", TeamID: "0", VsConference: "", VsDivision: "", Weight: ""
  });
  if (endpoint === "leaguedashplayerstats") {
    params.set("MeasureType", measureType || "Advanced");
    params.set("PaceAdjust", "N");
    params.set("Period", "0");
    params.set("PlusMinus", "N");
    params.set("Rank", "N");
    params.set("ShotClockRange", "");
    params.set("TwoWay", "0");
  } else {
    params.set("PtMeasureType", measureType || "Possessions");
  }
  return `${NBA_STATS_URL}/${endpoint}?${params}`;
}

function requestJson(url: string) {
  return new Promise<unknown>((resolve, reject) => {
    let statsRequest: ReturnType<typeof request>;
    const timeout = setTimeout(() => statsRequest.destroy(new Error(`NBA Stats timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
    statsRequest = request(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        Origin: "https://www.nba.com",
        Referer: "https://www.nba.com/stats/players/touches",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
        "x-nba-stats-origin": "stats",
        "x-nba-stats-token": "true"
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        clearTimeout(timeout);
        const body = Buffer.concat(chunks).toString("utf8");
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          reject(new Error(`NBA Stats returned ${response.statusCode} ${response.statusMessage}`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch { reject(new Error("NBA Stats returned invalid JSON")); }
      });
    });
    statsRequest.on("error", (error) => { clearTimeout(timeout); reject(error); });
    statsRequest.end();
  });
}

async function fetchJson(url: string) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestJson(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("NBA Stats request failed");
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw lastError || new Error("NBA Stats request failed");
}

async function metricWindow(season: string, metric: MetricName, lastNGames: 0 | 5 | 10) {
  const detail = METRIC_CONFIG[metric];
  const sourceUrl = requestUrl(detail.endpoint, season, lastNGames, detail.measure);
  return { sourceUrl, rows: resultRows(await fetchJson(sourceUrl), detail.column) };
}

async function possessionWindow(season: string, lastNGames: 0 | 5 | 10) {
  const detail = METRIC_CONFIG.touches;
  const sourceUrl = requestUrl(detail.endpoint, season, lastNGames, detail.measure);
  const payload = await fetchJson(sourceUrl);
  return { sourceUrl, touches: resultRows(payload, "TOUCHES"), timePossession: resultRows(payload, "TIME_OF_POSS") };
}

async function metricWindows(season: string, metric: MetricName): Promise<{ windows: TrackingWindows; sourceUrl: string }> {
  const windows = {} as TrackingWindows;
  let sourceUrl = "";
  const windowsToFetch = [0, 5, 10] as const;
  for (const [index, lastNGames] of windowsToFetch.entries()) {
    const result = await metricWindow(season, metric, lastNGames);
    sourceUrl ||= result.sourceUrl;
    windows[lastNGames] = new Map(result.rows.map((row) => [row.playerId, row]));
    if (index < windowsToFetch.length - 1) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }
  return { windows, sourceUrl };
}

async function possessionWindows(season: string) {
  const touches = {} as TrackingWindows;
  const timePossession = {} as TrackingWindows;
  let sourceUrl = "";
  const windowsToFetch = [0, 5, 10] as const;
  for (const [index, lastNGames] of windowsToFetch.entries()) {
    const result = await possessionWindow(season, lastNGames);
    sourceUrl ||= result.sourceUrl;
    touches[lastNGames] = new Map(result.touches.map((row) => [row.playerId, row]));
    timePossession[lastNGames] = new Map(result.timePossession.map((row) => [row.playerId, row]));
    if (index < windowsToFetch.length - 1) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }
  return { touches, timePossession, sourceUrl };
}

export async function probePlayerBallShareTracking(season = defaultBallShareSeason()) {
  const startedAt = Date.now();
  const usageRate = await metricWindow(season, "usageRate", 0);
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  const possessions = await possessionWindow(season, 0);
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  const potentialAssists = await metricWindow(season, "potentialAssists", 0);
  return {
    season,
    metrics: { usageRate: usageRate.rows.length, touches: possessions.touches.length, timePossession: possessions.timePossession.length, potentialAssists: potentialAssists.rows.length },
    durationMs: Date.now() - startedAt
  };
}

function valuesForPlayer(windows: MetricWindows, playerId: string) {
  const metric = (name: MetricName, window: 0 | 5 | 10) => windows[name][window].get(playerId)?.value ?? null;
  return {
    last5UsageRate: metric("usageRate", 5), last10UsageRate: metric("usageRate", 10), seasonUsageRate: metric("usageRate", 0),
    last5TimePossession: metric("timePossession", 5), last10TimePossession: metric("timePossession", 10), seasonTimePossession: metric("timePossession", 0),
    last5Touches: metric("touches", 5), last10Touches: metric("touches", 10), seasonTouches: metric("touches", 0),
    last5PotentialAssists: metric("potentialAssists", 5), last10PotentialAssists: metric("potentialAssists", 10), seasonPotentialAssists: metric("potentialAssists", 0)
  };
}

export function buildBallShareRows(officialPlayers: OfficialPlayer[], windows: MetricWindows, season: string, sourceUrl: string): BallShareSyncRow[] {
  const sourceTeam = (playerId: string) => windows.touches[0].get(playerId)?.team || windows.usageRate[0].get(playerId)?.team || "";
  return officialPlayers.map((player) => {
    const values = valuesForPlayer(windows, player.nbaPlayerId);
    const historicalTeam = sourceTeam(player.nbaPlayerId) || null;
    const gamesPlayed = windows.usageRate[0].get(player.nbaPlayerId)?.gamesPlayed || 0;
    const base = { nbaPlayerId: player.nbaPlayerId, playerName: player.playerName, normalizedPlayerName: normalizeTranslationName(player.playerName), currentTeam: player.team, sourceTeam: historicalTeam, season, gamesPlayed, ...values, sourceUrl };
    if (!historicalTeam && player.firstSeason !== null && player.firstSeason >= seasonStartYear(season)) {
      return { ...base, dataStatus: "ROOKIE" as const, unavailableReason: "该球员为新秀，所选赛季没有 NBA 官方 Tracking 数据。" };
    }
    if (!historicalTeam) {
      return { ...base, dataStatus: "NO_TRACKING_DATA" as const, unavailableReason: "NBA 官方没有提供该球员在所选赛季的完整 Tracking 数据。" };
    }
    if (historicalTeam !== player.team) {
      return { ...base, dataStatus: "TEAM_CHANGED" as const, unavailableReason: `该球员已转至 ${player.team}，所选赛季数据属于 ${historicalTeam}，不会以旧球队数据作为当前参考。` };
    }
    if (Object.values(values).some((value) => value === null)) {
      return { ...base, dataStatus: "NO_TRACKING_DATA" as const, unavailableReason: "NBA 官方没有提供该球员所需的完整 Tracking 指标。" };
    }
    return { ...base, dataStatus: "AVAILABLE" as const, unavailableReason: null };
  });
}

export async function syncPlayerBallShareOnce(prisma: PrismaClient, season = defaultBallShareSeason()) {
  const officialPlayers = await fetchOfficialPlayers();
  const usageRate = await metricWindows(season, "usageRate");
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  const possessions = await possessionWindows(season);
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  const potentialAssists = await metricWindows(season, "potentialAssists");
  const windows: MetricWindows = { usageRate: usageRate.windows, touches: possessions.touches, timePossession: possessions.timePossession, potentialAssists: potentialAssists.windows };
  const rows = buildBallShareRows(officialPlayers, windows, season, usageRate.sourceUrl);
  for (const chunk of Array.from({ length: Math.ceil(rows.length / 100) }, (_, index) => rows.slice(index * 100, index * 100 + 100))) {
    await prisma.$transaction(chunk.map((row) => prisma.playerBallShare.upsert({
      where: { nbaPlayerId_season: { nbaPlayerId: row.nbaPlayerId, season: row.season } },
      create: row,
      update: { ...row, syncedAt: new Date() }
    })));
  }
  return { season, total: rows.length, available: rows.filter((row) => row.dataStatus === "AVAILABLE").length, rookies: rows.filter((row) => row.dataStatus === "ROOKIE").length, teamChanged: rows.filter((row) => row.dataStatus === "TEAM_CHANGED").length, noTrackingData: rows.filter((row) => row.dataStatus === "NO_TRACKING_DATA").length };
}
