import type { PrismaClient } from "@prisma/client";
import { FANTASY_POSITIONS, resolvePlayerPosition, type FantasyPosition, type PositionPercentages, type SeasonPositionSample } from "./player-position-resolution";

const NBA_PLAYER_INDEX_URL = "https://cdn.nba.com/static/json/staticData/playerIndex.json";
const BBR_PBP_URL = "https://www.basketball-reference.com/leagues/NBA_{year}_play-by-play.html";
const BBR_DRAFT_URL = "https://www.basketball-reference.com/draft/NBA_{year}.html";
const BBR_SEARCH_URL = "https://www.basketball-reference.com/search/search.fcgi?search={query}";
const REQUEST_TIMEOUT_MS = 30000;

type OfficialPlayer = { nbaPlayerId: string; playerName: string; team: string };
type BbrPositionRow = SeasonPositionSample & { bbrPlayerId: string; playerName: string; normalizedName: string; team: string; gamesPlayed: number; profileUrl: string; sourceUrl: string };

type PlayerIndexRow = [number, string, string, string, number, string, number, string, string, string, string, string, ...unknown[]];

function seasonLabel(startYear: number) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function defaultCurrentSeason() {
  const now = new Date();
  const startYear = now.getMonth() + 1 >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  return seasonLabel(startYear);
}

function seasonStartYear(season: string) {
  return Number(season.slice(0, 4));
}

function bbrYear(season: string) {
  return seasonStartYear(season) + 1;
}

export function normalizePositionPlayerName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.'’\-]/g, "").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function htmlDecode(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, "\"").replace(/<[^>]+>/g, "").trim();
}

function rawCell(rowHtml: string, dataStat: string) {
  return rowHtml.match(new RegExp(`<(?:td|th)[^>]*data-stat="${dataStat}"[^>]*>([\\s\\S]*?)<\\/(?:td|th)>`, "i"))?.[1] || "";
}

function cell(rowHtml: string, dataStat: string) {
  return htmlDecode(rawCell(rowHtml, dataStat));
}

function numberCell(rowHtml: string, dataStat: string) {
  const value = Number(cell(rowHtml, dataStat).replace("%", ""));
  return Number.isFinite(value) ? value : 0;
}

function profileIdentity(rowHtml: string) {
  const raw = rawCell(rowHtml, "name_display") || rawCell(rowHtml, "player");
  const path = raw.match(/href="(\/players\/[^/]+\/([^"/]+)\.html)"/i);
  return path ? { bbrPlayerId: path[2], profileUrl: `https://www.basketball-reference.com${path[1]}` } : null;
}

export function parseBbrPositionRows(html: string, season: string, sourceUrl: string) {
  const table = html.match(/<table[^>]*id="pbp_stats"[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error("Basketball Reference pbp_stats table was not found");
  const rows: BbrPositionRow[] = [];
  for (const match of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1];
    const identity = profileIdentity(rowHtml);
    const playerName = cell(rowHtml, "name_display") || cell(rowHtml, "player");
    if (!identity || !playerName || playerName === "Player") continue;
    rows.push({
      ...identity,
      playerName,
      normalizedName: normalizePositionPlayerName(playerName),
      team: cell(rowHtml, "team_name_abbr") || cell(rowHtml, "team_id"),
      gamesPlayed: Math.trunc(numberCell(rowHtml, "games")),
      season,
      minutes: numberCell(rowHtml, "mp"),
      percentages: { PG: numberCell(rowHtml, "pct_1"), SG: numberCell(rowHtml, "pct_2"), SF: numberCell(rowHtml, "pct_3"), PF: numberCell(rowHtml, "pct_4"), C: numberCell(rowHtml, "pct_5") },
      sourceUrl
    });
  }
  const grouped = new Map<string, BbrPositionRow[]>();
  for (const row of rows) grouped.set(row.bbrPlayerId, [...(grouped.get(row.bbrPlayerId) || []), row]);
  return Array.from(grouped.values()).map((playerRows) => playerRows.find((row) => /^\d+TM$/.test(row.team)) || playerRows[0]);
}

function parseProfileLinks(html: string) {
  const links = new Map<string, { bbrPlayerId: string; profileUrl: string }>();
  for (const match of html.matchAll(/href="(\/players\/[^/]+\/([^"/]+)\.html)"[^>]*>([^<]+)<\/a>/gi)) {
    links.set(normalizePositionPlayerName(htmlDecode(match[3])), { bbrPlayerId: match[2], profileUrl: `https://www.basketball-reference.com${match[1]}` });
  }
  return links;
}

