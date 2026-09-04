import { fantasyScore } from "./player-pricing";
import { usageRateForGames, type PlayerUsageGame } from "./player-usage";

const RECENT_GAMES = 5;
const BASELINE_GAMES = 10;
const MINIMUM_GAMES = RECENT_GAMES + BASELINE_GAMES;

export type PlayerIntelGame = PlayerUsageGame & {
  playerName: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  threesMade: number;
  fieldGoalsMade: number;
  freeThrowsMade: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  homeTeam: string;
  awayTeam: string;
};

export type ScheduledIntelGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
};

export type PlayerIntel = {
  nbaPlayerId: string;
  playerName: string;
  team: string;
  opponent: string;
  startTime: Date;
  roleChange: number;
  todayScore: number;
  tier: "S" | "A" | "B" | "C";
  recentFantasyPoints: number;
  minutesChange: number;
  usageChange: number;
  fieldGoalsAttemptedChange: number;
  assistsChange: number;
  matchupScore: number;
  paceScore: number;
};

type Candidate = Omit<PlayerIntel, "roleChange" | "todayScore" | "tier" | "matchupScore" | "paceScore"> & {
  roleRaw: number;
  strength: number;
  recentFormRaw: number;
  opponent: string;
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentageChange(recent: number, baseline: number) {
  if (baseline <= 0) return recent > 0 ? 1 : 0;
  return Math.max(-1, Math.min(1, recent / baseline - 1));
}

function percentileBy<T>(rows: T[], value: (row: T) => number) {
  const sorted = [...rows].sort((left, right) => value(left) - value(right));
  const scores = new Map<T, number>();
  if (sorted.length === 1) {
    scores.set(sorted[0], 50);
    return scores;
  }
  sorted.forEach((row, index) => scores.set(row, Math.round((index / (sorted.length - 1)) * 100)));
  return scores;
}

function fantasyPoints(game: PlayerIntelGame) {
  return fantasyScore(game);
}

function teamFromOpponentPerspective(game: PlayerIntelGame, team: string) {
  if (game.homeTeam === team) return game.awayTeam;
  if (game.awayTeam === team) return game.homeTeam;
  return null;
}

function teamGameKeys(rows: PlayerIntelGame[], team: string, limit = BASELINE_GAMES) {
  return [...new Map(
    rows
      .filter((row) => row.team === team)
      .sort((left, right) => right.gameDate.getTime() - left.gameDate.getTime())
      .map((row) => [row.gameId, row.gameDate])
  )].slice(0, limit).map(([gameId]) => gameId);
}

function teamPace(rows: PlayerIntelGame[], team: string) {
  const gameIds = new Set(teamGameKeys(rows, team));
  const possessions = new Map<string, number>();
  for (const row of rows) {
    if (row.team !== team || !gameIds.has(row.gameId)) continue;
    possessions.set(
      row.gameId,
      (possessions.get(row.gameId) || 0) + row.fieldGoalsAttempted + 0.44 * row.freeThrowsAttempted - row.offensiveRebounds + row.turnovers
    );
  }
  return average([...possessions.values()]);
}

function opponentFantasyAllowed(rows: PlayerIntelGame[], defenseTeam: string) {
  const gameIds = new Set(teamGameKeys(rows, defenseTeam));
  const opponentRows = rows.filter((row) => gameIds.has(row.gameId) && teamFromOpponentPerspective(row, row.team) === defenseTeam);
  const minutes = opponentRows.reduce((sum, row) => sum + row.minutes, 0);
  return minutes > 0 ? 36 * opponentRows.reduce((sum, row) => sum + fantasyPoints(row), 0) / minutes : 0;
}

function tier(score: number): PlayerIntel["tier"] {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 50) return "B";
  return "C";
}

export function buildPlayerIntel(rows: PlayerIntelGame[], scheduledGames: ScheduledIntelGame[]) {
  const scheduledByTeam = new Map<string, { opponent: string; startTime: Date }>();
  for (const game of scheduledGames) {
    scheduledByTeam.set(game.homeTeam, { opponent: game.awayTeam, startTime: game.startTime });
    scheduledByTeam.set(game.awayTeam, { opponent: game.homeTeam, startTime: game.startTime });
  }

  const currentPlayers = new Map<string, PlayerIntelGame[]>();
  for (const row of rows) {
    if (!scheduledByTeam.has(row.team)) continue;
    const playerRows = currentPlayers.get(row.nbaPlayerId) || [];
    playerRows.push(row);
    currentPlayers.set(row.nbaPlayerId, playerRows);
  }

  const candidates: Candidate[] = [];
  for (const [nbaPlayerId, playerRows] of currentPlayers) {
    const games = [...playerRows].sort((left, right) => right.gameDate.getTime() - left.gameDate.getTime());
    if (games.length < MINIMUM_GAMES) continue;
    const recent = games.slice(0, RECENT_GAMES);
    const baseline = games.slice(RECENT_GAMES, MINIMUM_GAMES);
    const team = games[0].team;
    const matchup = scheduledByTeam.get(team);
    if (!matchup) continue;

    const minutesChange = percentageChange(average(recent.map((row) => row.minutes)), average(baseline.map((row) => row.minutes)));
    const usageChange = percentageChange(usageRateForGames(rows, recent) || 0, usageRateForGames(rows, baseline) || 0);
    const fieldGoalsAttemptedChange = percentageChange(
      average(recent.map((row) => row.fieldGoalsAttempted)),
      average(baseline.map((row) => row.fieldGoalsAttempted))
    );
    const assistsChange = percentageChange(average(recent.map((row) => row.assists)), average(baseline.map((row) => row.assists)));
    const roleRaw = 0.4 * minutesChange + 0.3 * usageChange + 0.2 * fieldGoalsAttemptedChange + 0.1 * assistsChange;
    const seasonFantasyPoints = average(games.map(fantasyPoints));
    const recentFantasyPoints = average(recent.map(fantasyPoints));

    candidates.push({
      nbaPlayerId,
      playerName: games[0].playerName,
      team,
      opponent: matchup.opponent,
      startTime: matchup.startTime,
      roleRaw,
      strength: seasonFantasyPoints,
      recentFormRaw: recentFantasyPoints - seasonFantasyPoints,
      recentFantasyPoints,
      minutesChange,
      usageChange,
      fieldGoalsAttemptedChange,
      assistsChange
    });
  }

  const roleScores = percentileBy(candidates, (row) => row.roleRaw);
  const strengthScores = percentileBy(candidates, (row) => row.strength);
  const recentFormScores = percentileBy(candidates, (row) => row.recentFormRaw);
  const matchupScores = percentileBy(candidates, (row) => opponentFantasyAllowed(rows, row.opponent));
  const matchupPaces = new Map(candidates.map((row) => [row, average([teamPace(rows, row.team), teamPace(rows, row.opponent)])]));
  const paceScores = percentileBy(candidates, (row) => matchupPaces.get(row) || 0);

  return candidates.map((row) => {
    const roleChange = roleScores.get(row) || 0;
    const matchupScore = matchupScores.get(row) || 0;
    const paceScore = paceScores.get(row) || 0;
    const todayScore = Math.round(
      0.35 * (strengthScores.get(row) || 0) +
      0.25 * (recentFormScores.get(row) || 0) +
      0.2 * roleChange +
      0.1 * matchupScore +
      0.1 * paceScore
    );
    return { ...row, roleChange, matchupScore, paceScore, todayScore, tier: tier(todayScore) };
  });
}

export const PLAYER_INTEL_MINIMUM_GAMES = MINIMUM_GAMES;
