import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { nbaGameDate } from '@/lib/game-window';
import { buildRanking, type RankingLineup } from '@/lib/live-ranking';
import { loadRankingGames } from '@/lib/live-ranking-source';
import { loadPlayerNameTranslations, translatePlayerName } from '@/lib/player-name-translations';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
type Row={id:string;userId:string;name:string;playerId:string;playerName:string;team:string;slot:string};
export async function GET(request: Request) {
  const user=await getCurrentUser();
  if (!user) return NextResponse.json({error:'请先登录。'},{status:401,headers});
  const date=new URL(request.url).searchParams.get('date')||nbaGameDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date) return NextResponse.json({error:'请选择有效比赛日。'},{status:400,headers});
  try {
    // One entry per user/day: use their most recently saved lineup.
    const rows=await prisma.$queryRawUnsafe<Row[]>(`
      WITH selected AS (
        SELECT DISTINCT ON ("userId") "id", "userId" FROM "Lineup"
        WHERE "name" = $1 ORDER BY "userId", "updatedAt" DESC, "createdAt" DESC, "id"
      )
      SELECT l."id", l."userId", u."name", p."nbaPlayerId" AS "playerId", p."name" AS "playerName", p."team", lp."position" AS "slot"
      FROM selected l JOIN "User" u ON u."id"=l."userId"
      JOIN "LineupPlayer" lp ON lp."lineupId"=l."id" JOIN "Player" p ON p."id"=lp."playerId"
      ORDER BY l."id", array_position(ARRAY['PG','SG','SF','PF','C'],lp."position")`, `Lineup ${date}`);
    const lineups=new Map<string,RankingLineup>();
    for (const row of rows) {
      if (!lineups.has(row.id)) lineups.set(row.id,{id:row.id,name:row.name,isMe:row.userId===user.id,players:[]});
      lineups.get(row.id)!.players.push({id:row.playerId||'',name:row.playerName,team:row.team,slot:row.slot});
    }
    const [games,translations]=await Promise.all([loadRankingGames(date),loadPlayerNameTranslations(prisma)]);
    const entries=buildRanking([...lineups.values()],games);
    for (const entry of entries) for (const player of entry.players) player.name=translatePlayerName(player.name,translations);
    return NextResponse.json({date,entries,gameCount:games.length,complete:entries.every(e=>e.score!==null),fetchedAt:new Date().toISOString()},{headers});
  } catch {
    return NextResponse.json({error:'排名数据暂时不可用，请稍后重试。'},{status:503,headers});
  }
}