export function parseProfilePositions(html: string) {
  const text = htmlDecode(html).replace(/&#9642;/g, "▪");
  const value = text.match(/Position:\s*([^▪\n]+)/i)?.[1]?.trim() || "";
  const labels: Array<[string, FantasyPosition]> = [["Point Guard", "PG"], ["Shooting Guard", "SG"], ["Small Forward", "SF"], ["Power Forward", "PF"], ["Center", "C"]];
  return labels.filter(([label]) => value.includes(label)).map(([, position]) => position).slice(0, 2);
}

async function fetchDocument(url: string, accept = "text/html") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: accept, "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return { text: await response.text(), url: response.url };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, accept = "text/html") {
  return (await fetchDocument(url, accept)).text;
}

async function fetchOfficialPlayers() {
  const payload = JSON.parse(await fetchText(NBA_PLAYER_INDEX_URL, "application/json")) as { resultSets?: Array<{ rowSet?: PlayerIndexRow[] }> };
  const rows = payload.resultSets?.[0]?.rowSet || [];
  return rows.filter((row) => row[19] === 1).map((row): OfficialPlayer => ({ nbaPlayerId: String(row[0]), playerName: `${row[2]} ${row[1]}`.trim(), team: row[9] }));
}

async function optionalPositionRows(season: string) {
  const sourceUrl = BBR_PBP_URL.replace("{year}", String(bbrYear(season)));
  try {
    return parseBbrPositionRows(await fetchText(sourceUrl), season, sourceUrl);
  } catch (error) {
    console.warn(`Position Estimate unavailable for ${season}`, error);
    return [];
  }
}

async function profilePosition(profileUrl: string) {
  try { return parseProfilePositions(await fetchText(profileUrl)); } catch (error) { console.warn(`Profile position unavailable: ${profileUrl}`, error); return null; }
}

async function mapInBatches<T, R>(values: T[], size: number, mapper: (value: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += size) results.push(...await Promise.all(values.slice(index, index + size).map(mapper)));
  return results;
}

function percentagesForDb(percentages: PositionPercentages) {
  return { pgPercent: percentages.PG, sgPercent: percentages.SG, sfPercent: percentages.SF, pfPercent: percentages.PF, cPercent: percentages.C };
}

function sampleFromDb(row: { season: string; minutes: number; pgPercent: number; sgPercent: number; sfPercent: number; pfPercent: number; cPercent: number }): SeasonPositionSample {
  return { season: row.season, minutes: row.minutes, percentages: { PG: row.pgPercent, SG: row.sgPercent, SF: row.sfPercent, PF: row.pfPercent, C: row.cPercent } };
}

function storedProfilePositions(value: string | null | undefined) {
  return String(value || "").split("-").filter((position): position is FantasyPosition => FANTASY_POSITIONS.includes(position as FantasyPosition)).slice(0, 2);
}

