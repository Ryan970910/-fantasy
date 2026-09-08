import { describe, expect, it } from 'vitest';
import { buildRanking, scoreOfficialStats, type RankingGame, type RankingLineup } from './live-ranking';
const game:RankingGame={id:'0022600001',status:2,teams:['BOS','NYK'],available:true,scores:{'1':12.4,'2':0},names:{'real name':'1'}};
const lineup:RankingLineup={id:'lineup',name:'User',isMe:true,players:[{id:'1',name:'Real Name',team:'BOS',slot:'SF'},{id:'secret',name:'Hidden Name',team:'LAL',slot:'C'}]};
describe('live rankings',()=>{
  it('never serializes unstarted players and retains final-game players',()=>{
    for(const status of [2,3]) {const result=buildRanking([lineup],[{...game,status}])[0];expect(result.players).toHaveLength(1);expect(JSON.stringify(result)).not.toContain('Hidden');expect(JSON.stringify(result)).not.toContain('secret');expect(result.waiting).toBe(1);expect(result.score).toBe(12.4);}
    for(const status of [0,1,4]) expect(buildRanking([lineup],[{...game,status}])[0].players).toEqual([]);
  });
  it('keeps unavailable stats null and suspends ranking across the board',()=>{
    const result=buildRanking([lineup,{...lineup,id:'other',players:[]}],[{...game,available:false}]);
    expect(result.every(e=>e.rank===null)).toBe(true);expect(result.find(e=>e.id==='lineup')?.score).toBeNull();
    expect(buildRanking([{...lineup,players:[{...lineup.players[0],id:'999'}]}],[game])[0].score).toBeNull();
  });
  it('uses official IDs, accepts zero DNP scores, and only falls back to normalized English names for legacy IDs',()=>{
    expect(buildRanking([{...lineup,players:[{...lineup.players[0],id:'2'}]}],[game])[0].score).toBe(0);
    expect(buildRanking([{...lineup,players:[{...lineup.players[0],id:'legacy'}]}],[game])[0].score).toBe(12.4);
    expect(buildRanking([{...lineup,players:[{...lineup.players[0],id:'legacy',name:'中文'}]}],[game])[0].score).toBeNull();
  });
  it('uses competition ties and preserves negative official corrections',()=>{
    const result=buildRanking([lineup,{...lineup,id:'second'},{...lineup,id:'third',players:[{...lineup.players[0],id:'2'}]}],[game]);
    expect(result.map(e=>e.rank)).toEqual([1,1,3]);
    expect(buildRanking([lineup],[{...game,scores:{'1':-1.2}}])[0].score).toBe(-1.2);
  });
  it('requires complete stats and uses the shared full fantasy formula',()=>{
    const stats={points:28,threePointersMade:2,fieldGoalsMade:10,fieldGoalsAttempted:19,freeThrowsMade:6,freeThrowsAttempted:7,reboundsOffensive:1,reboundsDefensive:7,assists:7,steals:2,blocks:1,turnovers:3};
    expect(scoreOfficialStats(stats)).toBe(43.9);
    expect(scoreOfficialStats({points:28})).toBeNull();
    expect(scoreOfficialStats({...stats,assists:NaN})).toBeNull();
  });
});
