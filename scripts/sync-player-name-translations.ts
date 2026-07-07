import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

type TranslationRow = {
  englishName: string;
  normalizedEnglishName: string;
  zhCnName: string;
};

const WIKIPEDIA_SOURCE = "Wikipedia Module:CGroup/NBA";
const WIKIPEDIA_SOURCE_URL = "https://zh.wikipedia.org/w/index.php?title=Module:CGroup/NBA&action=raw";
const WIKIDATA_SOURCE = "Wikidata zh-cn entity labels";
const WIKIDATA_API_URL = "https://query.wikidata.org/sparql";
const WIKIDATA_ENTITY_API_URL = "https://www.wikidata.org/w/api.php";
const ZH_VARIANT_API_URL = "https://zh.wikipedia.org/w/api.php";
const USER_AGENT = "fantasy-nba-system/0.1 (player display name sync)";
const DEFAULT_WIKIDATA_LIMIT = 300;
const DEFAULT_WIKIDATA_SEARCH_LIMIT = 200;
const WIKIDATA_BATCH_SIZE = 50;

function cliNumberOption(name: string, fallback: number) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function parseWikipediaNameTranslations(raw: string) {
  const start = raw.indexOf("== \u59d3\u540d ==");
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

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function sparqlString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"@en`;
}

function stripHtml(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function convertLabelsToZhCn(labels: string[]) {
  if (labels.length === 0) {
    return [] as string[];
  }

  const delimiter = "\n@@@\n";
  const url = new URL(ZH_VARIANT_API_URL);
  url.searchParams.set("action", "parse");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "text");
  url.searchParams.set("contentmodel", "wikitext");
  url.searchParams.set("variant", "zh-cn");
  url.searchParams.set("text", labels.join(delimiter));

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`zh-cn conversion failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as { parse?: { text?: { "*": string } } };
  const html = payload.parse?.text?.["*"] || "";
  const paragraph = html.match(/<p>([\s\S]*?)<\/p>/)?.[1] || html;
  return stripHtml(paragraph).split("@@@").map((value) => value.trim());
}

async function wikidataTranslationsForNames(names: string[]) {
  const rows: TranslationRow[] = [];
  for (let index = 0; index < names.length; index += WIKIDATA_BATCH_SIZE) {
    const batch = names.slice(index, index + WIKIDATA_BATCH_SIZE);
    const query = `
      SELECT ?en (SAMPLE(?label) AS ?zhName) WHERE {
        VALUES ?en { ${batch.map(sparqlString).join(" ")} }
        ?item rdfs:label ?en.
        ?item wdt:P106/wdt:P279* wd:Q3665646.
        OPTIONAL { ?item rdfs:label ?zhCn FILTER(LANG(?zhCn) = "zh-cn") }
        OPTIONAL { ?item rdfs:label ?zhHans FILTER(LANG(?zhHans) = "zh-hans") }
        OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }
        BIND(COALESCE(?zhCn, ?zhHans, ?zh) AS ?label)
        FILTER(BOUND(?label))
      }
      GROUP BY ?en
    `;
    const url = new URL(WIKIDATA_API_URL);
    url.searchParams.set("format", "json");
    url.searchParams.set("query", query);

    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      if (response.status === 429) {
        console.warn("Wikidata SPARQL rate limited; stopping supplement for this run.");
        break;
      }
      throw new Error(`Wikidata SPARQL failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as {
      results?: { bindings?: Array<{ en?: { value?: string }; zhName?: { value?: string } }> };
    };
    const bindings = payload.results?.bindings || [];
    const convertedLabels = await convertLabelsToZhCn(bindings.map((binding) => binding.zhName?.value || ""));

    for (const [bindingIndex, binding] of bindings.entries()) {
      const englishName = binding.en?.value || "";
      const zhCnName = convertedLabels[bindingIndex] || binding.zhName?.value || "";
      if (!englishName || !zhCnName || !hasChinese(zhCnName)) {
        continue;
      }
      rows.push({
        englishName,
        normalizedEnglishName: normalizeEnglishName(englishName),
        zhCnName
      });
    }

    console.log(`Checked ${Math.min(index + WIKIDATA_BATCH_SIZE, names.length)}/${names.length} player names against Wikidata SPARQL.`);
    if (index + WIKIDATA_BATCH_SIZE < names.length) {
      await sleep(1000);
    }
  }

  const deduped = new Map(rows.map((row) => [row.normalizedEnglishName, row]));
  return Array.from(deduped.values());
}

