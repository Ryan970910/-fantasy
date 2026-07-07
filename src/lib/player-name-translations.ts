import { prisma } from "@/lib/prisma";

export type PlayerNameTranslationRow = {
  englishName: string;
  normalizedEnglishName: string;
  zhCnName: string;
};

export function normalizeEnglishName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'\u2019]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function loadPlayerNameTranslations() {
  try {
    const rows = await prisma.$queryRawUnsafe<PlayerNameTranslationRow[]>(
      `SELECT "englishName", "normalizedEnglishName", "zhCnName"
       FROM "PlayerNameTranslation"
       WHERE "zhCnName" <> ''
       ORDER BY length("englishName") DESC`
    );
    return rows;
  } catch (error) {
    console.error("Player name translation lookup failed", error);
    return [] as PlayerNameTranslationRow[];
  }
}

export function createPlayerNameTranslator(rows: PlayerNameTranslationRow[]) {
  const byNormalizedName = new Map(
    rows.map((row) => [row.normalizedEnglishName, row.zhCnName])
  );

  return (englishName: string) => {
    const exact = byNormalizedName.get(normalizeEnglishName(englishName));
    if (exact) {
      return exact;
    }

    return englishName;
  };
}
