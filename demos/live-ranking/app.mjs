import {initial,events,ranked,applyEvent,nearby,visibleLineup} from './model.mjs';
const $=id=>document.getElementById(id);
let users=structuredClone(initial), step=0, playing=false, timer=null, near=false, busy=false, unlock=null, version=0;
const cards=new Map();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const fmt=n=>(n/10).toFixed(1);
function numeric(node,to,animate){const from=Number(node.textContent)||0; const end=to/10; if(!animate||reduced.matches){node.textContent=end.toFixed(1);return}const start=performance.now(),v=version;function frame(now){if(v!==version)return;const t=Math.min(1,(now-start)/650);node.textContent=(from+(end-from)*(1-(1-t)**3)).toFixed(1);if(t<1)requestAnimationFrame(frame)}requestAnimationFrame(frame)}
function makeCard(user){const article=document.createElement('article');article.className='runner';article.dataset.id=user.id;article.innerHTML='<details><summary><span class="rank"><b></b><span class="movement"></span></span><span class="monogram"></span><span class="identity"><strong></strong><small></small></span><span class="score"><b>0.0</b><span></span></span></summary><div class="runnerDetails"></div></details>';article.querySelector('.monogram').textContent=user.mark;const name=article.querySelector('.identity strong');name.textContent=user.name;if(user.id==='me'){const em=document.createElement('em');em.textContent='你';name.append(em)}return article}
function render(event=null,previous=[]){version++;const standings=ranked(users), me=standings.find(u=>u.id==='me'),index=standings.findIndex(u=>u.id==='me');const positions=new Map([...cards].filter(([,card])=>card.isConnected).map(([id,card])=>[id,card.getBoundingClientRect()]));const visible=near?nearby(standings,'me'):standings;const active=document.activeElement;
for(const u of standings){if(!cards.has(u.id))cards.set(u.id,makeCard(u));const card=cards.get(u.id);const old=previous.find(p=>p.id===u.id);const delta=old?old.rank-u.rank:0;card.className=`runner${u.id==='me'?' mine':''}${u.rank===1?' leader':''}${u.live===0&&u.waiting===0?' finished':''}`;card.querySelector('.rank>b').textContent=String(u.rank).padStart(2,'0');const move=card.querySelector('.movement');move.textContent=delta>0?`↑ ${delta}`:delta<0?`↓ ${-delta}`:u.rank===1?'领先':'';move.className='movement'+(delta>0?' up':delta<0?' down':'');card.querySelector('.identity small').textContent=u.live?`${u.live} 人比赛中${u.waiting?' · '+u.waiting+' 人待赛':''}`:u.waiting?`${u.waiting} 人未开赛`:'全部完赛';numeric(card.querySelector('.score>b'),u.score,event?.id===u.id);const note=card.querySelector('.score>span');note.textContent=event?.id===u.id?`+${fmt(event.points)} 刚刚得分`:u.rank===1?'暂居榜首':'查看详情';note.className=event?.id===u.id?'gain':'';renderLineup(card,u);card.querySelector('summary').setAttribute('aria-label',`第 ${u.rank} 名，${u.name}${u.id==='me'?'，你':''}，${fmt(u.score)} 分，查看已开赛阵容`);}
for(const [id,card]of cards){if(!visible.some(u=>u.id===id))card.remove()}
for(const u of visible)$('race').append(cards.get(u.id));
for(const u of visible){const card=cards.get(u.id);if(!reduced.matches&&event&&positions.has(u.id)){const dy=positions.get(u.id).top-card.getBoundingClientRect().top;if(Math.abs(dy)>1)card.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:700,easing:'cubic-bezier(.22,1,.36,1)'});if(event.id===u.id)card.animate([{outline:'2px solid #d9be83',outlineOffset:'2px'},{outline:'2px solid transparent',outlineOffset:'2px'}],{duration:1200});}}
if(active&&$('race').contains(active))active.focus({preventScroll:true});
$('my-rank').textContent='#'+me.rank;numeric($('my-score'),me.score,event?.id==='me');$('gap-label').textContent=index===0?'领先下一名':'距离上一名';const gap=index===0?me.score-standings[1].score:standings[index-1].score-me.score;$('gap').innerHTML=fmt(gap)+' <small>分</small>';
const oldMe=previous.find(u=>u.id==='me');$('my-change').textContent=!event?'等待下一次得分':me.rank===1?'登顶，守住这一分优势':oldMe&&oldMe.rank>me.rank?`上升 ${oldMe.rank-me.rank} 位`:oldMe&&oldMe.rank<me.rank?`下降 ${me.rank-oldMe.rank} 位`:'排名不变，继续追赶';
$('race-hint').textContent=near?'只展示你与前后各两位对手，保留全榜名次':'按本比赛日模拟总分排名';$('all').setAttribute('aria-pressed',String(!near));$('near').setAttribute('aria-pressed',String(near));$('step').textContent=step===events.length?'本轮演示结束':step?`已演示 ${step} / ${events.length} 次`:'准备开场';$('progress').textContent=step===events.length?'重置后可再看一次':'7 次得分，见证排名变化';$('next').disabled=busy||step===events.length;$('play').disabled=step===events.length;
}
function stop(){playing=false;clearInterval(timer);timer=null;$('play').textContent='自动演示';$('play').setAttribute('aria-pressed','false');$('live-state').textContent=step===events.length?'演示已结束':'演示已暂停';$('live-state').classList.remove('playing')}
function next(){if(busy||step>=events.length)return;busy=true;const previous=ranked(users),event=events[step++];users=applyEvent(users,event);const after=ranked(users),u=after.find(u=>u.id===event.id),old=previous.find(p=>p.id===u.id);const message=`${u.name}${u.id==='me'?'（你）':''} +${fmt(event.points)} 分${u.rank<old.rank?'，反超至第 '+u.rank+' 名':'，目前第 '+u.rank+' 名'}。`;$('announcement').textContent=message;const li=document.createElement('li');const meta=document.createElement('span');meta.textContent='得分事件 '+step+' / '+events.length;const text=document.createElement('p');const strong=document.createElement('strong');strong.textContent=u.player+' · '+event.action;text.append(strong,document.createElement('br'),message);li.append(meta,text);$('feed').prepend(li);$('feed').querySelector('.introEvent')?.remove();$('event-count').textContent=step+' 次更新';render(event,previous);if(step===events.length)stop();unlock=setTimeout(()=>{busy=false;$('next').disabled=step===events.length},750)}
$('next').onclick=next;
$('play').onclick=()=>{if(playing){stop();return}if(step===events.length)return;playing=true;$('play').textContent='暂停演示';$('play').setAttribute('aria-pressed','true');$('live-state').textContent='自动演示中';$('live-state').classList.add('playing');timer=setInterval(next,4000);next()};
$('reset').onclick=()=>{stop();clearTimeout(unlock);busy=false;step=0;users=structuredClone(initial);for(const card of cards.values())for(const animation of card.getAnimations())animation.cancel();$('feed').replaceChildren();$('announcement').textContent='已重置。下一次得分，水哥将冲到第 3 名。';$('event-count').textContent='尚未开始';$('live-state').textContent='演示已暂停';render()};
$('all').onclick=()=>{near=false;render();};$('near').onclick=()=>{near=true;render();};
$('locate').onclick=()=>{const card=cards.get('me');card.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});card.querySelector('summary').focus({preventScroll:true})};
$('viewport').onclick=()=>{document.body.classList.toggle('phone');$('viewport').textContent=document.body.classList.contains('phone')?'桌面视图':'手机视图'};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
render();



function renderLineup(card,user) {
  const panel=card.querySelector('.runnerDetails');
  const players=visibleLineup(user);
  const heading=document.createElement('p');
  heading.className='lineupHeading';
  heading.textContent=`已开赛阵容 · ${players.length}/5 人`;
  const note=document.createElement('p');
  note.className='lineupNote';
  note.textContent=players.length?'未开赛球员暂不公开 · 以下为模拟梦幻分':'暂无球员开赛，开赛后显示阵容。';
  const list=document.createElement('ul');
  list.className='lineupList';
  for(const player of players){
    const row=document.createElement('li');
    const position=document.createElement('span');
    position.className='lineupPosition';position.textContent=player.position;
    const identity=document.createElement('span');
    identity.className='lineupIdentity';
    const name=document.createElement('strong');name.textContent=player.name;
    const status=document.createElement('small');status.textContent=player.status==='live'?'比赛中':'已完赛';
    identity.append(name,status);
    const score=document.createElement('b');score.textContent=fmt(player.score);
    row.append(position,identity,score);list.append(row);
  }
  panel.replaceChildren(heading,note,list);
}
