import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildBallShareRows, defaultBallShareSeason, parsePythonBallSharePayload } from "../src/lib/player-ball-share-sync";
import { fetchOfficialPlayers } from "../src/lib/player-position-sync";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator >= 0) process.env[trimmed.slice(0, separator).trim()] ??= trimmed.slice(separator + 1).trim().replace(/^"|"$/g, "");
  }
}

function pythonExecutable() {
  return process.env.BALL_SHARE_PYTHON || ".\\.venv\\Scripts\\python.exe";
}

function runCollector(season: string, probe = false) {
  return new Promise<string>((resolveOutput, reject) => {
    const args = ["scripts/fetch_player_ball_share.py", "--season", season, ...(probe ? ["--probe"] : [])];
    const child = spawn(pythonExecutable(), args, { cwd: process.cwd(), windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolveOutput(stdout) : reject(new Error(`nba_api collector failed (${code}): ${stderr.trim() || "no error output"}`)));
  });
}

async function main() {
  loadEnvFile();
  const { PrismaClient } = await import("@prisma/client");
  const season = process.argv.find((argument) => argument.startsWith("--season="))?.split("=", 2)[1] || defaultBallShareSeason();
  const probe = process.argv.includes("--probe");
  const collected = JSON.parse(await runCollector(season, probe));
  if (probe) {
    console.log(JSON.stringify(collected, null, 2));
    return;
  }

  const parsed = parsePythonBallSharePayload(collected);
  if (parsed.season !== season) throw new Error(`nba_api collector returned ${parsed.season}, expected ${season}`);
  const officialPlayers = await fetchOfficialPlayers();
  const rows = buildBallShareRows(officialPlayers, parsed.windows, season, parsed.sourceUrl);
  const prisma = new PrismaClient();
  try {
    for (const chunk of Array.from({ length: Math.ceil(rows.length / 100) }, (_, index) => rows.slice(index * 100, index * 100 + 100))) {
      await prisma.$transaction(chunk.map((row) => prisma.playerBallShare.upsert({
        where: { nbaPlayerId_season: { nbaPlayerId: row.nbaPlayerId, season: row.season } },
        create: row,
        update: { ...row, syncedAt: new Date() }
      })));
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(JSON.stringify({ season, total: rows.length, available: rows.filter((row) => row.dataStatus === "AVAILABLE").length, rookies: rows.filter((row) => row.dataStatus === "ROOKIE").length, teamChanged: rows.filter((row) => row.dataStatus === "TEAM_CHANGED").length, noTrackingData: rows.filter((row) => row.dataStatus === "NO_TRACKING_DATA").length }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
