import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NBA_CDN_SCOREBOARD_URL = "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json";
const NBA_CDN_BOXSCORE_URL = "https://cdn.nba.com/static/json/liveData/boxscore/boxscore_";
const NBA_GAMES_URL = "https://www.nba.com/games";
const REQUEST_TIMEOUT_MS = 8000;

type NbaTeam = {
  teamCity?: string;
  teamName?: string;
  teamTricode?: string;
  score?: number;
};

type NbaLeader = {
  name?: string;
  teamTricode?: string;
  points?: number | string;
  rebounds?: number | string;
  assists?: number | string;
};

type NbaGame = {
  gameId: string;
  gameStatus?: number;
  gameStatusText?: string;
  gameClock?: string;
  period?: number;
  gameTimeUTC?: string;
  homeTeam?: NbaTeam;
  awayTeam?: NbaTeam;
  gameLeaders?: {
    homeLeaders?: NbaLeader;
    awayLeaders?: NbaLeader;
  };
};

type NbaPlayer = {
  name?: string;
  nameI?: string;
  firstName?: string;
  familyName?: string;
  jerseyNum?: string;
  position?: string;
  status?: string;
  statistics?: {
    points?: number;
    reboundsTotal?: number;
    assists?: number;
    steals?: number;
    blocks?: number;
    turnovers?: number;
    threePointersMade?: number;
    minutes?: string;
  };
};

type NbaBoxTeam = {
  teamTricode?: string;
  players?: NbaPlayer[];
};

