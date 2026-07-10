type Queryable = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

type TranslationRow = {
  normalizedEnglishName: string;
  chineseName: string;
};

export function normalizeTranslationName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'\u2019-]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function loadPlayerNameTranslations(db: Queryable) {
  try {
    const rows = await db.$queryRawUnsafe<TranslationRow[]>(
      `SELECT "normalizedEnglishName", "chineseName"
       FROM "PlayerNameTranslation"`
    );

    return new Map(rows.map((row) => [row.normalizedEnglishName, row.chineseName]));
  } catch (error) {
    console.error("Player name translations lookup failed", error);
    return new Map<string, string>();
  }
}

export function translatePlayerName(englishName: string, translations: Map<string, string>) {
  return translations.get(normalizeTranslationName(englishName)) || englishName;
}
