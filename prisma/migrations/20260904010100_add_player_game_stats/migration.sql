CREATE TABLE "PlayerGameStats" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "nbaPlayerId" TEXT NOT NULL,
  "playerName" TEXT NOT NULL,
  "team" TEXT NOT NULL,
  "season" TEXT NOT NULL,
  "gameDate" TIMESTAMP(3) NOT NULL,
  "minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "points" INTEGER NOT NULL DEFAULT 0,
  "rebounds" INTEGER NOT NULL DEFAULT 0,
  "assists" INTEGER NOT NULL DEFAULT 0,
  "steals" INTEGER NOT NULL DEFAULT 0,
  "blocks" INTEGER NOT NULL DEFAULT 0,
  "turnovers" INTEGER NOT NULL DEFAULT 0,
  "threesMade" INTEGER NOT NULL DEFAULT 0,
  "fieldGoalsMade" INTEGER NOT NULL DEFAULT 0,
  "fieldGoalsAttempted" INTEGER NOT NULL DEFAULT 0,
  "freeThrowsMade" INTEGER NOT NULL DEFAULT 0,
  "freeThrowsAttempted" INTEGER NOT NULL DEFAULT 0,
  "offensiveRebounds" INTEGER NOT NULL DEFAULT 0,
  "defensiveRebounds" INTEGER NOT NULL DEFAULT 0,
  "sourceUrl" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),

  CONSTRAINT "PlayerGameStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerGameStats_gameId_nbaPlayerId_key"
  ON "PlayerGameStats"("gameId", "nbaPlayerId");

CREATE INDEX "PlayerGameStats_season_nbaPlayerId_idx"
  ON "PlayerGameStats"("season", "nbaPlayerId");

CREATE INDEX "PlayerGameStats_gameDate_idx"
  ON "PlayerGameStats"("gameDate");
