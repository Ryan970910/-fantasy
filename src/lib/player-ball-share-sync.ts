import { normalizeTranslationName } from "./player-name-translations";
import type { OfficialPlayer } from "./player-position-sync";

const NBA_TRACKING_SOURCE_URL = "https://www.nba.com/stats/players/advanced";

type MetricName = "usageRate" | "timePossession" | "touches" | "potentialAssists";
export type TrackingRow = { playerId: string; playerName: string; team: string; gamesPlayed: number; value: number };
export type TrackingWindows = Record<0 | 5 | 10, Map<string, TrackingRow>>;
export type MetricWindows = Record<MetricName, TrackingWindows>;

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

function trackingRow(value: unknown): TrackingRow {
  const row = value as Partial<TrackingRow>;
  const playerId = String(row.playerId || "");
  const playerName = String(row.playerName || "");
  if (!playerId || !playerName) throw new Error("nba_api returned a tracking row without a player identity");
  return { playerId, playerName, team: String(row.team || ""), gamesPlayed: Math.trunc(numberValue(row.gamesPlayed)), value: numberValue(row.value) };
}

type PythonPayload = {
  season: string;
  sourceUrl?: string;
  metrics: Partial<Record<MetricName, Partial<Record<"0" | "5" | "10", unknown[]>>>>;
};

export function parsePythonBallSharePayload(value: unknown): { season: string; sourceUrl: string; windows: MetricWindows } {
  const payload = value as PythonPayload;
  if (!payload.season || !payload.metrics) throw new Error("nba_api collector returned an invalid payload");
  const windows = {} as MetricWindows;
  for (const metric of ["usageRate", "timePossession", "touches", "potentialAssists"] as const) {
    const metricWindows = payload.metrics[metric];
    if (!metricWindows) throw new Error(`nba_api collector did not return ${metric}`);
    windows[metric] = {} as TrackingWindows;
    for (const window of [0, 5, 10] as const) {
      const rows = metricWindows[String(window) as "0" | "5" | "10"];
      if (!Array.isArray(rows)) throw new Error(`nba_api collector did not return ${metric} for the last ${window} games`);
      windows[metric][window] = new Map(rows.map(trackingRow).map((row) => [row.playerId, row]));
    }
  }
  return { season: payload.season, sourceUrl: payload.sourceUrl || NBA_TRACKING_SOURCE_URL, windows };
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
