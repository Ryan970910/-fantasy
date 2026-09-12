"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, X, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { matchesIntelPlayer } from "@/lib/player-intel-search";

import { PageBackLink } from "@/components/page-back-link";

type IntelPlayer = {
  nbaPlayerId: string;
  playerName: string;
  englishName: string;
  team: string;
  opponent: string;
  opponentName: string;
  roleChange: number;
  todayScore: number;
  tier: "S" | "A" | "B" | "C";
  recentFantasyPoints: number;
  minutesChange: number;
  usageChange: number;
  fieldGoalsAttemptedChange: number;
  assistsChange: number;
  matchupScore: number;
  paceScore: number;
};

function change(value: number, suffix = "") {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
}

export function PlayerIntelBoard({ players, emptyMessage, initialQuery = "" }: { players: IntelPlayer[]; emptyMessage?: string; initialQuery?: string }) {
  const [sort, setSort] = useState<"today" | "role">("today");
  const [query, setQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sorted = useMemo(
    () => [...players].sort((left, right) => sort === "today" ? right.todayScore - left.todayScore : right.roleChange - left.roleChange),
    [players, sort]
  );
  const matches = sorted.filter(player => matchesIntelPlayer(player, query));
  const featured = players.find(player => player.nbaPlayerId === selectedId) ?? (!query ? sorted[0] : undefined);
  const searching = Boolean(query.trim() && !selectedId);
  function select(player: IntelPlayer) { setSelectedId(player.nbaPlayerId); setQuery(player.playerName); }

  return (
    <section className="playerIntelBoard" aria-labelledby="player-intel-title">
      <header className="playerIntelHeader">
        <div>
          <PageBackLink href="/pregame-intel">返回赛前情报</PageBackLink>
          <h1 id="player-intel-title" className="streetTitle"><span>PLAYER INTEL</span><small>球员情报</small></h1>
          <p>角色变化反映近 5 场相对此前 10 场的球队角色；今日推荐结合近期表现、对手与比赛节奏。</p>
        </div>
        <div className="intelSort" aria-label="排行榜排序">
          <button className={sort === "today" ? "active" : ""} type="button" onClick={() => setSort("today")}>今日推荐</button>
          <button className={sort === "role" ? "active" : ""} type="button" onClick={() => setSort("role")}>角色提升</button>
        </div>
      </header>

      <div className="streetIntelSearch">
        <label htmlFor="intel-player-search">搜索球员</label>
        <div className="playerSearchField">
          <Search aria-hidden="true" />
          <input id="intel-player-search" type="search" placeholder="输入中文或英文姓名" autoComplete="off" value={query} onChange={event => { setQuery(event.target.value); setSelectedId(null); }} onKeyDown={event => { if (event.key === "Enter" && searching && matches[0]) { event.preventDefault(); select(matches[0]); } }} aria-controls="intel-search-results" />
          {query && <button type="button" aria-label="清空球员搜索" onClick={() => { setQuery(""); setSelectedId(null); document.getElementById("intel-player-search")?.focus(); }}><X aria-hidden="true" /></button>}
        </div>
        <p role="status">{emptyMessage || (searching ? matches.length ? `找到 ${matches.length} 位球员，选择姓名查看报告。` : "没有匹配结果，请尝试其他姓名。" : featured ? `当前显示：${featured.playerName}` : "输入姓名查看球员报告。")}</p>
        {searching && matches.length > 0 && <div id="intel-search-results" className="streetIntelResults">{matches.map(player => <button key={player.nbaPlayerId} type="button" onClick={() => select(player)}><strong>{player.playerName}</strong><small>{player.englishName} · {player.team}</small></button>)}</div>}
      </div>
      {featured && <section className="streetScout" aria-label={`${featured.playerName}的球员报告`}>
        <div><span>{featured.team} / vs {featured.opponentName}</span><h2>{featured.englishName}<strong>{featured.playerName}</strong></h2><p>近 5 场与此前 10 场对比<br />基于已同步的官方逐场数据</p></div>
        <div className="streetScoutGrade" aria-label={`今日推荐等级 ${featured.tier}`}>{featured.tier}</div>
        <dl><div><dt>近 5 场梦幻分</dt><dd>{featured.recentFantasyPoints.toFixed(1)}</dd></div><div><dt>角色变化指数</dt><dd>{featured.roleChange}</dd></div><div><dt>上场时间变化</dt><dd>{change(featured.minutesChange * 100, "%")}</dd></div></dl>
      </section>}

      <div className="intelLegend">
        <span><Sparkles aria-hidden="true" /> 今日推荐：今天这一场的选择参考</span>
        <span><TrendingUp aria-hidden="true" /> 角色变化：近期球队角色是否扩大</span>
      </div>

      <div className="intelRows">
        {matches.map((player) => {
          const rising = player.minutesChange >= 0 && player.usageChange >= 0;
          return (
            <details className="intelRow" key={player.nbaPlayerId}>
              <summary>
                <span className="intelPlayer">
                  <strong>{player.playerName}</strong>
                  <small>{player.team} vs {player.opponentName} · 近 5 场梦幻分 {player.recentFantasyPoints.toFixed(1)}</small>
                </span>
                <span className="intelMetric recommendation"><small>今日推荐</small><b>{player.todayScore}<em>{player.tier}</em></b></span>
                <span className={`intelMetric role ${rising ? "rising" : "falling"}`}><small>角色变化</small><b>{rising ? <TrendingUp aria-hidden="true" /> : <TrendingDown aria-hidden="true" />}{player.roleChange}</b></span>
                <ChevronDown className="intelChevron" aria-hidden="true" />
              </summary>
              <div className="intelDetail">
                <p><strong>角色变化</strong>：近 5 场相对此前 10 场，上场时间 {change(player.minutesChange * 100, "%")}，使用率 {change(player.usageChange * 100, "%")}，出手 {change(player.fieldGoalsAttemptedChange * 100, "%")}，助攻 {change(player.assistsChange * 100, "%")}。</p>
                <p><strong>今日环境</strong>：对手近期允许梦幻产出评分 {player.matchupScore}，双方近期节奏评分 {player.paceScore}。</p>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
