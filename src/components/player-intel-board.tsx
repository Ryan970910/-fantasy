"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { PageBackLink } from "@/components/page-back-link";

type IntelPlayer = {
  nbaPlayerId: string;
  playerName: string;
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

export function PlayerIntelBoard({ players }: { players: IntelPlayer[] }) {
  const [sort, setSort] = useState<"today" | "role">("today");
  const sorted = useMemo(
    () => [...players].sort((left, right) => sort === "today" ? right.todayScore - left.todayScore : right.roleChange - left.roleChange),
    [players, sort]
  );

  return (
    <section className="playerIntelBoard" aria-labelledby="player-intel-title">
      <header className="playerIntelHeader">
        <div>
          <PageBackLink href="/pregame-intel">返回赛前情报</PageBackLink>
          <h1 id="player-intel-title">球员情报</h1>
          <p>角色变化反映近 5 场相对此前 10 场的球队角色；今日推荐结合近期表现、对手与比赛节奏。</p>
        </div>
        <div className="intelSort" aria-label="排行榜排序">
          <button className={sort === "today" ? "active" : ""} type="button" onClick={() => setSort("today")}>今日推荐</button>
          <button className={sort === "role" ? "active" : ""} type="button" onClick={() => setSort("role")}>角色提升</button>
        </div>
      </header>

      <div className="intelLegend">
        <span><Sparkles aria-hidden="true" /> 今日推荐：今天这一场的选择参考</span>
        <span><TrendingUp aria-hidden="true" /> 角色变化：近期球队角色是否扩大</span>
      </div>

      <div className="intelRows">
        {sorted.map((player) => {
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
