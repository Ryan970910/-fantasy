"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Game = { gameId: string; statusText: string; homeTeam: { tricode: string; score: number }; awayTeam: { tricode: string; score: number } };
export function StreetScoreboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [status, setStatus] = useState("正在读取 NBA 比赛…");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    async function load() {
      try {
        const response = await fetch("/api/nba/live", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const body: { games: Game[]; gameDate: string | null } = await response.json();
        if (controller.signal.aborted) return;
        setGames(body.games);
        setStatus(body.games.length ? `NBA 比赛 / ${body.gameDate ?? "最新赛程"}` : "当前暂无 NBA 比赛");
      } catch {
        if (!controller.signal.aborted) setStatus("NBA 比赛数据暂时不可用，请稍后刷新。");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [retry]);
  return <section className="streetScoreboard" aria-label="NBA 比赛"><header><p role="status">{status}</p><button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)} aria-label="刷新 NBA 比赛"><RefreshCw aria-hidden="true" />刷新</button></header><div>{games.map(game => <article key={game.gameId}><small>{game.statusText}</small><strong>{game.awayTeam.tricode} <b>{game.awayTeam.score} : {game.homeTeam.score}</b> {game.homeTeam.tricode}</strong></article>)}</div></section>;
}
