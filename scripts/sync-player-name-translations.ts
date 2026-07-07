import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const SOURCE = "Wikipedia Module:CGroup/NBA";
const SOURCE_URL = "https://zh.wikipedia.org/w/index.php?title=Module:CGroup/NBA&action=raw";

function normalizeEnglishName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'\u2019]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function unescapeLuaString(value: string) {
  return value.replace(/\\'/g, "'").replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
}

function zhCnValue(rule: string) {
  const candidates = ["zh-cn", "zh-hans", "zh-sg", "zh"];
  for (const key of candidates) {
    const matches = Array.from(rule.matchAll(new RegExp(`${key}:([^;]*)`, "gi")));
    const value = matches.map((match) => match[1].trim()).find(Boolean);
    if (value) {
      return value;
    }
  }
  return null;
}

function parseNameTranslations(raw: string) {
  const start = raw.indexOf("== 姓名 ==");
  if (start < 0) {
    throw new Error("Unable to find name section in Wikipedia module.");
  }

  const rest = raw.slice(start);
  const nextTopLevel = rest.slice(1).search(/\n==[^=]/);
  const section = nextTopLevel >= 0 ? rest.slice(0, nextTopLevel + 1) : rest;
  const rows = new Map<string, { englishName: string; zhCnName: string }>();
  const itemPattern = /Item\('((?:\\'|[^'])+)'\s*,\s*'((?:\\'|[^'])*)'\)/g;

  for (const match of section.matchAll(itemPattern)) {
    const english = unescapeLuaString(match[1]);
    const rule = unescapeLuaString(match[2]);
    const zhCnName = zhCnValue(rule);
    if (!zhCnName) {
      continue;
    }

    for (const alias of english.split(",")) {
      const englishName = alias.trim();
      const normalizedEnglishName = normalizeEnglishName(englishName);
      if (!englishName || !normalizedEnglishName || rows.has(normalizedEnglishName)) {
        continue;
      }
      rows.set(normalizedEnglishName, { englishName, zhCnName });
    }
  }

  return Array.from(rows, ([normalizedEnglishName, row]) => ({
    normalizedEnglishName,
    ...row
  }));
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) {
      throw new Error(`Wikipedia fetch failed: ${response.status} ${response.statusText}`);
    }

    const raw = await response.text();
    const rows = parseNameTranslations(raw);
    let imported = 0;

    for (let index = 0; index < rows.length; index += 100) {
      const batch = rows.slice(index, index + 100);
      const valuesSql = batch.map((_, batchIndex) => {
        const offset = batchIndex * 6;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, now() AT TIME ZONE 'Asia/Shanghai')`;
      }).join(", ");
      const params = batch.flatMap((row) => [
        randomUUID(),
        row.englishName,
        row.normalizedEnglishName,
        row.zhCnName,
        SOURCE,
        SOURCE_URL
      ]);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "PlayerNameTranslation" (
           "id", "englishName", "normalizedEnglishName", "zhCnName", "source", "sourceUrl", "updatedAt"
         )
         VALUES ${valuesSql}
         ON CONFLICT ("normalizedEnglishName") DO UPDATE SET
           "englishName" = EXCLUDED."englishName",
           "zhCnName" = EXCLUDED."zhCnName",
           "source" = EXCLUDED."source",
           "sourceUrl" = EXCLUDED."sourceUrl",
           "updatedAt" = EXCLUDED."updatedAt"`,
        ...params
      );
      imported += batch.length;
    }

    console.log(`Imported ${imported} NBA player name translations from ${SOURCE_URL}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
