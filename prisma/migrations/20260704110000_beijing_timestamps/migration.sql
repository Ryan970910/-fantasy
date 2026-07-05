ALTER TABLE "Game" ALTER COLUMN "createdAt" SET DEFAULT (now() AT TIME ZONE 'Asia/Shanghai');

ALTER TABLE "User" ALTER COLUMN "createdAt" SET DEFAULT (now() AT TIME ZONE 'Asia/Shanghai');
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT (now() AT TIME ZONE 'Asia/Shanghai');

ALTER TABLE "Lineup" ALTER COLUMN "createdAt" SET DEFAULT (now() AT TIME ZONE 'Asia/Shanghai');

ALTER TABLE "Player" ALTER COLUMN "createdAt" SET DEFAULT (now() AT TIME ZONE 'Asia/Shanghai');

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),

  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Session" ALTER COLUMN "createdAt" SET DEFAULT (now() AT TIME ZONE 'Asia/Shanghai');

CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session"
    ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
