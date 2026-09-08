import 'server-only';
import { normalizeTranslationName } from './player-name-translations';
import { scoreOfficialStats, type RankingGame } from './live-ranking';

function object(value: unknown): Record<string, unknown> { return value && typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}; }
function array(value: unknown): unknown[] { return Array.isArray(value)?value:[]; }
async function request(url: string) {
  const response = await fetch(url,{next:{revalidate:20},signal:AbortSignal.timeout(10000),headers:{Accept:'application/json, text/html','User-Agent':'Mozilla/5.0',Referer:'https://www.nba.com/'}});
  if (!response.ok) throw new Error('Official NBA feed unavailable');
  return response;
}
export async function loadRankingGames(date: string): Promise<RankingGame[]> {
  let schedule: Record<string,unknown>[] | null = null;
  try {
    const data=object(await (await request('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json')).json());
    const board=object(data.scoreboard);
    if (board.gameDate===date && Array.isArray(board.games)) schedule=board.games.map(object);
  } catch { /* The dated official games page is the fallback. */ }
  if (!schedule) {
    const html=await (await request(`https://www.nba.com/games?date=${date}`)).text();
    const json=html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    if (!json) throw new Error('NBA schedule unavailable');
    const page=object(object(object(JSON.parse(json)).props).pageProps);
    const modules=object(page.gameCardFeed).modules;
    if (page.selectedDate!==date || !Array.isArray(modules)) throw new Error('NBA date mismatch');
    schedule=modules.flatMap(m=>array(object(m).cards)).map(c=>object(object(c).cardData));
  }
  const unique=new Map(schedule.filter(g=>/^00\d{8}$/.test(String(g.gameId))).map(g=>[String(g.gameId),g]));
  return Promise.all([...unique].map(async ([id,game])=>{
    const result:RankingGame={id,status:Number(game.gameStatus)||0,teams:[object(game.homeTeam).teamTricode,object(game.awayTeam).teamTricode].filter((v):v is string=>typeof v==='string'),scores:{},names:{},available:false};
    if (result.teams.length!==2) throw new Error('Incomplete NBA schedule');
    if (result.status!==2&&result.status!==3) return result;
    try {
      const body=object(await (await request(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json`)).json());
      const box=object(body.game);
      if (String(box.gameId)!==id) return result;
      for (const value of [box.homeTeam,box.awayTeam]) {
        const team=object(value);
        if (!result.teams.includes(String(team.teamTricode))||!Array.isArray(team.players)||team.players.length===0) return result;
        for (const value of team.players) {
          const player=object(value),playerId=String(player.personId??'');
          if (!/^\d+$/.test(playerId)) continue;
          const score=scoreOfficialStats(object(player.statistics));
          if (score!==null) result.scores[playerId]=score;
          if (typeof player.name==='string') {
            const name=normalizeTranslationName(player.name);
            result.names[name]=Object.hasOwn(result.names,name)?'':playerId;
          }
        }
      }
      result.available=true;
    } catch { /* Keep unavailable scores explicit, never synthesize zero. */ }
    return result;
  }));
}
