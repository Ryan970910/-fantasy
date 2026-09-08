import { prisma } from "@/lib/prisma";
import { buildPlayerIntel, type PlayerIntelGame, type ScheduledIntelGame } from "@/lib/player-intel";
import { loadPlayerNameTranslations, translatePlayerName } from "@/lib/player-name-translations";
import { loadTeamNameTranslations } from "@/lib/team-name-translations";

type GameRow = ScheduledIntelGame;

function currentSeason(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export async function loadPlayerIntelDashboard() {
  const upcoming = await prisma.$queryRawUnsafe<GameRow[]>(
    `SELECT "id", "homeTeam", "awayTeam", "startTime"
     FROM "Game"
     WHERE "status" = 'not_started'
       AND "startTime" >= now() AT TIME ZONE 'Asia/Shanghai'
     ORDER BY "startTime" ASC
     LIMIT 50`
  );
  if (!upcoming.length) {
    return { state: "no-games" as const, players: [], gameCount: 0 };
  }

  const firstStart = upcoming[0].startTime.getTime();
  const scheduledGames = upcoming.filter((game) => game.startTime.getTime() - firstStart < 12 * 60 * 60 * 1000);
  const season = currentSeason();
  const rows = await prisma.$queryRawUnsafe<PlayerIntelGame[]>(
    `SELECT
       p."gameId", p."nbaPlayerId", p."playerName", p."team", p."gameDate", p."minutes",
       p."points", p."rebounds", p."assists", p."steals", p."blocks", p."turnovers", p."threesMade",
       p."fieldGoalsMade", p."fieldGoalsAttempted", p."freeThrowsMade", p."freeThrowsAttempted",
       p."offensiveRebounds", p."defensiveRebounds", g."homeTeam", g."awayTeam"
     FROM "PlayerGameStats" p
     INNER JOIN "Game" g ON g."id" = p."gameId"
     WHERE p."season" = $1`,
    season
  );
  if (!rows.length) {
    return { state: "no-stats" as const, players: [], gameCount: scheduledGames.length };
  }

  const [translations, teamTranslations] = await Promise.all([
    loadPlayerNameTranslations(prisma),
    loadTeamNameTranslations(prisma)
  ]);
  const players = buildPlayerIntel(rows, scheduledGames).map((player) => ({
    ...player,
    englishName: player.playerName,
    playerName: translatePlayerName(player.playerName, translations),
    opponentName: teamTranslations[player.opponent] || player.opponent
  }));

  return {
    state: players.length ? "ready" as const : "insufficient-sample" as const,
    players,
    gameCount: scheduledGames.length
  };
}
