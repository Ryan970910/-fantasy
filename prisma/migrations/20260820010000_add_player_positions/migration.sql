CREATE TABLE "PlayerExternalIdentity" (
    "id" TEXT NOT NULL,
    "nbaPlayerId" TEXT NOT NULL,
    "bbrPlayerId" TEXT,
    "playerName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "currentTeam" TEXT,
    "profilePosition" TEXT,
    "profileSourceUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),
    CONSTRAINT "PlayerExternalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerPositionSeason" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "team" TEXT,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pgPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sfPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pfPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceUrl" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),
    CONSTRAINT "PlayerPositionSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerCurrentPosition" (
    "playerId" TEXT NOT NULL,
    "position1" TEXT NOT NULL,
    "position2" TEXT,
    "positionDisplay" TEXT NOT NULL,
    "dataStatus" TEXT NOT NULL,
    "currentSeasonMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentSeasonWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "candidatePosition1" TEXT,
    "candidatePosition2" TEXT,
    "candidateConfirmations" INTEGER NOT NULL DEFAULT 0,
    "manualPosition1" TEXT,
    "manualPosition2" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),
    CONSTRAINT "PlayerCurrentPosition_pkey" PRIMARY KEY ("playerId")
);

CREATE UNIQUE INDEX "PlayerExternalIdentity_nbaPlayerId_key" ON "PlayerExternalIdentity"("nbaPlayerId");
CREATE UNIQUE INDEX "PlayerExternalIdentity_bbrPlayerId_key" ON "PlayerExternalIdentity"("bbrPlayerId");
CREATE INDEX "PlayerExternalIdentity_normalizedName_idx" ON "PlayerExternalIdentity"("normalizedName");
CREATE UNIQUE INDEX "PlayerPositionSeason_playerId_season_key" ON "PlayerPositionSeason"("playerId", "season");
CREATE INDEX "PlayerPositionSeason_season_idx" ON "PlayerPositionSeason"("season");
ALTER TABLE "PlayerPositionSeason" ADD CONSTRAINT "PlayerPositionSeason_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PlayerExternalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerCurrentPosition" ADD CONSTRAINT "PlayerCurrentPosition_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PlayerExternalIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
