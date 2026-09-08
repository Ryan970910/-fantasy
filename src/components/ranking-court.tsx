"use client";

import { useState } from "react";
import type { RankingEntry } from "@/lib/live-ranking";

export function RankingCourt({ entries }: { entries: RankingEntry[] }) {
  const [owner, setOwner] = useState("");
  const [slot, setSlot] = useState("");
  const selected = entries.find(entry => entry.id === owner) ?? entries.find(entry => entry.isMe) ?? entries[0];
  const player = selected?.players.find(item => item.slot === slot) ?? selected?.players[0];
  if (!selected) return null;
  return <section className="rankingCourtPanel" aria-label="已开赛阵容球场">
    <label>查看球场<select aria-label="选择用户阵容" value={selected.id} onChange={event => { setOwner(event.target.value); setSlot(""); }}>{entries.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
    <div className="rankingCourt"><span className="rankingCourtHoop" aria-hidden="true" />{selected.players.map(item => <button key={item.slot} data-slot={item.slot} aria-pressed={player?.slot === item.slot} onClick={() => setSlot(item.slot)} aria-label={`${item.slot} ${item.name}`}><b>{item.slot}</b><span>{item.name}</span></button>)}</div>
    <p className="rankingHint">已开赛 {selected.players.length} / 5 人 · 未开赛球员隐藏</p>
    {player && <div className="rankingCourtFocus"><strong>{player.name}<small>{player.team} · {player.status === "live" ? "比赛中" : "已完赛"}</small></strong><b>{player.score === null ? "—" : player.score.toFixed(1)}</b></div>}
  </section>;
}
