import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { syncPlayerAverageStatsOnce } from "../src/lib/player-average-stats-sync";

function loadEnvFile() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0 && !line.trimStart().startsWith("#")) {
      process.env[line.slice(0, separator).trim()] ??= line.slice(separator + 1).trim().replace(/^"|"$/g, "");
    }
  }
}

async function main() {
  loadEnvFile();
  const seasons = process.argv.filter((arg) => arg.startsWith("--season=")).map((arg) => arg.slice("--season=".length));
  const prisma = new PrismaClient();
  try {
    console.log(JSON.stringify(await syncPlayerAverageStatsOnce(prisma, seasons), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
