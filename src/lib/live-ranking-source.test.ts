import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {loadRankingGames} from './live-ranking-source';
const stats={points:0,threePointersMade:0,fieldGoalsMade:0,fieldGoalsAttempted:0,freeThrowsMade:0,freeThrowsAttempted:0,reboundsOffensive:0,reboundsDefensive:0,assists:0,steals:0,blocks:0,turnovers:0};
afterEach(()=>vi.unstubAllGlobals());
it('reads every game including beyond six and handles incomplete box scores honestly',async()=>{
 const games=Array.from({length:8},(_,i)=>({gameId:'002260000'+i,gameStatus:2,homeTeam:{teamTricode:'BOS'},awayTeam:{teamTricode:'NYK'}}));
 const fetcher=vi.fn(async(url:string)=>{
   if(url.includes('scoreboard'))return Response.json({scoreboard:{gameDate:'2026-09-08',games}});
   const id=url.match(/boxscore_(\d+)/)?.[1];
   if(id===games[0].gameId)return new Response('',{status:502});
   return Response.json({game:{gameId:id,homeTeam:{teamTricode:'BOS',players:[{personId:1,name:'Player One',statistics:stats}]},awayTeam:{teamTricode:'NYK',players:[{personId:2,name:'Player Two',statistics:stats}]}}});
 });vi.stubGlobal('fetch',fetcher);
 const result=await loadRankingGames('2026-09-08');expect(result).toHaveLength(8);expect(result[0].available).toBe(false);expect(result[7].scores['1']).toBe(0);expect(fetcher).toHaveBeenCalledTimes(9);
});
it('uses only the selected date and rejects wrong-date fallback data',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('scoreboard')?Response.json({scoreboard:{gameDate:'2026-09-07',games:[]}}):new Response('<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{selectedDate:'2026-09-07',gameCardFeed:{modules:[]}}}})+'</script>')));
 await expect(loadRankingGames('2026-09-08')).rejects.toThrow('date mismatch');
});
it('does not fetch or expose box scores for scheduled games',async()=>{
 const fetcher=vi.fn(async()=>Response.json({scoreboard:{gameDate:'2026-09-08',games:[{gameId:'0022600001',gameStatus:1,homeTeam:{teamTricode:'BOS'},awayTeam:{teamTricode:'NYK'}}]}}));vi.stubGlobal('fetch',fetcher);
 const result=await loadRankingGames('2026-09-08');expect(fetcher).toHaveBeenCalledTimes(1);expect(result[0].scores).toEqual({});
});