function wikidataLanguageValue(
  values: Record<string, { value?: string } | Array<{ value?: string }> | undefined>,
  languages: string[]
) {
  for (const language of languages) {
    const value = values[language];
    if (Array.isArray(value)) {
      const first = value.map((item) => item.value || "").find(Boolean);
      if (first) {
        return first;
      }
    } else if (value?.value) {
      return value.value;
    }
  }
  return "";
}

async function fetchWikidataEntityTranslation(id: string) {
  const url = new URL(WIKIDATA_ENTITY_API_URL);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("props", "labels|aliases");
  url.searchParams.set("languages", "zh-cn|zh-hans|zh|en");
  url.searchParams.set("ids", id);

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Wikidata entity fetch failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as {
    entities?: Record<string, {
      labels?: Record<string, { value?: string }>;
      aliases?: Record<string, Array<{ value?: string }>>;
    }>;
  };
  const entity = payload.entities?.[id];
  if (!entity) {
    return "";
  }

  const label = wikidataLanguageValue(entity.labels || {}, ["zh-cn", "zh-hans", "zh"]);
  const alias = wikidataLanguageValue(entity.aliases || {}, ["zh-cn", "zh-hans", "zh"]);
  const zhName = label || alias;
  if (!zhName) {
    return "";
  }

  const [converted] = await convertLabelsToZhCn([zhName]);
  return converted || zhName;
}

