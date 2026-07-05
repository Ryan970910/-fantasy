import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const NBA_GAMES_URL = "https://www.nba.com/games";
const NBA_PLAYER_INDEX_URL = "https://cdn.nba.com/static/json/staticData/playerIndex.json";
const BBR_PER_GAME_URL = "https://www.basketball-reference.com/leagues/NBA_{year}_per_game.html";
const REQUEST_TIMEOUT_MS = 8000;
const SEASON_TYPE = "Regular Season";

type NbaGameCard = {
  cardData?: {
    gameId?: string;
    leagueId?: string;
    cardHat?: string;
    seasonType?: string;
    gameStatus?: number;
    gameStatusText?: string;
    gameTimeUtc?: string;
    homeTeam?: {
      teamId?: number;
      teamName?: string;
      teamTricode?: string;
    };
    awayTeam?: {
      teamId?: number;
      teamName?: string;
      teamTricode?: string;
    };
  };
};

type GameSummary = {
  gameId: string;
  eventName: string;
  status: number;
  statusText: string;
  startTimeUTC: string;
  homeTeam: { id: number; name: string; tricode: string };
  awayTeam: { id: number; name: string; tricode: string };
};

type GameDay = {
  sourceUrl: string;
  gameDate: string;
  games: GameSummary[];
};

type SelectedGameDay = GameDay & {
  poolGames: GameSummary[];
  poolMode: "future-scheduled" | "scheduled" | "all-games";
};

type AverageStatsRow = {
  nbaPlayerId: string;
  playerName: string;
  team: string;
  season: string;
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
  source: string;
  sourceUrl: string;
};

type FallbackPoolPlayer = {
  id: string;
  name: string;
  slug: string;
  team: string;
  teamName: string;
  jersey: string;
  position: string;
  height: string;
  eligibleSlots: string[];
  stats: AverageStatsRow;
};

type PlayerIndexRow = [
  number,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number | string,
  number | string,
  number | string,
  number,
  string,
  string,
  number | null,
  number | null,
  number | null,
  string
];

const slotEligibility = {
  PG: ["G", "PG"],
  SG: ["G", "SG"],
  SF: ["F", "SF"],
  PF: ["F", "PF"],
  C: ["C"]
} as const;

function selectionDate(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://www.nba.com",
        Referer: "https://www.nba.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string) {
  return JSON.parse(await fetchText(url));
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

function extractNextData(html: string) {
  const nameIndex = html.indexOf("__NEXT_DATA__");
  const scriptStart = html.lastIndexOf("<script", nameIndex);
  const jsonStart = html.indexOf(">", scriptStart) + 1;
  const jsonEnd = html.indexOf("</script>", jsonStart);

  if (nameIndex < 0 || scriptStart < 0 || jsonStart <= 0 || jsonEnd < 0) {
    throw new Error("NBA.com games page did not include __NEXT_DATA__");
  }

  return JSON.parse(html.slice(jsonStart, jsonEnd));
}

function normalizeGameCards(cards: NbaGameCard[]) {
  return cards.flatMap((card): GameSummary[] => {
    const game = card.cardData;
    if (!game?.gameId || !game.homeTeam || !game.awayTeam) {
      return [];
    }

    return [{
      gameId: game.gameId,
      eventName: game.cardHat || game.seasonType || "NBA",
      status: game.gameStatus ?? 0,
      statusText: game.gameStatusText || "Scheduled",
      startTimeUTC: game.gameTimeUtc || "",
      homeTeam: {
        id: game.homeTeam.teamId ?? 0,
        name: game.homeTeam.teamName || game.homeTeam.teamTricode || "TBD",
        tricode: game.homeTeam.teamTricode || ""
      },
      awayTeam: {
        id: game.awayTeam.teamId ?? 0,
        name: game.awayTeam.teamName || game.awayTeam.teamTricode || "TBD",
        tricode: game.awayTeam.teamTricode || ""
      }
    }];
  });
}

async function fetchGamesPage(date: string): Promise<GameDay> {
  const url = `${NBA_GAMES_URL}?date=${date}`;
  const html = await fetchText(url);
  const data = extractNextData(html);
  const cards: NbaGameCard[] = data.props?.pageProps?.gameCardFeed?.modules?.flatMap((module: { cards?: NbaGameCard[] }) => module.cards || []) || [];
  return {
    sourceUrl: url,
    gameDate: data.props?.pageProps?.selectedDate || date,
    games: normalizeGameCards(cards)
  };
}

function futureScheduledGames(result: GameDay, now: number) {
  return result.games.filter((game) => game.status === 1 && Date.parse(game.startTimeUTC) >= now);
}

function scheduledGames(result: GameDay) {
  return result.games.filter((game) => game.status === 1);
}

function chooseNextGameDay(results: GameDay[]): SelectedGameDay | null {
  const now = Date.now();
  const futureResult = results.find((result) => futureScheduledGames(result, now).length > 0);
  if (futureResult) {
    return { ...futureResult, poolGames: futureScheduledGames(futureResult, now), poolMode: "future-scheduled" };
  }

  const scheduledResult = results.find((result) => scheduledGames(result).length > 0);
  if (scheduledResult) {
    return { ...scheduledResult, poolGames: scheduledGames(scheduledResult), poolMode: "scheduled" };
  }

  const anyResult = results.find((result) => result.games.length > 0);
  if (anyResult) {
    return { ...anyResult, poolGames: anyResult.games, poolMode: "all-games" };
  }

  return null;
}

function eligibleSlots(position: string) {
  const normalized = position.toUpperCase();
  return Object.entries(slotEligibility)
    .filter(([, tokens]) => tokens.some((token) => normalized.includes(token)))
    .map(([slot]) => slot);
}

function seasonLabel(startYear: number) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function bbrYearFromSeason(season: string) {
  return Number(`20${season.slice(-2)}`);
}

function defaultStatSeasons() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentStartYear = month >= 10 ? year : year - 1;
  return {
    current: seasonLabel(currentStartYear),
    previous: seasonLabel(currentStartYear - 1)
  };
}

function numberOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function hasDetailedFantasyStats(row: AverageStatsRow) {
  return [
    row.threesMade,
    row.fieldGoalsMade,
    row.fieldGoalsAttempted,
    row.freeThrowsMade,
    row.freeThrowsAttempted,
    row.offensiveRebounds,
    row.defensiveRebounds
  ].some((value) => numberOrZero(value) > 0);
}

function isOfficialNbaPlayerId(value: string) {
  return /^\d+$/.test(value);
}

function compareStatsRows(left: AverageStatsRow, right: AverageStatsRow) {
  const leftDetailed = hasDetailedFantasyStats(left) ? 1 : 0;
  const rightDetailed = hasDetailedFantasyStats(right) ? 1 : 0;
  if (leftDetailed !== rightDetailed) {
    return rightDetailed - leftDetailed;
  }

  const leftOfficial = isOfficialNbaPlayerId(left.nbaPlayerId) ? 1 : 0;
  const rightOfficial = isOfficialNbaPlayerId(right.nbaPlayerId) ? 1 : 0;
  if (leftOfficial !== rightOfficial) {
    return rightOfficial - leftOfficial;
  }

  return numberOrZero(right.gamesPlayed) - numberOrZero(left.gamesPlayed);
}

function choosePreferredStatsRow(rows: AverageStatsRow[], currentSeason: string, previousSeason: string) {
  const pick = (season: string, requireGames: boolean) =>
    rows
      .filter((row) => row.season === season && (!requireGames || numberOrZero(row.gamesPlayed) > 0))
      .sort(compareStatsRows)[0] || null;

  return (
    pick(currentSeason, true) ||
    pick(previousSeason, true) ||
    pick(currentSeason, false) ||
    pick(previousSeason, false)
  );
}

function canonicalPlayerId(rows: AverageStatsRow[], selected: AverageStatsRow) {
  return (
    rows.find((row) => row.season === selected.season && isOfficialNbaPlayerId(row.nbaPlayerId))?.nbaPlayerId ||
    rows.find((row) => isOfficialNbaPlayerId(row.nbaPlayerId))?.nbaPlayerId ||
    selected.nbaPlayerId
  );
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
  const teamMap: Record<string, string> = {
    BRK: "BKN",
    CHO: "CHA",
    NOH: "NOP",
    NOK: "NOP",
    PHO: "PHX"
  };
  return teamMap[value] || value;
}