export async function syncPlayerPositionsOnce(prisma: PrismaClient, currentSeason = defaultCurrentSeason()) {
  const currentStart = seasonStartYear(currentSeason);
  const seasons = [currentSeason, seasonLabel(currentStart - 1), seasonLabel(currentStart - 2), seasonLabel(currentStart - 3)];
  const officialPlayers = await fetchOfficialPlayers();
  const seasonRows = (await Promise.all(seasons.map(optionalPositionRows))).flat();
  const rowsByName = new Map<string, BbrPositionRow[]>();
  for (const row of seasonRows) rowsByName.set(row.normalizedName, [...(rowsByName.get(row.normalizedName) || []), row]);

  const draftUrl = BBR_DRAFT_URL.replace("{year}", String(seasonStartYear(currentSeason)));
  let draftLinks = new Map<string, { bbrPlayerId: string; profileUrl: string }>();
  try { draftLinks = parseProfileLinks(await fetchText(draftUrl)); } catch (error) { console.warn("Draft profile links unavailable", error); }
  const existingIdentities = await prisma.playerExternalIdentity.findMany();
  const existingByNbaId = new Map(existingIdentities.map((row) => [row.nbaPlayerId, row]));
  const linksByNbaId = new Map<string, { bbrPlayerId: string; profileUrl: string }>();
  for (const official of officialPlayers) {
    const matchedRows = rowsByName.get(normalizePositionPlayerName(official.playerName)) || [];
    const existing = existingByNbaId.get(official.nbaPlayerId);
    const link = matchedRows[0]
      ? { bbrPlayerId: matchedRows[0].bbrPlayerId, profileUrl: matchedRows[0].profileUrl }
      : draftLinks.get(normalizePositionPlayerName(official.playerName)) || (existing?.bbrPlayerId && existing.profileSourceUrl ? { bbrPlayerId: existing.bbrPlayerId, profileUrl: existing.profileSourceUrl } : undefined);
    if (link) linksByNbaId.set(official.nbaPlayerId, link);
  }
  const unresolvedLinks = officialPlayers.filter((player) => !linksByNbaId.has(player.nbaPlayerId));
  await mapInBatches(unresolvedLinks, 4, async (official) => {
    try {
      const searchUrl = BBR_SEARCH_URL.replace("{query}", encodeURIComponent(official.playerName));
      const search = await fetchDocument(searchUrl);
      const redirected = search.url.match(/https:\/\/www\.basketball-reference\.com\/players\/[^/]+\/([^/]+)\.html/i);
      const link = redirected
        ? { bbrPlayerId: redirected[1], profileUrl: search.url }
        : parseProfileLinks(search.text).get(normalizePositionPlayerName(official.playerName));
      if (link) linksByNbaId.set(official.nbaPlayerId, link);
    } catch (error) { console.warn(`BBR profile search failed for ${official.playerName}`, error); }
  });
  const profileResults = new Map<string, FantasyPosition[] | null>();
  const zeroMinutePlayers = officialPlayers.filter((official) => {
    const current = (rowsByName.get(normalizePositionPlayerName(official.playerName)) || []).some((row) => row.season === currentSeason && row.minutes > 0);
    return !current && linksByNbaId.has(official.nbaPlayerId);
  });
  await mapInBatches(zeroMinutePlayers, 4, async (official) => {
    profileResults.set(official.nbaPlayerId, await profilePosition(linksByNbaId.get(official.nbaPlayerId)!.profileUrl));
  });
  let manualReview = 0;
  let synced = 0;

  for (const official of officialPlayers) {
    const normalizedName = normalizePositionPlayerName(official.playerName);
    const matchedRows = rowsByName.get(normalizedName) || [];
    const existing = existingByNbaId.get(official.nbaPlayerId);
    const link = linksByNbaId.get(official.nbaPlayerId);

    const currentRow = matchedRows.find((row) => row.season === currentSeason) || null;
    let profilePositions: FantasyPosition[] = storedProfilePositions(existing?.profilePosition);
    const fetchedProfile = profileResults.get(official.nbaPlayerId);
    if (fetchedProfile !== undefined && fetchedProfile !== null) profilePositions = fetchedProfile;
    const profileWasRead = (fetchedProfile !== undefined && fetchedProfile !== null) || Boolean(existing?.profilePosition);
    const profilePositionText = fetchedProfile !== undefined && fetchedProfile !== null
      ? fetchedProfile.join("-") || "UNRESOLVED"
      : existing?.profilePosition || null;
    const identity = await prisma.playerExternalIdentity.upsert({
      where: { nbaPlayerId: official.nbaPlayerId },
      create: { nbaPlayerId: official.nbaPlayerId, bbrPlayerId: link?.bbrPlayerId, playerName: official.playerName, normalizedName, currentTeam: official.team, profilePosition: profilePositionText, profileSourceUrl: link?.profileUrl },
      update: { bbrPlayerId: link?.bbrPlayerId || existing?.bbrPlayerId, playerName: official.playerName, normalizedName, currentTeam: official.team, profilePosition: profilePositionText, profileSourceUrl: link?.profileUrl || existing?.profileSourceUrl, updatedAt: new Date() }
    });

    for (const row of matchedRows) {
      await prisma.playerPositionSeason.upsert({
        where: { playerId_season: { playerId: identity.id, season: row.season } },
        create: { playerId: identity.id, season: row.season, team: row.team, gamesPlayed: row.gamesPlayed, minutes: row.minutes, ...percentagesForDb(row.percentages), sourceUrl: row.sourceUrl },
        update: { team: row.team, gamesPlayed: row.gamesPlayed, minutes: row.minutes, ...percentagesForDb(row.percentages), sourceUrl: row.sourceUrl, fetchedAt: new Date() }
      });
    }

    const storedSamples = await prisma.playerPositionSeason.findMany({ where: { playerId: identity.id, season: { in: seasons } } });
    const currentSample = storedSamples.find((row) => row.season === currentSeason);
    const previousSamples = seasons.slice(1).map((season) => storedSamples.find((row) => row.season === season)).filter((row): row is NonNullable<typeof row> => Boolean(row)).map(sampleFromDb);
    const resolved = resolvePlayerPosition(currentSample ? sampleFromDb(currentSample) : null, previousSamples, profilePositions, profileWasRead);
    const prior = await prisma.playerCurrentPosition.findUnique({ where: { playerId: identity.id } });
    const calculated = resolved.positions;
    const current = prior ? [prior.position1, prior.position2].filter(Boolean) : [];
    const same = current.join("-") === calculated.join("-");
    const sameCandidate = prior && [prior.candidatePosition1, prior.candidatePosition2].filter(Boolean).join("-") === calculated.join("-");
    const confirmations = same ? 0 : sameCandidate ? (prior?.candidateConfirmations || 0) + 1 : 1;
    const adoptCandidate = !prior || same || confirmations >= 2;
    const finalPositions = prior?.manualPosition1
      ? [prior.manualPosition1, prior.manualPosition2].filter(Boolean) as FantasyPosition[]
      : adoptCandidate ? calculated : current as FantasyPosition[];
    if (!finalPositions.length) manualReview += 1;
    await prisma.playerCurrentPosition.upsert({
      where: { playerId: identity.id },
      create: { playerId: identity.id, position1: finalPositions[0] || "UNRESOLVED", position2: finalPositions[1], positionDisplay: finalPositions.join("-") || "UNRESOLVED", dataStatus: resolved.dataStatus, currentSeasonMinutes: resolved.currentSeasonMinutes, currentSeasonWeight: resolved.currentSeasonWeight, confidence: resolved.confidence },
      update: { position1: finalPositions[0] || prior?.position1 || "UNRESOLVED", position2: finalPositions[1] || null, positionDisplay: finalPositions.join("-") || prior?.positionDisplay || "UNRESOLVED", dataStatus: prior?.manualPosition1 ? "MANUAL_OVERRIDE" : resolved.dataStatus, currentSeasonMinutes: resolved.currentSeasonMinutes, currentSeasonWeight: resolved.currentSeasonWeight, confidence: resolved.confidence, candidatePosition1: adoptCandidate ? null : calculated[0], candidatePosition2: adoptCandidate ? null : calculated[1], candidateConfirmations: adoptCandidate ? 0 : confirmations, calculatedAt: new Date() }
    });
    synced += 1;
  }

  return { currentSeason, officialPlayers: officialPlayers.length, synced, manualReview, sources: { officialPlayers: NBA_PLAYER_INDEX_URL, positionEstimateSeasons: seasons, rookieProfiles: draftUrl } };
}
