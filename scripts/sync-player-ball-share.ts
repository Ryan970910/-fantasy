import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { syncPlayerBallShareOnce } from "../src/lib/player-ball-share-sync";

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

async function main() {
  loadEnvFile();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const season = process.argv.find((argument) => argument.startsWith("--season="))?.split("=", 2)[1];
    console.log(JSON.stringify(await syncPlayerBallShareOnce(prisma, season), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
