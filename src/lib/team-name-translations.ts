import type { PrismaClient } from "@prisma/client";

export async function loadTeamNameTranslations(prisma: PrismaClient) {
  const rows = await prisma.teamNameTranslation.findMany({
    select: { tricode: true, chineseName: true }
  });

  return Object.fromEntries(rows.map((row) => [row.tricode, row.chineseName]));
}
