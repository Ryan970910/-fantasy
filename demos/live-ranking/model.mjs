export const initial = [
  { id: 'a', name: '湾区第六人', score: 1384, live: 1, waiting: 0, player: '斯蒂芬·库里', mark: '湾' },
  { id: 'b', name: '底角三分', score: 1326, live: 2, waiting: 0, player: '德文·布克', mark: '角' },
  { id: 'c', name: '禁区漫步', score: 1262, live: 1, waiting: 1, player: '尼古拉·约基奇', mark: '禁' },
  { id: 'me', name: '水哥', score: 1240, live: 2, waiting: 1, player: '杰森·塔图姆', mark: '水' },
  { id: 'e', name: '末节接管', score: 1208, live: 2, waiting: 0, player: '扬尼斯·阿德托昆博', mark: '末' },
  { id: 'f', name: '不投长两分', score: 1175, live: 0, waiting: 0, player: '凯文·杜兰特', mark: '两' },
  { id: 'g', name: '篮板收藏家', score: 1138, live: 1, waiting: 1, player: '安东尼·戴维斯', mark: '板' },
  { id: 'h', name: '凌晨看球', score: 1064, live: 0, waiting: 0, player: '勒布朗·詹姆斯', mark: '晨' }
];
export const events = [
  { id: 'me', points: 45, action: '命中三分', detail: '演示加分 +4.5' },
  { id: 'e', points: 90, action: '连续得分', detail: '演示加分 +9.0' },
  { id: 'me', points: 50, action: '抢断后助攻', detail: '演示加分 +5.0' },
  { id: 'b', points: 35, action: '跳投命中', detail: '演示加分 +3.5' },
  { id: 'me', points: 70, action: '连续得分', detail: '演示加分 +7.0' },
  { id: 'a', points: 25, action: '助攻队友', detail: '演示加分 +2.5' },
  { id: 'me', points: 60, action: '命中关键球', detail: '演示加分 +6.0' }
];
export function ranked(users) {
  const sorted = [...users].sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
  return sorted.map((u,i) => ({...u, rank: sorted.findIndex(p=>p.score===u.score)+1}));
}
export function applyEvent(users,event) {
  if (!Number.isInteger(event.points) || event.points < 0) throw new Error('Invalid demo points');
  return users.map(u => u.id===event.id && u.live>0 ? {...u,score:u.score+event.points,lineup:u.lineup.map(p=>p.id===u.featuredId&&p.status==='live'?{...p,score:p.score+event.points}:p)} : {...u});
}
export function nearby(users,id) {
  const index=users.findIndex(u=>u.id===id);
  return index<0 ? [] : users.slice(Math.max(0,index-2),index+3);
}

// Demo-only five-slot lineups. Player IDs remain separate from display names.
const pool = {
  PG: [{id:'curry',name:'斯蒂芬·库里'},{id:'brunson',name:'杰伦·布伦森'}],
  SG: [{id:'booker',name:'德文·布克'},{id:'mitchell',name:'多诺万·米切尔'}],
  SF: [{id:'tatum',name:'杰森·塔图姆'},{id:'durant',name:'凯文·杜兰特'},{id:'james',name:'勒布朗·詹姆斯'}],
  PF: [{id:'giannis',name:'扬尼斯·阿德托昆博'},{id:'davis',name:'安东尼·戴维斯'}],
  C: [{id:'jokic',name:'尼古拉·约基奇'},{id:'sengun',name:'阿尔佩伦·申京'}]
};
const featured = {a:'curry',b:'booker',c:'jokic',me:'tatum',e:'giannis',f:'durant',g:'davis',h:'james'};
for (const [index,user] of initial.entries()) {
  user.lineup = Object.entries(pool).map(([position,players]) => ({
    ...(players.find(p=>p.id===featured[user.id]) ?? players[index%players.length]),
    position,status:'finished',score:0
  }));
  const ordered = [...user.lineup].sort((a,b)=>Number(b.id===featured[user.id])-Number(a.id===featured[user.id]));
  ordered.forEach((p,i)=>{p.status=i<user.live?'live':i>=5-user.waiting?'scheduled':'finished'});
  const started = visibleLineup(user);
  started.forEach((p,i)=>{p.score=Math.floor(user.score/started.length)+(i<user.score%started.length?1:0)});
  user.featuredId = featured[user.id];
}
export function visibleLineup(user) {
  return user.lineup.filter(p=>p.status==='live'||p.status==='finished');
}