async function searchWikidataTranslationsForNames(names: string[]) {
  const rows: TranslationRow[] = [];
  for (const [index, name] of names.entries()) {
    const searchUrl = new URL(WIKIDATA_ENTITY_API_URL);
    searchUrl.searchParams.set("action", "wbsearchentities");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("language", "en");
    searchUrl.searchParams.set("uselang", "en");
    searchUrl.searchParams.set("type", "item");
    searchUrl.searchParams.set("limit", "5");
    searchUrl.searchParams.set("search", name);

    const response = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      if (response.status === 429) {
        console.warn("Wikidata entity search rate limited; stopping supplement for this run.");
        break;
      }
      throw new Error(`Wikidata entity search failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as {
      search?: Array<{ id?: string; label?: string; description?: string }>;
    };
    const normalizedName = normalizeEnglishName(name);
    const candidate = (payload.search || []).find((item) => {
      const label = normalizeEnglishName(item.label || "");
      const description = (item.description || "").toLowerCase();
      return label === normalizedName && description.includes("basketball player");
    });
    if (candidate?.id) {
      const zhCnName = await fetchWikidataEntityTranslation(candidate.id);
      if (zhCnName && hasChinese(zhCnName)) {
        rows.push({
          englishName: name,
          normalizedEnglishName: normalizedName,
          zhCnName
        });
      }
    }

    if ((index + 1) % 25 === 0 || index + 1 === names.length) {
      console.log(`Searched ${index + 1}/${names.length} player names through Wikidata entity search.`);
    }
    await sleep(350);
  }

  const deduped = new Map(rows.map((row) => [row.normalizedEnglishName, row]));
  return Array.from(deduped.values());
}

async function wikidataLabelCountForName(prisma: PrismaClient, englishName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ zhCnName: string; source: string }>>(
    `SELECT "zhCnName", "source" FROM "PlayerNameTranslation" WHERE "normalizedEnglishName" = $1`,
    normalizeEnglishName(englishName)
  );
  return rows[0] || null;
}

async function loadCoverageSnapshot(prisma: PrismaClient) {
  const rows = await prisma.$queryRawUnsafe<Array<{ playerName: string }>>(
    `SELECT DISTINCT "playerName" FROM "PlayerAverageStats" WHERE "playerName" <> ''
     UNION
     SELECT DISTINCT "name" AS "playerName" FROM "Player" WHERE "name" <> ''`
  );
  const translations = await prisma.$queryRawUnsafe<Array<{ normalizedEnglishName: string }>>(
    `SELECT "normalizedEnglishName" FROM "PlayerNameTranslation" WHERE "zhCnName" <> ''`
  );
  const translated = new Set(translations.map((row) => row.normalizedEnglishName));
  const total = rows.length;
  const exact = rows.filter((row) => translated.has(normalizeEnglishName(row.playerName))).length;
  return {
    total,
    exact
  };
}

async function loadPlayerNamesForWikidataSupplement(prisma: PrismaClient) {
  const rows = await prisma.$queryRawUnsafe<Array<{ playerName: string }>>(
    `SELECT DISTINCT "playerName" FROM "PlayerAverageStats" WHERE "playerName" <> ''
     UNION
     SELECT DISTINCT "name" AS "playerName" FROM "Player" WHERE "name" <> ''
     ORDER BY "playerName"`
  );

  const existingFullNameRows = await prisma.$queryRawUnsafe<Array<{ normalizedEnglishName: string }>>(
    `SELECT "normalizedEnglishName"
     FROM "PlayerNameTranslation"
     WHERE position(' ' in "englishName") > 0
       AND "zhCnName" <> ''`
  );
  const existingFullNames = new Set(existingFullNameRows.map((row) => row.normalizedEnglishName));

  return rows
    .map((row) => row.playerName.trim())
    .filter((name) => name.includes(" "))
    .filter((name) => !existingFullNames.has(normalizeEnglishName(name)));
}

async function upsertTranslationRows(
  prisma: PrismaClient,
  rows: TranslationRow[],
  source: string,
  sourceUrl: string
) {
  let imported = 0;
  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    if (batch.length === 0) {
      continue;
    }

    const valuesSql = batch.map((_, batchIndex) => {
      const offset = batchIndex * 6;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, now() AT TIME ZONE 'Asia/Shanghai')`;
    }).join(", ");
    const params = batch.flatMap((row) => [
      randomUUID(),
      row.englishName,
      row.normalizedEnglishName,
      row.zhCnName,
      source,
      sourceUrl
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
  return imported;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const response = await fetch(WIKIPEDIA_SOURCE_URL, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      throw new Error(`Wikipedia fetch failed: ${response.status} ${response.statusText}`);
    }

    const raw = await response.text();
    const wikipediaRows = parseWikipediaNameTranslations(raw);
    const wikipediaImported = await upsertTranslationRows(prisma, wikipediaRows, WIKIPEDIA_SOURCE, WIKIPEDIA_SOURCE_URL);

    const wikidataLimit = cliNumberOption("wikidata-limit", DEFAULT_WIKIDATA_LIMIT);
    const wikidataSearchLimit = cliNumberOption("wikidata-search-limit", DEFAULT_WIKIDATA_SEARCH_LIMIT);
    const namesToSupplement = (await loadPlayerNamesForWikidataSupplement(prisma)).slice(0, wikidataLimit);
    const beforeCoverage = await loadCoverageSnapshot(prisma);
    const wikidataRows = await wikidataTranslationsForNames(namesToSupplement);
    const sparqlMatched = new Set(wikidataRows.map((row) => row.normalizedEnglishName));
    const namesForEntitySearch = namesToSupplement
      .filter((name) => !sparqlMatched.has(normalizeEnglishName(name)))
      .slice(0, wikidataSearchLimit);
    const searchRows = await searchWikidataTranslationsForNames(namesForEntitySearch);
    const mergedWikidataRows = Array.from(
      new Map([...wikidataRows, ...searchRows].map((row) => [row.normalizedEnglishName, row])).values()
    );
    const wikidataImported = await upsertTranslationRows(prisma, mergedWikidataRows, WIKIDATA_SOURCE, WIKIDATA_API_URL);
    const afterCoverage = await loadCoverageSnapshot(prisma);
    const examples = await Promise.all([
      "Tyrese Maxey",
      "Cade Cunningham",
      "Dyson Daniels",
      "Christian Koloko",
      "Anthony Edwards",
      "Stephen Curry",
      "Ace Bailey"
    ].map(async (name) => [name, await wikidataLabelCountForName(prisma, name)]));

    console.log(`Imported ${wikipediaImported} NBA name-part translations from ${WIKIPEDIA_SOURCE_URL}.`);
    console.log(`Imported ${wikidataImported} full player-name translations from Wikidata.`);
    console.log(`Exact full-name coverage: ${beforeCoverage.exact}/${beforeCoverage.total} -> ${afterCoverage.exact}/${afterCoverage.total}.`);
    console.log(JSON.stringify(Object.fromEntries(examples), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