async function loadFallbackPositions(teamTricodes: Set<string>, currentSeason: string, previousSeason: string) {
  const positions = new Map<string, string>();

  for (const season of [currentSeason, previousSeason]) {
    try {
      const html = await fetchText(BBR_PER_GAME_URL.replace("{year}", String(bbrYearFromSeason(season))));
      for (const match of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const rowHtml = match[1];
        const playerName = extractAnyCell(rowHtml, ["name_display", "player"]);
        const team = normalizeTeam(extractAnyCell(rowHtml, ["team_name_abbr", "team_id"]));
        const position = extractAnyCell(rowHtml, ["pos"]);
        if (!playerName || playerName === "Player" || !teamTricodes.has(team) || !position) {
          continue;
        }

        const key = `${normalizeName(playerName)}:${team}`;
        if (!positions.has(key)) {
          positions.set(key, position);
        }
      }
    } catch (error) {
      console.error(`Fallback position lookup failed for ${season}`, error);
    }
  }

  return positions;
}

function gameStarted(game: GameSummary, now = Date.now()) {
  const startTime = Date.parse(game.startTimeUTC);
  return game.status !== 1 || (Number.isFinite(startTime) && startTime <= now);
}

function buildLockStatus(games: GameSummary[]) {
  const now = Date.now();
  const validStartTimes = games
    .map((game) => Date.parse(game.startTimeUTC))
    .filter((time) => Number.isFinite(time));
  const firstGameStartTime = validStartTimes.length > 0 ? Math.min(...validStartTimes) : null;
  const firstGameStarted = games.some((game) => gameStarted(game, now)) ||
    (firstGameStartTime !== null && firstGameStartTime <= now);
  const lockedTeams = new Set(
    games
      .filter((game) => gameStarted(game, now))
      .flatMap((game) => [game.homeTeam.tricode, game.awayTeam.tricode])
      .filter(Boolean)
  );

  return {
    lockedAt: new Date(now).toISOString(),
    firstGameStartTimeUTC: firstGameStartTime === null ? null : new Date(firstGameStartTime).toISOString(),
    firstGameStarted,
    lockedTeams: Array.from(lockedTeams).sort()
  };
}

async function loadAverageStats(players: Array<{ id: string; name: string; team: string }>, currentSeason: string, previousSeason: string) {
  if (players.length === 0) {
    return new Map<string, AverageStatsRow>();
  }

  try {
    const rows = await prisma.$queryRawUnsafe<AverageStatsRow[]>(
      `SELECT
         "nbaPlayerId", "season", "gamesPlayed", "minutes", "points", "rebounds", "assists", "steals",
         "blocks", "turnovers", "threesMade", "fieldGoalsMade", "fieldGoalsAttempted",
         "freeThrowsMade", "freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds",
         "source", "sourceUrl", "playerName", "team"
       FROM "PlayerAverageStats"
       WHERE "seasonType" = $1
         AND "season" IN ($2, $3)`,
      SEASON_TYPE,
      currentSeason,
      previousSeason
    );

    const byPlayerId = new Map<string, AverageStatsRow[]>();
    const byPlayerNameAndTeam = new Map<string, AverageStatsRow[]>();
    for (const row of rows) {
      const idRows = byPlayerId.get(row.nbaPlayerId) || [];
      idRows.push(row);
      byPlayerId.set(row.nbaPlayerId, idRows);

      const nameKey = `${normalizeName((row as AverageStatsRow & { playerName?: string }).playerName || "")}:${row.team}`;
      const nameRows = byPlayerNameAndTeam.get(nameKey) || [];
      nameRows.push(row);
      byPlayerNameAndTeam.set(nameKey, nameRows);
    }

    return new Map(players.flatMap((player) => {
        const idRows = byPlayerId.get(player.id) || [];
        const nameRows = byPlayerNameAndTeam.get(`${normalizeName(player.name)}:${player.team}`) || [];
        const rowKeys = new Set<string>();
        const playerRows = [...idRows, ...nameRows].filter((row) => {
          const key = `${row.nbaPlayerId}:${row.season}:${row.team}`;
          if (rowKeys.has(key)) {
            return false;
          }
          rowKeys.add(key);
          return true;
        });
        const selected = choosePreferredStatsRow(playerRows, currentSeason, previousSeason);
        return selected ? [[player.id, selected]] : [];
      }));
  } catch (error) {
    console.error("Player average stats lookup failed", error);
    return new Map<string, AverageStatsRow>();
  }
}

