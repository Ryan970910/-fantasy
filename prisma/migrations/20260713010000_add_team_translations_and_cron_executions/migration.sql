CREATE TABLE IF NOT EXISTS "TeamNameTranslation" (
  "id" TEXT NOT NULL,
  "tricode" TEXT NOT NULL,
  "chineseName" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),
  CONSTRAINT "TeamNameTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamNameTranslation_tricode_key"
  ON "TeamNameTranslation"("tricode");

INSERT INTO "TeamNameTranslation" ("id", "tricode", "chineseName", "source") VALUES
  ('team-atl', 'ATL', U&'\\8001\\9E70', 'team_name.xlsx'),
  ('team-bos', 'BOS', U&'\\51EF\\5C14\\7279\\4EBA', 'team_name.xlsx'),
  ('team-bkn', 'BKN', U&'\\7BEE\\7F51', 'team_name.xlsx'),
  ('team-cha', 'CHA', U&'\\9EC4\\8702', 'team_name.xlsx'),
  ('team-chi', 'CHI', U&'\\516C\\725B', 'team_name.xlsx'),
  ('team-cle', 'CLE', U&'\\9A91\\58EB', 'team_name.xlsx'),
  ('team-dal', 'DAL', U&'\\72EC\\884C\\4FA0', 'team_name.xlsx'),
  ('team-den', 'DEN', U&'\\6398\\91D1', 'team_name.xlsx'),
  ('team-det', 'DET', U&'\\6D3B\\585E', 'team_name.xlsx'),
  ('team-gsw', 'GSW', U&'\\52C7\\58EB', 'team_name.xlsx'),
  ('team-hou', 'HOU', U&'\\706B\\7BAD', 'team_name.xlsx'),
  ('team-ind', 'IND', U&'\\6B65\\884C\\8005', 'team_name.xlsx'),
  ('team-lac', 'LAC', U&'\\5FEB\\8239', 'team_name.xlsx'),
  ('team-lal', 'LAL', U&'\\6E56\\4EBA', 'team_name.xlsx'),
  ('team-mem', 'MEM', U&'\\7070\\718A', 'team_name.xlsx'),
  ('team-mia', 'MIA', U&'\\70ED\\706B', 'team_name.xlsx'),
  ('team-mil', 'MIL', U&'\\96C4\\9E7F', 'team_name.xlsx'),
  ('team-min', 'MIN', U&'\\68EE\\6797\\72FC', 'team_name.xlsx'),
  ('team-nop', 'NOP', U&'\\9E48\\9E6D', 'team_name.xlsx'),
  ('team-nyk', 'NYK', U&'\\5C3C\\514B\\65AF', 'team_name.xlsx'),
  ('team-okc', 'OKC', U&'\\96F7\\9706', 'team_name.xlsx'),
  ('team-orl', 'ORL', U&'\\9B54\\672F', 'team_name.xlsx'),
  ('team-phi', 'PHI', U&'76\\4EBA', 'team_name.xlsx'),
  ('team-phx', 'PHX', U&'\\592A\\9633', 'team_name.xlsx'),
  ('team-por', 'POR', U&'\\5F00\\62D3\\8005', 'team_name.xlsx'),
  ('team-sac', 'SAC', U&'\\56FD\\738B', 'team_name.xlsx'),
  ('team-sas', 'SAS', U&'\\9A6C\\523A', 'team_name.xlsx'),
  ('team-tor', 'TOR', U&'\\731B\\9F99', 'team_name.xlsx'),
  ('team-uta', 'UTA', U&'\\7235\\58EB', 'team_name.xlsx'),
  ('team-was', 'WAS', U&'\\5947\\624D', 'team_name.xlsx')
ON CONFLICT ("tricode") DO UPDATE SET
  "chineseName" = EXCLUDED."chineseName",
  "source" = EXCLUDED."source",
  "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai';

CREATE TABLE IF NOT EXISTS "CronExecution" (
  "id" TEXT NOT NULL,
  "job" TEXT NOT NULL,
  "trigger" TEXT NOT NULL DEFAULT 'manual',
  "status" TEXT NOT NULL DEFAULT 'running',
  "details" TEXT NOT NULL DEFAULT '',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Shanghai'),
  CONSTRAINT "CronExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CronExecution_job_startedAt_idx"
  ON "CronExecution"("job", "startedAt");
