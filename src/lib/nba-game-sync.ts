import type { PrismaClient } from "@prisma/client";

const NBA_GAMES_URL = "https://www.nba.com/games";
const REQUEST_TIMEOUT_MS = 12000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

type NbaGameCard = {
  cardData?: {
    gameId?: string;
    gameStatus?: number;
    gameStatusText?: string;
    gameClock?: string;
    period?: number;
    gameTimeUtc?: string;
    homeTeam?: {
      teamName?: string;
      teamTricode?: string;
      score?: number;
    };
    awayTeam?: {
      teamName?: string;
      teamTricode?: string;
      score?: number;
    };
  };
};

type GameStatus = "not_started" | "in_progress" | "finished" | "unknown";

type SyncedGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  quarter: string;
  timeLeft: string;
  status: GameStatus;
  startTime: Date;
};

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

function utcToBeijingTimestamp(value: string | undefined) {
  const utcDate = value ? new Date(value) : null;
  if (!utcDate || Number.isNaN(utcDate.getTime())) {
    return new Date(Date.now() + BEIJING_OFFSET_MS);
  }

  return new Date(utcDate.getTime() + BEIJING_OFFSET_MS);
}

function statusFromGameStatus(gameStatus: number | undefined): GameStatus {
  if (gameStatus === 1) {
    return "not_started";
  }
  if (gameStatus === 2) {
    return "in_progress";
  }
  if (gameStatus === 3) {
    return "finished";
  }
  return "unknown";
}

function quarterFromPeriod(period: number | undefined, status: GameStatus) {
  if (status === "not_started") {
    return "Pre";
  }
  if (status === "finished") {
    return "Final";
  }
  return period ? String(period) : "Live";
}

function timeLeftFromCard(game: NonNullable<NbaGameCard["cardData"]>, status: GameStatus) {
  if (status === "finished") {
    return "Final";
  }
  return game.gameClock || game.gameStatusText || "";
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
  } finally {
    clearTimeout(timer);
  }
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
  return cards.flatMap((card): SyncedGame[] => {
    const game = card.cardData;
    if (!game?.gameId || !game.homeTeam || !game.awayTeam) {
      return [];
    }

    const status = statusFromGameStatus(game.gameStatus);
    return [{
      id: game.gameId,
      homeTeam: game.homeTeam.teamTricode || game.homeTeam.teamName || "TBD",
      awayTeam: game.awayTeam.teamTricode || game.awayTeam.teamName || "TBD",
      homeScore: game.homeTeam.score ?? 0,
      awayScore: game.awayTeam.score ?? 0,
      quarter: quarterFromPeriod(game.period, status),
      timeLeft: timeLeftFromCard(game, status),
      status,
      startTime: utcToBeijingTimestamp(game.gameTimeUtc)
    }];
  });
}

async function fetchGamesPage(date: string) {
  const url = `${NBA_GAMES_URL}?date=${date}`;
  const html = await fetchText(url);
  const data = extractNextData(html);
  const cards: NbaGameCard[] = data.props?.pageProps?.gameCardFeed?.modules?.flatMap(
    (module: { cards?: NbaGameCard[] }) => module.cards || []
  ) || [];

  return {
    sourceUrl: url,
    gameDate: data.props?.pageProps?.selectedDate || date,
    games: normalizeGameCards(cards)
  };
}

function selectRelevantGames(results: Awaited<ReturnType<typeof fetchGamesPage>>[]) {
  const liveResult = results.find((result) => result.games.some((game) => game.status === "in_progress"));
  if (liveResult) {
    return liveResult;
  }

  const nowBeijing = Date.now() + BEIJING_OFFSET_MS;
  const nextScheduledResult = results.find((result) =>
    result.games.some((game) => game.status === "not_started" && game.startTime.getTime() >= nowBeijing)
  );
  if (nextScheduledResult) {
    return nextScheduledResult;
  }

  return results.find((result) => result.games.length > 0) || null;
}

export async function syncGamesOnce(prisma: PrismaClient) {
  const results = [];
  for (let offset = 0; offset <= 3; offset += 1) {
    results.push(await fetchGamesPage(easternDate(offset)));
  }

  const selected = selectRelevantGames(results);
  if (!selected) {
    throw new Error("No NBA games found in the next 4 Eastern dates");
  }

  for (const game of selected.games) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Game" ("id", "homeTeam", "awayTeam", "homeScore", "awayScore", "quarter", "timeLeft", "status", "startTime", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now() AT TIME ZONE 'Asia/Shanghai',now() AT TIME ZONE 'Asia/Shanghai')
       ON CONFLICT ("id") DO UPDATE SET
         "homeTeam" = EXCLUDED."homeTeam",
         "awayTeam" = EXCLUDED."awayTeam",
         "homeScore" = EXCLUDED."homeScore",
         "awayScore" = EXCLUDED."awayScore",
         "quarter" = EXCLUDED."quarter",
         "timeLeft" = EXCLUDED."timeLeft",
         "status" = EXCLUDED."status",
         "startTime" = EXCLUDED."startTime",
         "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'`,
      game.id,
      game.homeTeam,
      game.awayTeam,
      game.homeScore,
      game.awayScore,
      game.quarter,
      game.timeLeft,
      game.status,
      game.startTime
    );
  }

  return {
    syncedAtBeijing: new Date(Date.now() + BEIJING_OFFSET_MS).toISOString().replace("Z", ""),
    gameDate: selected.gameDate,
    sourceUrl: selected.sourceUrl,
    count: selected.games.length,
    games: selected.games.map((game) => ({
      id: game.id,
      matchup: `${game.awayTeam}@${game.homeTeam}`,
      status: game.status,
      startTimeBeijing: game.startTime.toISOString().replace("Z", "")
    }))
  };
}
