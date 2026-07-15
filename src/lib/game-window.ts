type GameForWindow = {
  status?: number;
  startTimeUTC?: string;
  homeTeam?: { tricode?: string };
  awayTeam?: { tricode?: string };
};

export function nbaGameDate(offsetDays = 0, now = Date.now()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function gameHasStarted(game: GameForWindow, now = Date.now()) {
  if (game.status === 2 || game.status === 3) {
    return true;
  }
  if (game.status === 1) {
    return false;
  }

  const startTime = Date.parse(game.startTimeUTC || "");
  return Number.isFinite(startTime) && startTime <= now;
}

export function allGamesStarted(games: GameForWindow[], now = Date.now()) {
  return games.length > 0 && games.every((game) => gameHasStarted(game, now));
}

export function lockedTeamCodes(games: GameForWindow[], now = Date.now()) {
  return new Set(
    games
      .filter((game) => gameHasStarted(game, now))
      .flatMap((game) => [game.homeTeam?.tricode, game.awayTeam?.tricode])
      .filter((team): team is string => Boolean(team))
  );
}