type NbaGameCard = {
  cardData?: {
    gameId?: string;
    leagueId?: string;
    cardHat?: string;
    seasonType?: string;
    gameStatus?: number;
    gameStatusText?: string;
    gameClock?: string;
    period?: number;
    gameTimeUtc?: string;
    homeTeam?: {
      teamName?: string;
      teamTricode?: string;
      score?: number;
      teamLeader?: NbaLeader & { position?: string; jerseyNum?: string };
    };
    awayTeam?: {
      teamName?: string;
      teamTricode?: string;
      score?: number;
      teamLeader?: NbaLeader & { position?: string; jerseyNum?: string };
    };
  };
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fullTeamName(team?: NbaTeam) {
  return [team?.teamCity, team?.teamName].filter(Boolean).join(" ") || team?.teamTricode || "TBD";
}

function playerName(player: NbaPlayer) {
  return player.name || player.nameI || [player.firstName, player.familyName].filter(Boolean).join(" ") || "Unknown player";
}

function normalizeLeader(leader?: NbaLeader | null) {
  if (!leader?.name) {
    return null;
  }

  return {
    name: leader.name,
    team: leader.teamTricode || "",
    points: toNumber(leader.points),
    rebounds: toNumber(leader.rebounds),
    assists: toNumber(leader.assists)
  };
}

function normalizePlayers(team?: NbaBoxTeam) {
  return (team?.players || [])
    .filter((player) => player.statistics)
    .map((player) => ({
      name: playerName(player),
      team: team?.teamTricode || "",
      jersey: player.jerseyNum || "",
      position: player.position || "",
      status: player.status || "",
      minutes: player.statistics?.minutes || "",
      points: player.statistics?.points ?? 0,
      rebounds: player.statistics?.reboundsTotal ?? 0,
      assists: player.statistics?.assists ?? 0,
      steals: player.statistics?.steals ?? 0,
      blocks: player.statistics?.blocks ?? 0,
      turnovers: player.statistics?.turnovers ?? 0,
      threes: player.statistics?.threePointersMade ?? 0
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);
}

function easternDate(offsetDays = 0) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
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

function normalizeLiveDataGames(scoreboardData: { scoreboard?: { games?: NbaGame[]; gameDate?: string }; meta?: { time?: string } }, boxscoreByGameId: Map<string, { homeTeam?: NbaBoxTeam; awayTeam?: NbaBoxTeam }>) {
  const games = scoreboardData.scoreboard?.games || [];

  return games.map((game) => {
    const boxscore = boxscoreByGameId.get(game.gameId);

    return {
      gameId: game.gameId,
      leagueId: "00",
      eventName: "NBA",
      status: game.gameStatus ?? 0,
      statusText: game.gameStatusText || "Scheduled",
      period: game.period ?? 0,
      clock: game.gameClock || "",
      startTimeUTC: game.gameTimeUTC || "",
      homeTeam: {
        name: fullTeamName(game.homeTeam),
        tricode: game.homeTeam?.teamTricode || "",
        score: game.homeTeam?.score ?? 0
      },
      awayTeam: {
        name: fullTeamName(game.awayTeam),
        tricode: game.awayTeam?.teamTricode || "",
        score: game.awayTeam?.score ?? 0
      },
      leaders: [normalizeLeader(game.gameLeaders?.awayLeaders), normalizeLeader(game.gameLeaders?.homeLeaders)].filter(Boolean),
      topPlayers: [...normalizePlayers(boxscore?.awayTeam), ...normalizePlayers(boxscore?.homeTeam)]
        .sort((a, b) => b.points - a.points)
        .slice(0, 10)
    };
  });
}

function extractNextData(html: string) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("NBA.com games page did not include __NEXT_DATA__");
  }

  return JSON.parse(match[1]);
}

type NormalizedLeader = NonNullable<ReturnType<typeof normalizeLeader>>;

function isLeader(leader: ReturnType<typeof normalizeLeader>): leader is NormalizedLeader {
  return leader !== null;
}

function normalizeGameCards(cards: NbaGameCard[]) {
  return cards.flatMap((card) => {
    const game = card.cardData;
    if (!game?.gameId) {
      return [];
    }

    const awayLeader = normalizeLeader(game.awayTeam?.teamLeader || null);
    const homeLeader = normalizeLeader(game.homeTeam?.teamLeader || null);

    return [{
      gameId: game.gameId,
      leagueId: game.leagueId || "",
      eventName: game.cardHat || game.seasonType || "NBA",
      status: game.gameStatus ?? 0,
      statusText: game.gameStatusText || "Scheduled",
      period: game.period ?? 0,
      clock: game.gameClock || "",
      startTimeUTC: game.gameTimeUtc || "",
      homeTeam: {
        name: game.homeTeam?.teamName || game.homeTeam?.teamTricode || "TBD",
        tricode: game.homeTeam?.teamTricode || "",
        score: game.homeTeam?.score ?? 0
      },
      awayTeam: {
        name: game.awayTeam?.teamName || game.awayTeam?.teamTricode || "TBD",
        tricode: game.awayTeam?.teamTricode || "",
        score: game.awayTeam?.score ?? 0
      },
      leaders: [awayLeader, homeLeader].filter(isLeader),
      topPlayers: [awayLeader, homeLeader]
        .filter(isLeader)
        .map((leader) => ({
          name: leader.name,
          team: leader.team,
          jersey: "",
          position: "",
          status: "",
          minutes: "",
          points: leader.points,
          rebounds: leader.rebounds,
          assists: leader.assists,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          threes: 0
        }))
    }];
  });
}

async function fetchNbaGamesPage(date: string) {
  const url = `${NBA_GAMES_URL}?date=${date}`;
  const html = await fetchText(url);
  const data = extractNextData(html);
  const cards: NbaGameCard[] = data.props?.pageProps?.gameCardFeed?.modules?.flatMap((module: { cards?: NbaGameCard[] }) => module.cards || []) || [];
  return {
    source: "NBA.com official games page",
    sourceUrl: url,
    gameDate: data.props?.pageProps?.selectedDate || date,
    games: normalizeGameCards(cards)
  };
}

export async function GET() {
  const errors: string[] = [];

  try {
    const scoreboardData = await fetchJson(NBA_CDN_SCOREBOARD_URL);
    const games: NbaGame[] = scoreboardData.scoreboard?.games || [];
    const boxscores = await Promise.allSettled(
      games.slice(0, 6).map(async (game) => {
        const data = await fetchJson(`${NBA_CDN_BOXSCORE_URL}${game.gameId}.json`);
        return [game.gameId, data.game] as const;
      })
    );

    const boxscoreByGameId = new Map<string, { homeTeam?: NbaBoxTeam; awayTeam?: NbaBoxTeam }>();
    for (const result of boxscores) {
      if (result.status === "fulfilled") {
        boxscoreByGameId.set(result.value[0], result.value[1]);
      }
    }

    const liveDataGames = normalizeLiveDataGames(scoreboardData, boxscoreByGameId);
    if (liveDataGames.length > 0) {
      return NextResponse.json({
        source: "NBA official liveData CDN",
        sourceUrl: NBA_CDN_SCOREBOARD_URL,
        fetchedAt: new Date().toISOString(),
        feedTime: scoreboardData.meta?.time || null,
        gameDate: scoreboardData.scoreboard?.gameDate || easternDate(),
        liveGameCount: liveDataGames.filter((game) => game.status === 2).length,
        games: liveDataGames
      });
    }

    errors.push("liveData CDN returned no LeagueID 00 games");
  } catch (error) {
    errors.push(`liveData CDN: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  const pageDates = Array.from(new Set([easternDate(-1), easternDate(), easternDate(1)]));
  const gamePageResults: Awaited<ReturnType<typeof fetchNbaGamesPage>>[] = [];

  for (const date of pageDates) {
    try {
      const gamesPage = await fetchNbaGamesPage(date);
      if (gamesPage.games.length > 0) {
        gamePageResults.push(gamesPage);
      } else {
        errors.push(`NBA.com games page ${date}: no games`);
      }
    } catch (error) {
      errors.push(`NBA.com games page ${date}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const currentEasternDate = easternDate();
  const selectedGamesPage =
    gamePageResults.find((result) => result.games.some((game) => game.status === 2)) ||
    gamePageResults.find((result) => result.gameDate === currentEasternDate) ||
    gamePageResults[0];

  if (selectedGamesPage) {
    return NextResponse.json({
      source: selectedGamesPage.source,
      sourceUrl: selectedGamesPage.sourceUrl,
      fetchedAt: new Date().toISOString(),
      feedTime: null,
      gameDate: selectedGamesPage.gameDate,
      liveGameCount: selectedGamesPage.games.filter((game) => game.status === 2).length,
      games: selectedGamesPage.games,
      notes: errors
    });
  }

  return NextResponse.json(
    {
      source: "NBA official APIs",
      sourceUrl: NBA_CDN_SCOREBOARD_URL,
      fetchedAt: new Date().toISOString(),
      error: errors.join("; "),
      games: []
    },
    { status: 502 }
  );
}
