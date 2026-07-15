import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lockedTeamCodes } from "@/lib/game-window";
import {
  fantasyScore,
  playerSalary,
  selectPricingStats
} from "@/lib/player-pricing";
import { prisma } from "@/lib/prisma";
import { loadPlayerNameTranslations, translatePlayerName } from "@/lib/player-name-translations";

export const dynamic = "force-dynamic";

const slots = ["PG", "SG", "SF", "PF", "C"] as const;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const LINEUP_SALARY_CAP = 125;

type Slot = (typeof slots)[number];

type SubmittedPlayer = {
  id?: string;
  name?: string;
  englishName?: string;
  team?: string;
  position?: string;
  salary?: number | null;
  stats?: {
    gamesPlayed?: number | null;
    minutes?: number | null;
    points?: number | null;
    rebounds?: number | null;
    assists?: number | null;
    steals?: number | null;
    blocks?: number | null;
    turnovers?: number | null;
    threesMade?: number | null;
    fieldGoalsMade?: number | null;
    fieldGoalsAttempted?: number | null;
    freeThrowsMade?: number | null;
    freeThrowsAttempted?: number | null;
    offensiveRebounds?: number | null;
    defensiveRebounds?: number | null;
    season?: string | null;
  };
};

type SubmitLineupBody = {
  lineupId?: string;
  gameDate?: string | null;
  games?: Array<{
    status?: number;
    startTimeUTC?: string;
    homeTeam?: { tricode?: string };
    awayTeam?: { tricode?: string };
  }>;
  playersBySlot?: Partial<Record<Slot, SubmittedPlayer | null>>;
};

type LineupRow = {
  lineupId: string;
  lineupName: string;
  totalSalary: number;
  totalPoints: number;
  gameDay: string;
  createdAt: string;
  slot: string;
  playerId: string;
  playerName: string;
  team: string;
  playerPosition: string;
  salary: number;
  fantasyPoints: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
};

