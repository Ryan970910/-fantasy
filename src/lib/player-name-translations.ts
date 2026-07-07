import { prisma } from "@/lib/prisma";

export type PlayerNameTranslationRow = {
  englishName: string;
  normalizedEnglishName: string;
  zhCnName: string;
};

const transliterationJoiner = "\u00b7";

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

function nameParts(value: string) {
  return value
    .replace(/[.'\u2019]/g, "")
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanTranslatedNamePart(value: string) {
  return value
    .replace(new RegExp(`^${transliterationJoiner}+|${transliterationJoiner}+$`, "g"), "")
    .trim();
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

    let translatedPartCount = 0;
    const translatedParts = nameParts(englishName).map((part) => {
      const translated = byNormalizedName.get(normalizeEnglishName(part));
      if (translated) {
        translatedPartCount += 1;
        return cleanTranslatedNamePart(translated);
      }
      return part;
    });
    if (translatedPartCount > 0) {
      return translatedParts.join(transliterationJoiner);
    }

    return englishName;
  };
}
