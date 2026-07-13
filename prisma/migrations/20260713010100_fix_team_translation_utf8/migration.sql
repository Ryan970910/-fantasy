WITH translations ("tricode", "encoded") AS (
  VALUES
    ('ATL', 'e88081e9b9b0'), ('BOS', 'e587afe5b094e789b9e4baba'),
    ('BKN', 'e7afaee7bd91'), ('CHA', 'e9bb84e89c82'), ('CHI', 'e585ace7899b'),
    ('CLE', 'e9aa91e5a3ab'), ('DAL', 'e78bace8a18ce4bea0'), ('DEN', 'e68e98e98791'),
    ('DET', 'e6b4bbe5a19e'), ('GSW', 'e58b87e5a3ab'), ('HOU', 'e781abe7aead'),
    ('IND', 'e6ada5e8a18ce88085'), ('LAC', 'e5bfabe888b9'), ('LAL', 'e6b996e4baba'),
    ('MEM', 'e781b0e7868a'), ('MIA', 'e783ade781ab'), ('MIL', 'e99b84e9b9bf'),
    ('MIN', 'e6a3aee69e97e78bbc'), ('NOP', 'e9b988e9b9ad'), ('NYK', 'e5b0bce5858be696af'),
    ('OKC', 'e99bb7e99c86'), ('ORL', 'e9ad94e69caf'), ('PHI', '3736e4baba'),
    ('PHX', 'e5a4aae998b3'), ('POR', 'e5bc80e68b93e88085'), ('SAC', 'e59bbde78e8b'),
    ('SAS', 'e9a9ace588ba'), ('TOR', 'e78c9be9be99'), ('UTA', 'e788b5e5a3ab'),
    ('WAS', 'e5a587e6898d')
)
UPDATE "TeamNameTranslation" AS target
SET
  "chineseName" = convert_from(decode(translations."encoded", 'hex'), 'UTF8'),
  "updatedAt" = now() AT TIME ZONE 'Asia/Shanghai'
FROM translations
WHERE target."tricode" = translations."tricode";
