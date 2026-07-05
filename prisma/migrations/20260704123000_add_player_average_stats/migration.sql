CREATE TABLE IF NOT EXISTS "PlayerAverageStats" (
  "id" TEXT NOT NULL,
  "nbaPlayerId" TEXT NOT NULL,
  "playerName" TEXT NOT NULL,
  "team" TEXT NOT NULL,
  "season" TEXT NOT NULL,
  "seasonType" TEXT NOT NULL DEFAULT 'Regular Season',
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
  "minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rebounds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "assists" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "steals" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "turnovers" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),

  CONSTRAINT "PlayerAverageStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerAverageStats_nbaPlayerId_season_seasonType_key"
  ON "PlayerAverageStats"("nbaPlayerId", "season", "seasonType");

CREATE INDEX IF NOT EXISTS "PlayerAverageStats_nbaPlayerId_idx"
  ON "PlayerAverageStats"("nbaPlayerId");

CREATE INDEX IF NOT EXISTS "PlayerAverageStats_season_seasonType_idx"
  ON "PlayerAverageStats"("season", "seasonType");

ALTER TABLE "PlayerAverageStats" ALTER COLUMN "updatedAt" SET DEFAULT (now() AT TIME ZONE 'Asia/Shanghai');
