'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LocateFixed, RefreshCw } from 'lucide-react';
import type { RankingEntry, RankingResponse } from '@/lib/live-ranking';

const scoreText=(score:number|null)=>score===null?'—':score.toFixed(1);
function Score({value}:{value:number|null}) {
  const node=useRef<HTMLSpanElement>(null);
  const previous=useRef(value);
  useEffect(()=>{
    const from=previous.current;previous.current=value;
    if (!node.current) return;
    if (value===null||from===null||matchMedia('(prefers-reduced-motion: reduce)').matches) {node.current.textContent=scoreText(value);return;}
    const start=performance.now();let frame=0;
    const tick=(time:number)=>{const t=Math.min(1,(time-start)/600);if(node.current)node.current.textContent=(from+(value-from)*(1-(1-t)**3)).toFixed(1);if(t<1)frame=requestAnimationFrame(tick)};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[value]);
  return <span ref={node}>{scoreText(value)}</span>;
}
export function LiveRanking({initialDate}:{initialDate:string}) {
  const [date,setDate]=useState(initialDate);
  const [data,setData]=useState<RankingResponse|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [near,setNear]=useState(false);
  const [retry,setRetry]=useState(0);
  const [changes,setChanges]=useState<Record<string,number>>({});
  const [feed,setFeed]=useState<string[]>([]);
  const previous=useRef<RankingResponse|null>(null);
  const race=useRef<HTMLDivElement>(null);
  const positions=useRef(new Map<string,number>());
  useEffect(()=>{
    const controller=new AbortController();let busy=false;
    async function refresh(){
      if(busy||document.hidden)return;busy=true;setLoading(true);
      try {
        const response=await fetch(`/api/rankings?date=${encodeURIComponent(date)}`,{cache:'no-store',signal:controller.signal});
        if(response.status===401||response.redirected&&new URL(response.url).pathname==='/login'){window.location.assign('/login');return;}
        if(!response.ok)throw new Error(previous.current?.date===date?'更新失败，保留上次结果。请稍后重试。':'排名暂时不可用，请稍后重试。');
        const next:RankingResponse=await response.json();
        if(controller.signal.aborted)return;
        const old=previous.current?.date===date?previous.current:null;
        const moves:Record<string,number>={},updates:string[]=[];
        if(old)for(const entry of next.entries){const before=old.entries.find(e=>e.id===entry.id);if(before&&entry.score!==null&&before.score!==null){const delta=Math.round((entry.score-before.score)*10)/10;if(delta){updates.push(`${entry.name} ${delta>0?'+':''}${delta.toFixed(1)} 分${entry.rank?'，当前第 '+entry.rank+' 名':''}`);}if(before.rank&&entry.rank)moves[entry.id]=before.rank-entry.rank;}}
        positions.current=new Map(Array.from(race.current?.querySelectorAll<HTMLElement>('[data-entry]')??[]).map(el=>[el.dataset.entry!,el.getBoundingClientRect().top]));
        previous.current=next;setData(next);setChanges(moves);setError('');
        if(updates.length)setFeed(items=>[...updates,...items].slice(0,12));
      } catch{if(!controller.signal.aborted)setError(previous.current?.date===date?'更新失败，保留上次结果。请稍后重试。':'排名暂时不可用，请稍后重试。');}
      finally{busy=false;if(!controller.signal.aborted)setLoading(false);}
    }
    void refresh();const timer=setInterval(()=>void refresh(),30000);
    const visible=()=>{if(!document.hidden)void refresh()};document.addEventListener('visibilitychange',visible);
    return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible)};
  },[date,retry]);
  useLayoutEffect(()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    race.current?.querySelectorAll<HTMLElement>('[data-entry]').forEach(el=>{const old=positions.current.get(el.dataset.entry!);if(old!==undefined){const dy=old-el.getBoundingClientRect().top;if(Math.abs(dy)>1)el.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});}});
    positions.current.clear();
  },[data]);
  const entries=data?.entries??[],myIndex=entries.findIndex(e=>e.isMe),me=entries[myIndex];
  const shown=near&&me?entries.slice(Math.max(0,myIndex-2),myIndex+3):entries;
  const rival=entries[myIndex===0?1:myIndex-1];
  const gap=me?.score!==null&&rival?.score!==null&&me&&rival?Math.abs(me.score-rival.score):null;
  const locate=()=>{const card=race.current?.querySelector<HTMLElement>('[data-mine="true"]');card?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});card?.querySelector('summary')?.focus({preventScroll:true});};
  function selectDate(value:string){if(!value)return;setDate(value);setData(null);previous.current=null;setFeed([]);setChanges({});setNear(false);setError('');setLoading(true);}
  return <section className="rankingBoard">
    <header className="rankingHeading"><div><h1>每一分，都在改写排名。</h1><p>五人上阵，看看谁能笑到最后。</p></div><label>NBA 比赛日（美东）<input aria-label="NBA 比赛日" type="date" value={date} onChange={e=>selectDate(e.target.value)}/></label></header>
    <div className="rankingStatus"><span>{loading?'正在更新…':error?'更新中断':data?'每 30 秒自动更新':'等待数据'}{data&&` · 上次获取 ${new Date(data.fetchedAt).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})} 北京时间`}</span><button disabled={loading} onClick={()=>setRetry(n=>n+1)}><RefreshCw size={15} aria-hidden="true"/>刷新</button></div>
    {error&&<p role="alert" className="rankingNotice">{error}</p>}
    {data&&!data.complete&&<p className="rankingNotice">部分球员技术统计暂缺，暂不显示名次。已获取的分数仅供参考。</p>}
    <div className="rankingLayout"><div>
      {me?<section className="rankingMine" aria-label="我的排名"><div className="rankingMineTop"><span>{me.name} <small>你</small></span><span>{changes[me.id]>0?`上升 ${changes[me.id]} 位`:changes[me.id]<0?`下降 ${-changes[me.id]} 位`:'我的阵容'}</span></div><div className="rankingNumbers"><strong>{me.rank?'#'+me.rank:'—'}</strong><div><b><Score value={me.score}/></b><small>阵容梦幻分</small></div><div className="rankingGap"><small>{myIndex===0?'领先下一名':'距离上一名'}</small><b>{scoreText(gap)} <small>分</small></b></div></div><div className="rankingMineFoot"><span>{me.live} 人比赛中 · {me.waiting} 人未公开</span><button onClick={locate}><LocateFixed size={14} aria-hidden="true"/>定位我的卡片</button></div></section>:data&&<div className="rankingEmpty">你在这个比赛日还没有阵容。<Link href="/lineups">前往我的阵容</Link></div>}
      <div className="rankingRaceHeading"><h2>排名赛道 <small>{entries.length} 位参与者</small></h2><div aria-label="排名范围"><button aria-pressed={!near} onClick={()=>setNear(false)}>全部</button><button aria-pressed={near} disabled={!me} onClick={()=>setNear(true)}>我的附近</button></div></div>
      <p className="rankingHint">{near?'展示你与前后各两位对手，保留全榜名次':'按本比赛日梦幻分排名，同分并列。'}</p>
      {loading&&!data&&<p role="status" className="rankingEmpty">正在读取比赛和阵容…</p>}
      {data&&!entries.length&&<p className="rankingEmpty">{data.gameCount?'这个比赛日还没有人提交阵容。':'这个比赛日暂无 NBA 比赛。'}你可以切换日期查看。</p>}
      <div className="rankingRace" ref={race}>{shown.map(entry=><RankingCard key={`${date}:${entry.id}`} entry={entry} movement={changes[entry.id]??0}/>)}</div>
      <p className="rankingRules">每人展示本比赛日最近保存的一份阵容。未开赛球员暂不公开，已完赛球员保留。分数来自 NBA 官方逐场技术统计，沿用现有梦幻分公式；上游修正或投失球也可能使分数下降。</p>
    </div><aside className="rankingActivity"><h2>场边动态</h2><p aria-live="polite">{feed[0]??'比赛数据更新后，这里会显示分数变化。'}</p><ol>{feed.slice(1).map((item,i)=><li key={i}>{item}</li>)}</ol><p className="rankingHint">动态仅记录本次打开页面后的变化。</p></aside></div>
  </section>;
}
function RankingCard({entry,movement}:{entry:RankingEntry;movement:number}) {
  const [open,setOpen]=useState(false);
  return <article data-entry={entry.id} data-mine={entry.isMe} className={`rankingRunner${entry.isMe?' mine':''}${entry.rank===1?' leader':''}`}><details open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary aria-label={`${entry.name}，${entry.rank?'第 '+entry.rank+' 名':'名次待定'}，${open?'收起':'查看'}已开赛阵容`}><span className="rankingRank"><b>{entry.rank?String(entry.rank).padStart(2,'0'):'—'}</b><small>{movement>0?'↑ '+movement:movement<0?'↓ '+Math.abs(movement):entry.rank===1?'领先':''}</small></span><span className="rankingAvatar" aria-hidden="true">{Array.from(entry.name)[0]||'球'}</span><span className="rankingIdentity"><strong>{entry.name}{entry.isMe&&<em>你</em>}</strong><small>{entry.live} 人比赛中{entry.waiting?` · ${entry.waiting} 人未公开`:entry.live?'':' · 全部完赛'}</small></span><span className="rankingScore"><b><Score value={entry.score}/></b><small>{open?'收起详情':'查看详情'}</small></span></summary><div className="rankingDetails"><h3>已开赛阵容 · {entry.players.length}/5 人</h3><p>{entry.players.length?'未开赛球员暂不公开 · 梦幻分':'暂无球员开赛，开赛后显示阵容。'}</p><ul>{entry.players.map(player=><li key={player.slot}><span className="rankingPosition">{player.slot}</span><span><strong>{player.name}</strong><small>{player.team} · {player.status==='live'?'比赛中':'已完赛'}{player.score===null?' · 统计待更新':''}</small></span><b><Score value={player.score}/></b></li>)}</ul></div></details></article>;
}