async function loadFallbackPoolPlayers(teamTricodes: Set<string>, currentSeason: string, previousSeason: string) {
  if (teamTricodes.size === 0) {
    return [] as FallbackPoolPlayer[];
  }

  const rows = await prisma.$queryRawUnsafe<AverageStatsRow[]>(
    `SELECT
       "nbaPlayerId", "season", "gamesPlayed", "minutes", "points", "rebounds", "assists", "steals",
       "blocks", "turnovers", "threesMade", "fieldGoalsMade", "fieldGoalsAttempted",
       "freeThrowsMade", "freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds",
       "source", "sourceUrl", "playerName", "team"
     FROM "PlayerAverageStats"
     WHERE "seasonType" = $1
       AND "season" IN ($2, $3)
       AND "team" = ANY($4::text[])`,
    SEASON_TYPE,
    currentSeason,
    previousSeason,
    Array.from(teamTricodes)
  );

  const byNameAndTeam = new Map<string, AverageStatsRow[]>();
  for (const row of rows) {
    const key = `${normalizeName(row.playerName)}:${row.team}`;
    const existing = byNameAndTeam.get(key) || [];
    existing.push(row);
    byNameAndTeam.set(key, existing);
  }

  const fallbackPositions = await loadFallbackPositions(teamTricodes, currentSeason, previousSeason);

  return Array.from(byNameAndTeam.values()).flatMap((playerRows): FallbackPoolPlayer[] => {
    const selected = choosePreferredStatsRow(playerRows, currentSeason, previousSeason);
    if (!selected) {
      return [];
    }
    const position = fallbackPositions.get(`${normalizeName(selected.playerName)}:${selected.team}`) || "";
    const slots = eligibleSlots(position);
    if (!slots.length) {
      return [];
    }

    return [{
      id: canonicalPlayerId(playerRows, selected),
      name: selected.playerName,
      slug: normalizeName(selected.playerName).replace(/\s+/g, "-"),
      team: selected.team,
      teamName: selected.team,
      jersey: "",
      position,
      height: "",
      eligibleSlots: slots,
      stats: selected
    }];
  }).sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
}

