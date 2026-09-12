"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Shirt } from "lucide-react";
import type { RankingResponse } from "@/lib/live-ranking";
type SavedLineup = { id: string; gameDate: string | null; totalSalary: number; players: Array<{ id: string; slot: string; name: string; team: string }> };
export function RetroHomeData({ date, section }: { date: string; section: "team" | "rankings" }) {
  const [lineup, setLineup] = useState<SavedLineup | null>(null);
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [state, setState] = useState("正在读取…");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState("正在读取…");
    async function load() {
      try {
        const response = await fetch(section === "team" ? "/api/lineups" : `/api/rankings?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { window.location.assign("/login"); return; }
        if (!response.ok) throw new Error("unavailable");
        if (section === "team") {
          const data: { lineups: SavedLineup[] } = await response.json();
          if (!controller.signal.aborted) setLineup(data.lineups[0] ?? null);
        } else {
          const data: RankingResponse = await response.json();
          if (!controller.signal.aborted) setRanking(data);
        }
        if (!controller.signal.aborted) setState("");
      } catch { if (!controller.signal.aborted) setState("数据暂时不可用，请重试。"); }
    }
    void load();
    return () => controller.abort();
  }, [date, section, retry]);
  return <section className={`retroPaper retroHomeData retroHome${section}`}>
    <header><h2>{section === "team" ? "MY TEAM" : "LEAGUE LEADERBOARD"}<small>{section === "team" ? "最近保存的阵容" : "比赛日排名"}</small></h2><Link href={section === "team" ? "/lineups" : "/rankings"} aria-label={section === "team" ? "管理我的阵容" : "查看完整排名"}><ArrowRight aria-hidden="true" /></Link></header>
    {state ? <p role="status">{state}{state.includes("重试") && <button onClick={() => setRetry(value => value + 1)}>重试</button>}</p> : section === "team" ? <>
      <div className="retroFive">{["PG", "SG", "SF", "PF", "C"].map(slot => { const player = lineup?.players.find(item => item.slot === slot); return <Link href="/lineups" key={slot}><span className="retroJersey"><Shirt aria-hidden="true" /><b>{slot}</b></span><strong>{player?.name ?? "待选球员"}</strong><small>{player?.team ?? slot}</small></Link>; })}</div>
      <footer><span>{lineup ? `比赛日 ${lineup.gameDate ?? "未标注"}` : "选好五人，准备上场。"}<small>{lineup ? `保存时薪资 $${lineup.totalSalary}` : "PG / SG / SF / PF / C"}</small></span><Link className="retroAction" href="/lineups">管理阵容 <ArrowRight aria-hidden="true" /></Link></footer>
    </> : <>
      <p className="retroDataDate">{date} · 美东比赛日</p>
      {ranking?.entries.length ? <ol className="retroMiniRanking">{ranking.entries.slice(0, 5).map(entry => <li key={entry.id}><span>{entry.rank ?? "—"}</span><strong>{entry.name}{entry.isMe && <small>你</small>}</strong><b>{entry.score === null ? "—" : entry.score.toFixed(1)}</b></li>)}</ol> : <p className="retroQuiet">{ranking?.gameCount ? "这个比赛日还没有人提交阵容。" : "这个比赛日暂无 NBA 比赛。"}<Link href="/rankings">切换日期查看历史排名 →</Link></p>}
      {ranking && !ranking.complete && <p>部分技术统计暂缺，名次待更新。</p>}
    </>}
  </section>;
}
