CREATE TABLE "PlayerBallShare" (
  "id" TEXT NOT NULL,
  "nbaPlayerId" TEXT NOT NULL,
  "playerName" TEXT NOT NULL,
  "normalizedPlayerName" TEXT NOT NULL,
  "currentTeam" TEXT NOT NULL,
  "sourceTeam" TEXT,
  "season" TEXT NOT NULL,
  "dataStatus" TEXT NOT NULL,
  "unavailableReason" TEXT,
  "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
  "last5UsageRate" DOUBLE PRECISION,
  "last10UsageRate" DOUBLE PRECISION,
  "seasonUsageRate" DOUBLE PRECISION,
  "last5TimePossession" DOUBLE PRECISION,
  "last10TimePossession" DOUBLE PRECISION,
  "seasonTimePossession" DOUBLE PRECISION,
  "last5Touches" DOUBLE PRECISION,
  "last10Touches" DOUBLE PRECISION,
  "seasonTouches" DOUBLE PRECISION,
  "last5PotentialAssists" DOUBLE PRECISION,
  "last10PotentialAssists" DOUBLE PRECISION,
  "seasonPotentialAssists" DOUBLE PRECISION,
  "sourceUrl" TEXT NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),
  CONSTRAINT "PlayerBallShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerBallShare_nbaPlayerId_season_key" ON "PlayerBallShare"("nbaPlayerId", "season");
CREATE INDEX "PlayerBallShare_season_dataStatus_idx" ON "PlayerBallShare"("season", "dataStatus");
CREATE INDEX "PlayerBallShare_normalizedPlayerName_idx" ON "PlayerBallShare"("normalizedPlayerName");
