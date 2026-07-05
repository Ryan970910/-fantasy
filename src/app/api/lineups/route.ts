import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const slots = ["PG", "SG", "SF", "PF", "C"] as const;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

type Slot = (typeof slots)[number];

type SubmittedPlayer = {
  id?: string;
  name?: string;
  team?: string;
  position?: string;
  stats?: {
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
  totalPoints: number;
  gameDay: Date;
  createdAt: Date;
  slot: string;
  playerId: string;
  playerName: string;
  team: string;
  playerPosition: string;
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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isSlot(value: string): value is Slot {
  return slots.includes(value as Slot);
}

function numberOrZero(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fantasyScore(stats: NonNullable<SubmittedPlayer["stats"]>) {
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

function submittedGameStarted(game: NonNullable<SubmitLineupBody["games"]>[number], now = Date.now()) {
  const startTime = game.startTimeUTC ? Date.parse(game.startTimeUTC) : Number.NaN;
  return (typeof game.status === "number" && game.status !== 1) || (Number.isFinite(startTime) && startTime <= now);
}

function validateLineupWindow(
  games: SubmitLineupBody["games"],
  players: Array<{ slot: Slot; player: ReturnType<typeof normalizePlayer> }>,
  allowedLockedPlayers = new Set<string>()
) {
  const validGames = games || [];
  if (validGames.length === 0) {
    throw new Error("Game day lock data is unavailable. Refresh and try again.");
  }

  const now = Date.now();
  const lockedTeams = new Set(
    validGames
      .filter((game) => submittedGameStarted(game, now))
      .flatMap((game) => [game.homeTeam?.tricode, game.awayTeam?.tricode])
      .filter((team): team is string => Boolean(team))
  );
  const lockedPlayer = players.find(({ slot, player }) =>
    lockedTeams.has(player.team) && !allowedLockedPlayers.has(`${slot}:${player.id}`)
  );
  if (lockedPlayer) {
    throw new Error(`${lockedPlayer.player.name} is locked because ${lockedPlayer.player.team} has started its game.`);
  }
}

function normalizePlayer(slot: Slot, player: SubmittedPlayer | null | undefined) {
  const id = String(player?.id || "").trim();
  const name = String(player?.name || "").trim();
  const team = String(player?.team || "").trim();
  const position = String(player?.position || slot).trim();

  if (!id || !name || !team || !position) {
    throw new Error(`Missing player data for ${slot}`);
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

  return {
    id: `nba-${id}`,
    nbaPlayerId: id,
    name,
    team,
    position,
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

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return jsonError("Login required.", 401);
  }

  const rows = await prisma.$queryRawUnsafe<LineupRow[]>(
    `SELECT
       l."id" AS "lineupId",
       l."name" AS "lineupName",
       l."totalPoints" AS "totalPoints",
       l."gameDay" AS "gameDay",
       l."createdAt" AS "createdAt",
       lp."position" AS "slot",
       p."id" AS "playerId",
       p."name" AS "playerName",
       p."team" AS "team",
       p."position" AS "playerPosition",
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

  const lineups = Array.from(
    rows.reduce((lineupMap, row) => {
      const existing = lineupMap.get(row.lineupId) || {
        id: row.lineupId,
        name: row.lineupName,
        gameDate: gameDateFromLineupName(row.lineupName),
        totalPoints: Number(row.totalPoints) || 0,
        gameDay: row.gameDay.toISOString(),
        createdAt: row.createdAt.toISOString(),
        players: [] as Array<{
          slot: string;
          id: string;
          name: string;
          team: string;
          position: string;
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
        name: row.playerName,
        team: row.team,
        position: row.playerPosition,
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
      totalPoints: number;
      gameDay: string;
      createdAt: string;
      players: Array<{
        slot: string;
        id: string;
        name: string;
        team: string;
        position: string;
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
    return jsonError("Login required.", 401);
  }

  let body: SubmitLineupBody;
  try {
    body = await request.json() as SubmitLineupBody;
  } catch {
    return jsonError("Invalid lineup payload.", 400);
  }

  try {
    const selectedPlayers = slots.map((slot) => ({
      slot,
      player: normalizePlayer(slot, body.playersBySlot?.[slot])
    }));
    const selectedPlayerIds = new Set(selectedPlayers.map(({ player }) => player.id));

    if (selectedPlayerIds.size !== slots.length) {
      return jsonError("Each lineup slot must use a different player.", 400);
    }

    validateLineupWindow(body.games, selectedPlayers);

    const lineupId = randomUUID();
    const lineupName = body.gameDate ? `Lineup ${body.gameDate}` : "My Lineup";
    const gameDay = earliestBeijingGameTime(body.games, body.gameDate);
    const totalPoints = selectedPlayers.reduce((sum, { player }) => sum + player.fppg, 0);

    await prisma.$transaction(async (tx) => {
      for (const { player } of selectedPlayers) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Player" (
            "id", "name", "team", "position", "salary", "fppg", "ppg", "rpg", "apg", "spg", "bpg", "tpg",
            "fg3m", "fgm", "fga", "ftm", "fta", "oreb", "dreb", "nbaPlayerId", "statsSeason", "imageUrl",
            "isActive", "createdAt", "updatedAt"
          )
          VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'',true,now() AT TIME ZONE 'Asia/Shanghai',now() AT TIME ZONE 'Asia/Shanghai')
          ON CONFLICT ("id") DO UPDATE SET
            "name" = EXCLUDED."name",
            "team" = EXCLUDED."team",
            "position" = EXCLUDED."position",
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
         VALUES ($1,$2,$3,0,$4,$5,now() AT TIME ZONE 'Asia/Shanghai',now() AT TIME ZONE 'Asia/Shanghai')`,
        lineupId,
        currentUser.id,
        lineupName,
        totalPoints,
        gameDay
      );

      for (const { slot, player } of selectedPlayers) {
        if (!isSlot(slot)) {
          throw new Error(`Invalid slot ${slot}`);
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
    return jsonError(error instanceof Error ? error.message : "Unable to submit lineup.", 400);
  }
}

export async function PUT(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return jsonError("Login required.", 401);
  }

  let body: SubmitLineupBody;
  try {
    body = await request.json() as SubmitLineupBody;
  } catch {
    return jsonError("Invalid lineup payload.", 400);
  }

  const lineupId = String(body.lineupId || "").trim();
  if (!lineupId) {
    return jsonError("Missing lineup id.", 400);
  }

  try {
    const ownedLineups = await prisma.$queryRawUnsafe<OwnedLineupRow[]>(
      `SELECT "id", "name", "gameDay" FROM "Lineup" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
      lineupId,
      currentUser.id
    );

    if (ownedLineups.length === 0) {
      return jsonError("Lineup not found.", 404);
    }

    const ownedLineup = ownedLineups[0];
    const ownedGameDate = gameDateFromLineupName(ownedLineup.name);
    if (ownedGameDate && body.gameDate && ownedGameDate !== body.gameDate) {
      return jsonError("This lineup belongs to a previous game day and is locked.", 409);
    }
    const selectedPlayers = slots.map((slot) => ({
      slot,
      player: normalizePlayer(slot, body.playersBySlot?.[slot])
    }));
    const selectedPlayerIds = new Set(selectedPlayers.map(({ player }) => player.id));

    if (selectedPlayerIds.size !== slots.length) {
      return jsonError("Each lineup slot must use a different player.", 400);
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

    const lineupName = body.gameDate ? `Lineup ${body.gameDate}` : "My Lineup";
    const gameDay = earliestBeijingGameTime(body.games, body.gameDate);
    const totalPoints = selectedPlayers.reduce((sum, { player }) => sum + player.fppg, 0);

    await prisma.$transaction(async (tx) => {
      for (const { player } of selectedPlayers) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Player" (
            "id", "name", "team", "position", "salary", "fppg", "ppg", "rpg", "apg", "spg", "bpg", "tpg",
            "fg3m", "fgm", "fga", "ftm", "fta", "oreb", "dreb", "nbaPlayerId", "statsSeason", "imageUrl",
            "isActive", "createdAt", "updatedAt"
          )
          VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'',true,now() AT TIME ZONE 'Asia/Shanghai',now() AT TIME ZONE 'Asia/Shanghai')
          ON CONFLICT ("id") DO UPDATE SET
            "name" = EXCLUDED."name",
            "team" = EXCLUDED."team",
            "position" = EXCLUDED."position",
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
             "totalPoints" = $2,
             "gameDay" = $3,
             "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'
         WHERE "id" = $4 AND "userId" = $5`,
        lineupName,
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
          throw new Error(`Invalid slot ${slot}`);
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
    return jsonError(error instanceof Error ? error.message : "Unable to update lineup.", 400);
  }
}
