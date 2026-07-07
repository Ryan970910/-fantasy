CREATE TABLE IF NOT EXISTS "PlayerNameTranslation" (
  "id" TEXT NOT NULL,
  "englishName" TEXT NOT NULL,
  "normalizedEnglishName" TEXT NOT NULL,
  "zhCnName" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'::text),
  CONSTRAINT "PlayerNameTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerNameTranslation_normalizedEnglishName_key"
  ON "PlayerNameTranslation"("normalizedEnglishName");

CREATE INDEX IF NOT EXISTS "PlayerNameTranslation_englishName_idx"
  ON "PlayerNameTranslation"("englishName");
