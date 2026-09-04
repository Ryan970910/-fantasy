export type PlayerUsageGame = {
  gameId: string;
  nbaPlayerId: string;
  team: string;
  gameDate: Date;
  minutes: number;
  fieldGoalsAttempted: number;
  freeThrowsAttempted: number;
  turnovers: number;
};

export type RecentUsage = { rate: number; games: number };

export function recentUsageRates(rows: PlayerUsageGame[], playerIds: string[], maxGames = 10) {
  const teamTotals = new Map<string, { minutes: number; possessions: number }>();
  const playerGames = new Map<string, PlayerUsageGame[]>();
  const requested = new Set(playerIds);

  for (const row of rows) {
    const teamGame = `${row.gameId}:${row.team}`;
    const total = teamTotals.get(teamGame) || { minutes: 0, possessions: 0 };
    total.minutes += row.minutes;
    total.possessions += row.fieldGoalsAttempted + 0.44 * row.freeThrowsAttempted + row.turnovers;
    teamTotals.set(teamGame, total);

    if (requested.has(row.nbaPlayerId)) {
      const games = playerGames.get(row.nbaPlayerId) || [];
      games.push(row);
      playerGames.set(row.nbaPlayerId, games);
    }
  }

  return new Map(Array.from(playerGames, ([playerId, games]) => {
    let numerator = 0;
    let denominator = 0;
    const recentGames = games.sort((left, right) => right.gameDate.getTime() - left.gameDate.getTime()).slice(0, maxGames);
    for (const game of recentGames) {
      const team = teamTotals.get(`${game.gameId}:${game.team}`);
      if (!team || game.minutes <= 0 || team.possessions <= 0) {
        continue;
      }

      numerator += (game.fieldGoalsAttempted + 0.44 * game.freeThrowsAttempted + game.turnovers) * (team.minutes / 5);
      denominator += game.minutes * team.possessions;
    }

    return [playerId, denominator > 0 ? { rate: 100 * numerator / denominator, games: recentGames.length } : null] as const;
  }));
}
