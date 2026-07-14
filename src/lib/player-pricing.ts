export const MIN_PLAYER_SALARY = 10;
export const MAX_PLAYER_SALARY = 60;

const ELITE_FANTASY_SCORE = 45;
const SALARY_CURVE_EXPONENT = 1.05;
const STABLE_SAMPLE_GAMES = 20;
const NEW_PLAYER_BASELINE_SCORE = 15;

export type FantasyStats = {
  gamesPlayed?: unknown;
  points?: unknown;
  rebounds?: unknown;
  assists?: unknown;
  steals?: unknown;
  blocks?: unknown;
  turnovers?: unknown;
  threesMade?: unknown;
  fieldGoalsMade?: unknown;
  fieldGoalsAttempted?: unknown;
  freeThrowsMade?: unknown;
  freeThrowsAttempted?: unknown;
  offensiveRebounds?: unknown;
  defensiveRebounds?: unknown;
};

type PlayerStatsRow = FantasyStats & {
  nbaPlayerId: string;
  season: string;
};

function numberOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function fantasyScore(stats: FantasyStats) {
  const missedFieldGoals = Math.max(0, numberOrZero(stats.fieldGoalsAttempted) - numberOrZero(stats.fieldGoalsMade));
  const missedFreeThrows = Math.max(0, numberOrZero(stats.freeThrowsAttempted) - numberOrZero(stats.freeThrowsMade));

  return (
    numberOrZero(stats.points) +
    numberOrZero(stats.threesMade) * 0.5 +
    numberOrZero(stats.fieldGoalsMade) * 0.4 -
    missedFieldGoals +
    numberOrZero(stats.freeThrowsMade) * 0.2 -
    missedFreeThrows * 0.5 +
    numberOrZero(stats.offensiveRebounds) +
    numberOrZero(stats.defensiveRebounds) * 0.7 +
    numberOrZero(stats.assists) * 1.5 +
    numberOrZero(stats.steals) * 2 +
    numberOrZero(stats.blocks) * 1.8 -
    numberOrZero(stats.turnovers)
  );
}

function hasDetailedFantasyStats(stats: FantasyStats) {
  return [
    stats.threesMade,
    stats.fieldGoalsMade,
    stats.fieldGoalsAttempted,
    stats.freeThrowsMade,
    stats.freeThrowsAttempted,
    stats.offensiveRebounds,
    stats.defensiveRebounds
  ].some((value) => numberOrZero(value) > 0);
}

export function isOfficialNbaPlayerId(value: string) {
  return /^\d+$/.test(value);
}

function compareStatsRows<T extends PlayerStatsRow>(left: T, right: T) {
  const officialDifference = Number(isOfficialNbaPlayerId(right.nbaPlayerId)) - Number(isOfficialNbaPlayerId(left.nbaPlayerId));
  if (officialDifference !== 0) {
    return officialDifference;
  }

  const detailDifference = Number(hasDetailedFantasyStats(right)) - Number(hasDetailedFantasyStats(left));
  if (detailDifference !== 0) {
    return detailDifference;
  }

  return numberOrZero(right.gamesPlayed) - numberOrZero(left.gamesPlayed);
}

function selectSeasonStats<T extends PlayerStatsRow>(rows: T[], season: string, requireGames: boolean) {
  return rows
    .filter((row) => row.season === season && (!requireGames || numberOrZero(row.gamesPlayed) > 0))
    .sort(compareStatsRows)[0] || null;
}

export function selectDisplayStats<T extends PlayerStatsRow>(rows: T[], currentSeason: string, previousSeason: string) {
  return (
    selectSeasonStats(rows, currentSeason, true) ||
    selectSeasonStats(rows, previousSeason, true) ||
    selectSeasonStats(rows, currentSeason, false) ||
    selectSeasonStats(rows, previousSeason, false)
  );
}

export function selectPricingStats<T extends PlayerStatsRow>(rows: T[], currentSeason: string, previousSeason: string) {
  const current = selectSeasonStats(rows, currentSeason, true);
  const previous = selectSeasonStats(rows, previousSeason, true);

  if (current) {
    return { current, previous };
  }
  if (previous) {
    return { current: previous, previous: null };
  }
  return null;
}

export function stableFantasyScore(currentStats: FantasyStats, previousStats?: FantasyStats | null) {
  const gamesPlayed = Math.max(0, numberOrZero(currentStats.gamesPlayed));
  const currentWeight = Math.min(gamesPlayed / STABLE_SAMPLE_GAMES, 1);
  const baselineScore = previousStats ? fantasyScore(previousStats) : NEW_PLAYER_BASELINE_SCORE;

  return fantasyScore(currentStats) * currentWeight + baselineScore * (1 - currentWeight);
}

export function playerSalary(currentStats: FantasyStats, previousStats?: FantasyStats | null) {
  const expectedFantasyScore = Math.max(0, stableFantasyScore(currentStats, previousStats));
  const rawSalary = Math.round(
    MAX_PLAYER_SALARY * Math.pow(expectedFantasyScore / ELITE_FANTASY_SCORE, SALARY_CURVE_EXPONENT)
  );

  return clamp(rawSalary, MIN_PLAYER_SALARY, MAX_PLAYER_SALARY);
}
