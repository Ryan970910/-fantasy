import {strict as assert} from 'node:assert';
import {initial,events,ranked,applyEvent,nearby,visibleLineup} from './model.mjs';
const source=structuredClone(initial);
const first=ranked(applyEvent(source,events[0]));
assert.equal(first.find(p=>p.id==='me').rank,3);
assert.equal(source.find(p=>p.id==='me').score,1240);
let users=source;for(const event of events)users=applyEvent(users,event);
assert.equal(ranked(users)[0].id,'me');
assert.equal(users.find(p=>p.id==='me').score,1465);
assert.deepEqual(ranked([{id:'a',score:100},{id:'b',score:100},{id:'c',score:90}]).map(p=>p.rank),[1,1,3]);
assert.equal(applyEvent(source,{id:'f',points:20}).find(p=>p.id==='f').score,1175);
assert.deepEqual(nearby(first,'me').map(p=>p.rank),[1,2,3,4,5]);
assert.throws(()=>applyEvent(source,{id:'me',points:.5}));
console.log('PASS: overtake, stable tie ranks, integer scoring, finished players, nearby window, reset source, final leader');

for (const user of initial) {
  assert.equal(user.lineup.length,5);
  assert.equal(new Set(user.lineup.map(p=>p.position)).size,5);
  assert.equal(visibleLineup(user).length,5-user.waiting);
  assert.equal(user.lineup.filter(p=>p.status==='live').length,user.live);
  assert.equal(visibleLineup(user).reduce((sum,p)=>sum+p.score,0),user.score);
}
assert.equal(visibleLineup(initial.find(u=>u.id==='me')).length,4);
assert.equal(visibleLineup(initial.find(u=>u.id==='f')).length,5);
assert.equal(visibleLineup({lineup:[{status:'scheduled'},{status:'unknown'}]}).length,0);
const updatedMe=first.find(u=>u.id==='me');
assert.equal(updatedMe.lineup.find(p=>p.id==='tatum').score,355);
assert.equal(updatedMe.lineup.reduce((sum,p)=>sum+p.score,0),updatedMe.score);
console.log('PASS: five-slot lineups, hide unstarted players, retain finished players, empty lineup, per-player scores');