export async function GET() {
  const errors: string[] = [];
  const dates = Array.from(new Set([selectionDate(1), selectionDate(2), selectionDate(3), selectionDate(4)]));
  const gameResults: GameDay[] = [];

  for (const date of dates) {
    try {
      const result = await fetchGamesPage(date);
      if (result.games.length > 0) {
        gameResults.push(result);
      }
    } catch (error) {
      errors.push(`NBA.com games page ${date}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const selectedGameDay = chooseNextGameDay(gameResults);
  if (!selectedGameDay) {
    return NextResponse.json(
      {
        source: "NBA official APIs",
        fetchedAt: new Date().toISOString(),
        error: ["No upcoming NBA game day found", ...errors].join("; "),
        gameDate: null,
        games: [],
        poolGames: [],
        poolMode: null,
        teams: [],
        players: []
      },
      { status: 502 }
    );
  }

  try {
    const statSeasons = defaultStatSeasons();
    const candidateTeamTricodes = new Set(
      selectedGameDay.poolGames.flatMap((game) => [game.homeTeam.tricode, game.awayTeam.tricode]).filter(Boolean)
    );
    let rows: PlayerIndexRow[] = [];
    let playersSourceUrl = NBA_PLAYER_INDEX_URL;
    let playersSource = "NBA.com official games page + NBA official playerIndex";
    const notes: string[] = [
      ...errors,
      "Player pool teams are taken only from the selected next game day games.",
      "NBA.com games cards do not publish full scheduled Summer League rosters before tipoff, so players are pulled from the official NBA playerIndex for those teams.",
      `Per-game stats prefer ${statSeasons.current} ${SEASON_TYPE}; if unavailable, they fall back to ${statSeasons.previous} ${SEASON_TYPE}.`
    ];

    try {
      const playerIndex = await fetchJson(NBA_PLAYER_INDEX_URL);
      rows = playerIndex.resultSets?.[0]?.rowSet || [];
    } catch (error) {
      const fallbackPlayers = await loadFallbackPoolPlayers(candidateTeamTricodes, statSeasons.current, statSeasons.previous);
      rows = [];
      playersSourceUrl = "PlayerAverageStats";
      playersSource = "NBA.com official games page + PlayerAverageStats fallback";
      notes.push(`NBA playerIndex unavailable (${error instanceof Error ? error.message : "unknown error"}); using PlayerAverageStats fallback.`);

      if (fallbackPlayers.length > 0) {
        const lockStatus = buildLockStatus(selectedGameDay.games);
        const lockedTeams = new Set(lockStatus.lockedTeams);
        const players = fallbackPlayers.map((player) => ({
          ...player,
          locked: lockedTeams.has(player.team),
          lockReason: lockedTeams.has(player.team) ? "Team game has started" : null,
          stats: {
            season: player.stats.season,
            gamesPlayed: numberOrZero(player.stats.gamesPlayed),
            minutes: numberOrZero(player.stats.minutes),
            points: numberOrZero(player.stats.points),
            rebounds: numberOrZero(player.stats.rebounds),
            assists: numberOrZero(player.stats.assists),
            steals: numberOrZero(player.stats.steals),
            blocks: numberOrZero(player.stats.blocks),
            turnovers: numberOrZero(player.stats.turnovers),
            threesMade: numberOrZero(player.stats.threesMade),
            fieldGoalsMade: numberOrZero(player.stats.fieldGoalsMade),
            fieldGoalsAttempted: numberOrZero(player.stats.fieldGoalsAttempted),
            freeThrowsMade: numberOrZero(player.stats.freeThrowsMade),
            freeThrowsAttempted: numberOrZero(player.stats.freeThrowsAttempted),
            offensiveRebounds: numberOrZero(player.stats.offensiveRebounds),
            defensiveRebounds: numberOrZero(player.stats.defensiveRebounds),
            source: player.stats.source,
            sourceUrl: player.stats.sourceUrl
          }
        }));
        const fallbackTeams = new Set(players.map((player) => player.team));
        const rosterReadyGames = selectedGameDay.poolGames.filter(
          (game) => fallbackTeams.has(game.homeTeam.tricode) && fallbackTeams.has(game.awayTeam.tricode)
        );
        const ignoredGames = selectedGameDay.poolGames.filter(
          (game) => !fallbackTeams.has(game.homeTeam.tricode) || !fallbackTeams.has(game.awayTeam.tricode)
        );

        return NextResponse.json({
          source: playersSource,
          gamesSourceUrl: selectedGameDay.sourceUrl,
          playersSourceUrl,
          fetchedAt: new Date().toISOString(),
          gameDate: selectedGameDay.gameDate,
          games: rosterReadyGames,
          allGamesOnDate: selectedGameDay.games,
          ignoredGames,
          poolMode: selectedGameDay.poolMode,
          statSeasons,
          lockStatus,
          teams: Array.from(fallbackTeams).sort(),
          players,
          notes: [
            ...notes,
            ...(
              ignoredGames.length > 0
                ? [`Ignored games without fallback player stats: ${ignoredGames.map((game) => `${game.awayTeam.tricode}@${game.homeTeam.tricode}`).join(", ")}.`]
                : []
            )
          ]
        });
      }

      throw error;
    }

    const candidatePlayers = rows
      .filter((row) => row[19] === 1)
      .filter((row) => candidateTeamTricodes.has(row[9]))
      .map((row) => {
        const position = row[11] || "";
        return {
          id: String(row[0]),
          name: `${row[2]} ${row[1]}`,
          slug: row[3],
          team: row[9],
          teamName: `${row[7]} ${row[8]}`.trim(),
          jersey: row[10] || "",
          position,
          height: row[12] || "",
          eligibleSlots: eligibleSlots(position),
          stats: {
            season: "playerIndex",
            gamesPlayed: 0,
            minutes: 0,
            points: row[22] ?? null,
            rebounds: row[23] ?? null,
            assists: row[24] ?? null,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            threesMade: 0,
            fieldGoalsMade: 0,
            fieldGoalsAttempted: 0,
            freeThrowsMade: 0,
            freeThrowsAttempted: 0,
            offensiveRebounds: 0,
            defensiveRebounds: row[23] ?? 0,
            source: "NBA official playerIndex fallback",
            sourceUrl: NBA_PLAYER_INDEX_URL
          }
        };
      })
      .filter((player) => player.eligibleSlots.length > 0)
      .sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

    const teamsWithPlayers = new Set(candidatePlayers.map((player) => player.team));
    const rosterReadyGames = selectedGameDay.poolGames.filter(
      (game) => teamsWithPlayers.has(game.homeTeam.tricode) && teamsWithPlayers.has(game.awayTeam.tricode)
    );
    const ignoredGames = selectedGameDay.poolGames.filter(
      (game) => !teamsWithPlayers.has(game.homeTeam.tricode) || !teamsWithPlayers.has(game.awayTeam.tricode)
    );
    const teamTricodes = new Set(
      rosterReadyGames.flatMap((game) => [game.homeTeam.tricode, game.awayTeam.tricode]).filter(Boolean)
    );
    const lockStatus = buildLockStatus(selectedGameDay.games);
    const lockedTeams = new Set(lockStatus.lockedTeams);
    const poolPlayers = candidatePlayers.filter((player) => teamTricodes.has(player.team));
    const averageStats = await loadAverageStats(
      poolPlayers.map((player) => ({ id: player.id, name: player.name, team: player.team })),
      statSeasons.current,
      statSeasons.previous
    );
    const players = poolPlayers.map((player) => {
      const stats = averageStats.get(player.id);
      if (!stats) {
        return {
          ...player,
          locked: lockedTeams.has(player.team),
          lockReason: lockedTeams.has(player.team) ? "Team game has started" : null
        };
      }

      return {
        ...player,
        locked: lockedTeams.has(player.team),
        lockReason: lockedTeams.has(player.team) ? "Team game has started" : null,
        stats: {
          season: stats.season,
          gamesPlayed: numberOrZero(stats.gamesPlayed),
          minutes: numberOrZero(stats.minutes),
          points: numberOrZero(stats.points),
          rebounds: numberOrZero(stats.rebounds),
          assists: numberOrZero(stats.assists),
          steals: numberOrZero(stats.steals),
          blocks: numberOrZero(stats.blocks),
          turnovers: numberOrZero(stats.turnovers),
          threesMade: numberOrZero(stats.threesMade),
          fieldGoalsMade: numberOrZero(stats.fieldGoalsMade),
          fieldGoalsAttempted: numberOrZero(stats.fieldGoalsAttempted),
          freeThrowsMade: numberOrZero(stats.freeThrowsMade),
          freeThrowsAttempted: numberOrZero(stats.freeThrowsAttempted),
          offensiveRebounds: numberOrZero(stats.offensiveRebounds),
          defensiveRebounds: numberOrZero(stats.defensiveRebounds),
          source: stats.source,
          sourceUrl: stats.sourceUrl
        }
      };
    });
    notes.push(...(
      ignoredGames.length > 0
        ? [`Ignored games without a complete selectable roster: ${ignoredGames.map((game) => `${game.awayTeam.tricode}@${game.homeTeam.tricode}`).join(", ")}.`]
        : []
    ));

    return NextResponse.json({
      source: playersSource,
      gamesSourceUrl: selectedGameDay.sourceUrl,
      playersSourceUrl,
      fetchedAt: new Date().toISOString(),
      gameDate: selectedGameDay.gameDate,
      games: rosterReadyGames,
      allGamesOnDate: selectedGameDay.games,
      ignoredGames,
      poolMode: selectedGameDay.poolMode,
      statSeasons,
      lockStatus,
      teams: Array.from(teamTricodes).sort(),
      players,
      notes
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: "NBA official APIs",
        fetchedAt: new Date().toISOString(),
        error: `Player pool unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
        gameDate: selectedGameDay.gameDate,
        games: selectedGameDay.poolGames,
        allGamesOnDate: selectedGameDay.games,
        poolMode: selectedGameDay.poolMode,
        teams: [],
        players: [],
        notes: errors
      },
      { status: 502 }
    );
  }
}