type OwnedLineupRow = {
  id: string;
  name: string;
  gameDay: Date;
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
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isSlot(value: string): value is Slot {
  return slots.includes(value as Slot);
}

function numberOrZero(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function seasonLabel(startYear: number) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
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

function beijingNow() {
  return new Date(Date.now() + BEIJING_OFFSET_MS);
}

function gameDateFromLineupName(name: string) {
  return name.match(/^Lineup (\d{4}-\d{2}-\d{2})$/)?.[1] || null;
}

function earliestBeijingGameTime(games: SubmitLineupBody["games"], gameDate: string | null | undefined) {
  const parsedTimes = (games || [])
    .map((game) => game.startTimeUTC ? Date.parse(game.startTimeUTC) : Number.NaN)
    .filter((time) => Number.isFinite(time));

  if (parsedTimes.length > 0) {
    return new Date(Math.min(...parsedTimes) + BEIJING_OFFSET_MS);
  }

  if (gameDate && /^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
    return new Date(`${gameDate}T00:00:00.000Z`);
  }

  return beijingNow();
}

function validateLineupWindow(
  games: SubmitLineupBody["games"],
  players: Array<{ slot: Slot; player: ReturnType<typeof normalizePlayer> }>,
  allowedLockedPlayers = new Set<string>()
) {
  const validGames = games || [];
  if (validGames.length === 0) {
    throw new Error("比赛日锁定数据不可用，请刷新后重试。");
  }

  const now = Date.now();
  const lockedTeams = lockedTeamCodes(validGames, now);
  const lockedPlayer = players.find(({ slot, player }) =>
    lockedTeams.has(player.team) && !allowedLockedPlayers.has(`${slot}:${player.id}`)
  );
  if (lockedPlayer) {
    throw new Error(`${lockedPlayer.player.name} 已锁定，因为 ${lockedPlayer.player.team} 的比赛已经开始。`);
  }
}

function normalizePlayer(slot: Slot, player: SubmittedPlayer | null | undefined) {
  const id = String(player?.id || "").trim();
  const name = String(player?.englishName || player?.name || "").trim();
  const team = String(player?.team || "").trim();
  const position = String(player?.position || slot).trim();

  if (!id || !name || !team || !position) {
    throw new Error(`缺少 ${slot} 的球员数据。`);
  }

  const points = numberOrZero(player?.stats?.points);
  const rebounds = numberOrZero(player?.stats?.rebounds);
  const assists = numberOrZero(player?.stats?.assists);
  const steals = numberOrZero(player?.stats?.steals);
  const blocks = numberOrZero(player?.stats?.blocks);
  const turnovers = numberOrZero(player?.stats?.turnovers);
  const threesMade = numberOrZero(player?.stats?.threesMade);
  const fieldGoalsMade = numberOrZero(player?.stats?.fieldGoalsMade);
  const fieldGoalsAttempted = numberOrZero(player?.stats?.fieldGoalsAttempted);
  const freeThrowsMade = numberOrZero(player?.stats?.freeThrowsMade);
  const freeThrowsAttempted = numberOrZero(player?.stats?.freeThrowsAttempted);
  const offensiveRebounds = numberOrZero(player?.stats?.offensiveRebounds);
  const defensiveRebounds = numberOrZero(player?.stats?.defensiveRebounds);
  const salary = playerSalary(player?.stats || {});

  return {
    id: `nba-${id}`,
    nbaPlayerId: id,
    name,
    team,
    position,
    salary,
    ppg: points,
    rpg: rebounds,
    apg: assists,
    spg: steals,
    bpg: blocks,
    tpg: turnovers,
    fg3m: threesMade,
    fgm: fieldGoalsMade,
    fga: fieldGoalsAttempted,
    ftm: freeThrowsMade,
    fta: freeThrowsAttempted,
    oreb: offensiveRebounds,
    dreb: defensiveRebounds,
    statsSeason: String(player?.stats?.season || "").trim(),
    fppg: fantasyScore({
      points,
      rebounds,
      assists,
      steals,
      blocks,
      turnovers,
      threesMade,
      fieldGoalsMade,
      fieldGoalsAttempted,
      freeThrowsMade,
      freeThrowsAttempted,
      offensiveRebounds,
      defensiveRebounds
    })
  };
}

async function applyStableSalaries<T extends ReturnType<typeof normalizePlayer>>(players: T[]) {
  const seasons = defaultStatSeasons();
  const rows = await prisma.$queryRawUnsafe<AverageStatsRow[]>(
    `SELECT
       "nbaPlayerId", "playerName", "team", "season", "gamesPlayed", "minutes", "points", "rebounds",
       "assists", "steals", "blocks", "turnovers", "threesMade", "fieldGoalsMade", "fieldGoalsAttempted",
       "freeThrowsMade", "freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds"
     FROM "PlayerAverageStats"
     WHERE "seasonType" = $1
       AND "season" IN ($2, $3)`,
    "Regular Season",
    seasons.current,
    seasons.previous
  );

  const byPlayerId = new Map<string, AverageStatsRow[]>();
  const byPlayerName = new Map<string, AverageStatsRow[]>();
  for (const row of rows) {
    const idRows = byPlayerId.get(row.nbaPlayerId) || [];
    idRows.push(row);
    byPlayerId.set(row.nbaPlayerId, idRows);

    const nameRows = byPlayerName.get(normalizeName(row.playerName)) || [];
    nameRows.push(row);
    byPlayerName.set(normalizeName(row.playerName), nameRows);
  }

  return players.map((player) => {
    const rowKeys = new Set<string>();
    const candidates = [
      ...(byPlayerId.get(player.nbaPlayerId) || []),
      ...(byPlayerName.get(normalizeName(player.name)) || [])
    ].filter((row) => {
      const key = `${row.nbaPlayerId}:${row.season}:${row.team}`;
      if (rowKeys.has(key)) {
        return false;
      }
      rowKeys.add(key);
      return true;
    });

    const pricingStats = selectPricingStats(candidates, seasons.current, seasons.previous);
    return {
      ...player,
      salary: pricingStats ? playerSalary(pricingStats.current, pricingStats.previous) : player.salary
    };
  });
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return jsonError("请先登录。", 401);
  }

  const rows = await prisma.$queryRawUnsafe<LineupRow[]>(
    `SELECT
       l."id" AS "lineupId",
       l."name" AS "lineupName",
       l."totalSalary" AS "totalSalary",
       l."totalPoints" AS "totalPoints",
       to_char(l."gameDay", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "gameDay",
       to_char(l."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "createdAt",
       lp."position" AS "slot",
       p."id" AS "playerId",
       p."name" AS "playerName",
       p."team" AS "team",
       p."position" AS "playerPosition",
       p."salary" AS "salary",
       p."fppg" AS "fantasyPoints",
       p."ppg" AS "points",
       p."rpg" AS "rebounds",
       p."apg" AS "assists",
       p."spg" AS "steals",
       p."bpg" AS "blocks",
       p."tpg" AS "turnovers"
     FROM "Lineup" l
     INNER JOIN "LineupPlayer" lp ON lp."lineupId" = l."id"
     INNER JOIN "Player" p ON p."id" = lp."playerId"
     WHERE l."userId" = $1
     ORDER BY l."createdAt" DESC, array_position(ARRAY['PG','SG','SF','PF','C'], lp."position")`,
    currentUser.id
  );
  const playerNameTranslations = await loadPlayerNameTranslations(prisma);

  const lineups = Array.from(
    rows.reduce((lineupMap, row) => {
      const existing = lineupMap.get(row.lineupId) || {
        id: row.lineupId,
        name: row.lineupName,
        gameDate: gameDateFromLineupName(row.lineupName),
        totalSalary: Number(row.totalSalary) || 0,
        totalPoints: Number(row.totalPoints) || 0,
        gameDay: row.gameDay,
        createdAt: row.createdAt,
        players: [] as Array<{
          slot: string;
          id: string;
          name: string;
          englishName: string;
          team: string;
          position: string;
          salary: number;
          fantasyPoints: number;
          stats: {
            points: number;
            rebounds: number;
            assists: number;
            steals: number;
            blocks: number;
            turnovers: number;
          };
        }>
      };

      existing.players.push({
        slot: row.slot,
        id: row.playerId,
        name: translatePlayerName(row.playerName, playerNameTranslations),
        englishName: row.playerName,
        team: row.team,
        position: row.playerPosition,
        salary: Number(row.salary) || 0,
        fantasyPoints: Number(row.fantasyPoints) || 0,
        stats: {
          points: Number(row.points) || 0,
          rebounds: Number(row.rebounds) || 0,
          assists: Number(row.assists) || 0,
          steals: Number(row.steals) || 0,
          blocks: Number(row.blocks) || 0,
          turnovers: Number(row.turnovers) || 0
        }
      });

      lineupMap.set(row.lineupId, existing);
      return lineupMap;
    }, new Map<string, {
      id: string;
      name: string;
      gameDate: string | null;
      totalSalary: number;
      totalPoints: number;
      gameDay: string;
      createdAt: string;
      players: Array<{
        slot: string;
        id: string;
        name: string;
        englishName: string;
        team: string;
        position: string;
        salary: number;
        fantasyPoints: number;
        stats: {
          points: number;
          rebounds: number;
          assists: number;
          steals: number;
          blocks: number;
          turnovers: number;
        };
      }>;
    }>())
  ).map(([, lineup]) => lineup);

  return NextResponse.json({
    userId: currentUser.id,
    lineups
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return jsonError("请先登录。", 401);
  }

  let body: SubmitLineupBody;
  try {
    body = await request.json() as SubmitLineupBody;
  } catch {
    return jsonError("阵容数据格式不正确。", 400);
  }

  try {
    let selectedPlayers = slots.map((slot) => ({
      slot,
      player: normalizePlayer(slot, body.playersBySlot?.[slot])
    }));
    const selectedPlayerIds = new Set(selectedPlayers.map(({ player }) => player.id));

    if (selectedPlayerIds.size !== slots.length) {
      return jsonError("每个位置必须选择不同球员。", 400);
    }

    validateLineupWindow(body.games, selectedPlayers);
    const stableSalaryPlayers = await applyStableSalaries(selectedPlayers.map(({ player }) => player));
    selectedPlayers = selectedPlayers.map(({ slot }, index) => ({
      slot,
      player: stableSalaryPlayers[index]
    }));

    const lineupId = randomUUID();
    const lineupName = body.gameDate ? `Lineup ${body.gameDate}` : "My Lineup";
    const gameDay = earliestBeijingGameTime(body.games, body.gameDate);
    const totalPoints = selectedPlayers.reduce((sum, { player }) => sum + player.fppg, 0);
    const totalSalary = selectedPlayers.reduce((sum, { player }) => sum + player.salary, 0);
    if (totalSalary > LINEUP_SALARY_CAP) {
      return jsonError(`阵容工资 $${totalSalary} 超过 $${LINEUP_SALARY_CAP} 工资帽。`, 400);
    }

    await prisma.$transaction(async (tx) => {
      for (const { player } of selectedPlayers) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Player" (
            "id", "name", "team", "position", "salary", "fppg", "ppg", "rpg", "apg", "spg", "bpg", "tpg",
            "fg3m", "fgm", "fga", "ftm", "fta", "oreb", "dreb", "nbaPlayerId", "statsSeason", "imageUrl",
            "isActive", "createdAt", "updatedAt"
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'',true,now() AT TIME ZONE 'Asia/Shanghai',now() AT TIME ZONE 'Asia/Shanghai')
          ON CONFLICT ("id") DO UPDATE SET
            "name" = EXCLUDED."name",
            "team" = EXCLUDED."team",
            "position" = EXCLUDED."position",
            "salary" = EXCLUDED."salary",
            "fppg" = EXCLUDED."fppg",
            "ppg" = EXCLUDED."ppg",
            "rpg" = EXCLUDED."rpg",
            "apg" = EXCLUDED."apg",
            "spg" = EXCLUDED."spg",
            "bpg" = EXCLUDED."bpg",
            "tpg" = EXCLUDED."tpg",
            "fg3m" = EXCLUDED."fg3m",
            "fgm" = EXCLUDED."fgm",
            "fga" = EXCLUDED."fga",
            "ftm" = EXCLUDED."ftm",
            "fta" = EXCLUDED."fta",
            "oreb" = EXCLUDED."oreb",
            "dreb" = EXCLUDED."dreb",
            "nbaPlayerId" = EXCLUDED."nbaPlayerId",
            "statsSeason" = EXCLUDED."statsSeason",
            "isActive" = true,
            "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'`,
          player.id,
          player.name,
          player.team,
          player.position,
          player.salary,
          player.fppg,
          player.ppg,
          player.rpg,
          player.apg,
          player.spg,
          player.bpg,
          player.tpg,
          player.fg3m,
          player.fgm,
          player.fga,
          player.ftm,
          player.fta,
          player.oreb,
          player.dreb,
          player.nbaPlayerId,
          player.statsSeason || body.gameDate || ""
        );
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO "Lineup" ("id", "userId", "name", "totalSalary", "totalPoints", "gameDay", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,now() AT TIME ZONE 'Asia/Shanghai',now() AT TIME ZONE 'Asia/Shanghai')`,
        lineupId,
        currentUser.id,
        lineupName,
        totalSalary,
        totalPoints,
        gameDay
      );

      for (const { slot, player } of selectedPlayers) {
        if (!isSlot(slot)) {
          throw new Error(`无效位置 ${slot}`);
        }

        await tx.$executeRawUnsafe(
          `INSERT INTO "LineupPlayer" ("id", "lineupId", "playerId", "position")
           VALUES ($1,$2,$3,$4)`,
          randomUUID(),
          lineupId,
          player.id,
          slot
        );
      }
    }, {
      maxWait: 10000,
      timeout: 30000
    });

    return NextResponse.json({
      lineupId,
      userId: currentUser.id,
      playerCount: slots.length
    });
  } catch (error) {
    console.error("Lineup submit failed", error);
    return jsonError(error instanceof Error ? error.message : "无法提交阵容。", 400);
  }
}

export async function PUT(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return jsonError("请先登录。", 401);
  }

  let body: SubmitLineupBody;
  try {
    body = await request.json() as SubmitLineupBody;
  } catch {
    return jsonError("阵容数据格式不正确。", 400);
  }

  const lineupId = String(body.lineupId || "").trim();
  if (!lineupId) {
    return jsonError("缺少阵容 id。", 400);
  }

  try {
    const ownedLineups = await prisma.$queryRawUnsafe<OwnedLineupRow[]>(
      `SELECT "id", "name", "gameDay" FROM "Lineup" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
      lineupId,
      currentUser.id
    );

    if (ownedLineups.length === 0) {
      return jsonError("找不到阵容。", 404);
    }

    const ownedLineup = ownedLineups[0];
    const ownedGameDate = gameDateFromLineupName(ownedLineup.name);
    if (ownedGameDate && body.gameDate && ownedGameDate !== body.gameDate) {
      return jsonError("这个阵容属于之前的比赛日，已锁定。", 409);
    }
    let selectedPlayers = slots.map((slot) => ({
      slot,
      player: normalizePlayer(slot, body.playersBySlot?.[slot])
    }));
    const selectedPlayerIds = new Set(selectedPlayers.map(({ player }) => player.id));

    if (selectedPlayerIds.size !== slots.length) {
      return jsonError("每个位置必须选择不同球员。", 400);
    }

    const existingPlayers = await prisma.$queryRawUnsafe<Array<{ position: string; playerId: string }>>(
      `SELECT "position", "playerId" FROM "LineupPlayer" WHERE "lineupId" = $1`,
      lineupId
    );
    const allowedLockedPlayers = new Set(
      existingPlayers
        .filter((player) => isSlot(player.position))
        .map((player) => `${player.position}:${player.playerId}`)
    );

    validateLineupWindow(body.games, selectedPlayers, allowedLockedPlayers);
    const stableSalaryPlayers = await applyStableSalaries(selectedPlayers.map(({ player }) => player));
    selectedPlayers = selectedPlayers.map(({ slot }, index) => ({
      slot,
      player: stableSalaryPlayers[index]
    }));

    const lineupName = body.gameDate ? `Lineup ${body.gameDate}` : "My Lineup";
    const gameDay = earliestBeijingGameTime(body.games, body.gameDate);
    const totalPoints = selectedPlayers.reduce((sum, { player }) => sum + player.fppg, 0);
    const totalSalary = selectedPlayers.reduce((sum, { player }) => sum + player.salary, 0);
    if (totalSalary > LINEUP_SALARY_CAP) {
      return jsonError(`阵容工资 $${totalSalary} 超过 $${LINEUP_SALARY_CAP} 工资帽。`, 400);
    }

    await prisma.$transaction(async (tx) => {
      for (const { player } of selectedPlayers) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Player" (
            "id", "name", "team", "position", "salary", "fppg", "ppg", "rpg", "apg", "spg", "bpg", "tpg",
            "fg3m", "fgm", "fga", "ftm", "fta", "oreb", "dreb", "nbaPlayerId", "statsSeason", "imageUrl",
            "isActive", "createdAt", "updatedAt"
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'',true,now() AT TIME ZONE 'Asia/Shanghai',now() AT TIME ZONE 'Asia/Shanghai')
          ON CONFLICT ("id") DO UPDATE SET
            "name" = EXCLUDED."name",
            "team" = EXCLUDED."team",
            "position" = EXCLUDED."position",
            "salary" = EXCLUDED."salary",
            "fppg" = EXCLUDED."fppg",
            "ppg" = EXCLUDED."ppg",
            "rpg" = EXCLUDED."rpg",
            "apg" = EXCLUDED."apg",
            "spg" = EXCLUDED."spg",
            "bpg" = EXCLUDED."bpg",
            "tpg" = EXCLUDED."tpg",
            "fg3m" = EXCLUDED."fg3m",
            "fgm" = EXCLUDED."fgm",
            "fga" = EXCLUDED."fga",
            "ftm" = EXCLUDED."ftm",
            "fta" = EXCLUDED."fta",
            "oreb" = EXCLUDED."oreb",
            "dreb" = EXCLUDED."dreb",
            "nbaPlayerId" = EXCLUDED."nbaPlayerId",
            "statsSeason" = EXCLUDED."statsSeason",
            "isActive" = true,
            "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'`,
          player.id,
          player.name,
          player.team,
          player.position,
          player.salary,
          player.fppg,
          player.ppg,
          player.rpg,
          player.apg,
          player.spg,
          player.bpg,
          player.tpg,
          player.fg3m,
          player.fgm,
          player.fga,
          player.ftm,
          player.fta,
          player.oreb,
          player.dreb,
          player.nbaPlayerId,
          player.statsSeason || body.gameDate || ""
        );
      }

      await tx.$executeRawUnsafe(
        `UPDATE "Lineup"
         SET "name" = $1,
             "totalSalary" = $2,
             "totalPoints" = $3,
             "gameDay" = $4,
             "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'
         WHERE "id" = $5 AND "userId" = $6`,
        lineupName,
        totalSalary,
        totalPoints,
        gameDay,
        lineupId,
        currentUser.id
      );

      await tx.$executeRawUnsafe(
        `DELETE FROM "LineupPlayer" WHERE "lineupId" = $1`,
        lineupId
      );

      for (const { slot, player } of selectedPlayers) {
        if (!isSlot(slot)) {
          throw new Error(`无效位置 ${slot}`);
        }

        await tx.$executeRawUnsafe(
          `INSERT INTO "LineupPlayer" ("id", "lineupId", "playerId", "position")
           VALUES ($1,$2,$3,$4)`,
          randomUUID(),
          lineupId,
          player.id,
          slot
        );
      }
    }, {
      maxWait: 10000,
      timeout: 30000
    });

    return NextResponse.json({
      lineupId,
      userId: currentUser.id,
      playerCount: slots.length
    });
  } catch (error) {
    console.error("Lineup update failed", error);
    return jsonError(error instanceof Error ? error.message : "无法更新阵容。", 400);
  }
}

export async function DELETE(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return jsonError("请先登录。", 401);
  }

  const url = new URL(request.url);
  const lineupId = url.searchParams.get("lineupId") || "";
  if (!lineupId) {
    return jsonError("缺少阵容 id。", 400);
  }

  try {
    const ownedLineups = await prisma.$queryRawUnsafe<OwnedLineupRow[]>(
      `SELECT "id", "name", "gameDay" FROM "Lineup" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
      lineupId,
      currentUser.id
    );

    if (ownedLineups.length === 0) {
      return jsonError("找不到阵容。", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM "LineupPlayer" WHERE "lineupId" = $1`,
        lineupId
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Lineup" WHERE "id" = $1 AND "userId" = $2`,
        lineupId,
        currentUser.id
      );
    });

    return NextResponse.json({
      ok: true,
      lineupId
    });
  } catch (error) {
    console.error("Lineup delete failed", error);
    return jsonError(error instanceof Error ? error.message : "无法删除阵容。", 400);
  }
}
