import { fantasyScore } from './player-pricing';
import { normalizeTranslationName } from './player-name-translations';

export type RankingPlayer = { id: string; name: string; team: string; slot: string };
export type RankingLineup = { id: string; name: string; isMe: boolean; players: RankingPlayer[] };
export type RankingGame = { id: string; status: number; teams: string[]; scores: Record<string, number>; names: Record<string, string>; available: boolean };
export type RankingEntry = {
  id: string; name: string; isMe: boolean; score: number | null; rank: number | null;
  live: number; waiting: number; players: Array<RankingPlayer & { status: 'live' | 'finished'; score: number | null }>;
};
export type RankingResponse = { date: string; fetchedAt: string; entries: RankingEntry[]; gameCount: number; complete: boolean };

export function buildRanking(lineups: RankingLineup[], games: RankingGame[]): RankingEntry[] {
  const entries = lineups.map(lineup => {
    let waiting = 0;
    let live = 0;
    let missing = false;
    const players: RankingEntry['players'] = [];
    for (const player of lineup.players) {
      const game = games.find(g=>g.teams.includes(player.team));
      // Fail closed: only an explicit official in-progress/final status reveals a player.
      if (!game || (game.status !== 2 && game.status !== 3)) { waiting++; continue; }
      if (game.status === 2) live++;
      const officialId = /^\d+$/.test(player.id) ? player.id : game.names[normalizeTranslationName(player.name)];
      const score = game.available && officialId && Object.hasOwn(game.scores,officialId) ? game.scores[officialId] : null;
      if (score === null) missing = true;
      players.push({...player, status: game.status === 3 ? 'finished' : 'live', score});
    }
    return {id:lineup.id,name:lineup.name,isMe:lineup.isMe,players,live,waiting,
      score:missing?null:Math.round(players.reduce((sum,p)=>sum+(p.score??0),0)*10)/10,rank:null as number|null};
  });
  entries.sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||a.id.localeCompare(b.id));
  // Missing box scores must not produce a misleading ordinal ranking.
  if (entries.every(e=>e.score!==null)) entries.forEach((entry,i)=>{entry.rank=i&&entry.score===entries[i-1].score?entries[i-1].rank:i+1});
  return entries;
}

export function scoreOfficialStats(stats: Record<string, unknown>): number | null {
  const keys = ['points','threePointersMade','fieldGoalsMade','fieldGoalsAttempted','freeThrowsMade','freeThrowsAttempted','reboundsOffensive','reboundsDefensive','assists','steals','blocks','turnovers'];
  if (!keys.every(k=>typeof stats[k]==='number'&&Number.isFinite(stats[k])&&(stats[k] as number)>=0)) return null;
  return Math.round(fantasyScore({...stats,threesMade:stats.threePointersMade,offensiveRebounds:stats.reboundsOffensive,defensiveRebounds:stats.reboundsDefensive})*10)/10;
}
