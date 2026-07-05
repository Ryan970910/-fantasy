"use client";

import { RefreshCw, Radio, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type LivePlayer = {
  name: string;
  team: string;
  jersey: string;
  position: string;
  minutes: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threes: number;
};

type LiveGame = {
  gameId: string;
  leagueId: string;
  eventName: string;
  status: number;
  statusText: string;
  period: number;
  clock: string;
  startTimeUTC: string;
  homeTeam: { name: string; tricode: string; score: number };
  awayTeam: { name: string; tricode: string; score: number };
  leaders: Array<{ name: string; team: string; points: number; rebounds: number; assists: number }>;
  topPlayers: LivePlayer[];
};

type LiveResponse = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  feedTime: string | null;
  gameDate: string | null;
  liveGameCount: number;
  games: LiveGame[];
  error?: string;
};

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function gameState(game: LiveGame) {
  if (game.status === 2) {
    return game.statusText || `Q${game.period} ${game.clock || ""}`.trim();
  }

  return game.statusText;
}

export function NbaLiveStats() {
  const [data, setData] = useState<LiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadLiveStats() {
    setLoading(true);
    try {
      const response = await fetch("/api/nba/live", { cache: "no-store" });
      const payload = (await response.json()) as LiveResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load NBA live stats");
      }

      setData(payload);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load NBA live stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLiveStats();
    const interval = window.setInterval(() => void loadLiveStats(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const featuredGame = useMemo(() => {
    if (!data?.games.length) {
      return null;
    }

    return data.games.find((game) => game.status === 2) || data.games[0];
  }, [data]);

  return (
    <section className="liveStats" aria-labelledby="live-stats-title">
      <div className="liveHeader">
        <div>
          <p className="eyebrow">Official NBA feed</p>
          <h2 id="live-stats-title">Live game stats</h2>
          <p className="liveMeta">
            {data ? `${data.source} | Feed date ${data.gameDate || "unknown"} | Updated ${formatTime(data.fetchedAt)}` : "Loading official NBA data"}
          </p>
        </div>
        <button className="refreshButton" type="button" onClick={() => void loadLiveStats()} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="liveEmpty">
          <strong>NBA live feed unavailable</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {!error && !featuredGame && !loading ? (
        <div className="liveEmpty">
          <strong>No games in the current NBA live feed</strong>
          <span>The panel will update automatically when the official feed publishes games.</span>
        </div>
      ) : null}

      {featuredGame ? (
        <div className="liveGrid">
          <article className="gameCard">
            <div className="gameStatus">
              <span className={featuredGame.status === 2 ? "statusLive" : "statusPill"}>
                <Radio size={14} aria-hidden="true" />
                {gameState(featuredGame)}
              </span>
              <span>{featuredGame.eventName || featuredGame.gameId}</span>
            </div>

            <div className="scoreLine">
              <div>
                <span>{featuredGame.awayTeam.tricode}</span>
                <strong>{featuredGame.awayTeam.score}</strong>
                <small>{featuredGame.awayTeam.name}</small>
              </div>
              <div>
                <span>{featuredGame.homeTeam.tricode}</span>
                <strong>{featuredGame.homeTeam.score}</strong>
                <small>{featuredGame.homeTeam.name}</small>
              </div>
            </div>

            <div className="leaderList">
              {featuredGame.leaders.map((leader) => (
                <div key={`${leader.team}-${leader.name}`} className="leaderRow">
                  <Trophy size={16} aria-hidden="true" />
                  <span>{leader.name}</span>
                  <strong>{leader.points} PTS | {leader.rebounds} REB | {leader.assists} AST</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="playerTableCard">
            <h3>Top box score players</h3>
            {featuredGame.topPlayers.length ? (
              <div className="playerTable" role="table" aria-label="Top NBA box score players">
                <div className="playerTableHead" role="row">
                  <span>Player</span>
                  <span>PTS</span>
                  <span>REB</span>
                  <span>AST</span>
                  <span>3PM</span>
                </div>
                {featuredGame.topPlayers.slice(0, 6).map((player) => (
                  <div key={`${player.team}-${player.name}-${player.jersey}`} className="playerTableRow" role="row">
                    <span>
                      <strong>{player.name}</strong>
                      <small>{player.team} {player.position}</small>
                    </span>
                    <span>{player.points}</span>
                    <span>{player.rebounds}</span>
                    <span>{player.assists}</span>
                    <span>{player.threes}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="liveMeta">Box score player stats are not available for this game yet.</p>
            )}
          </article>
        </div>
      ) : null}
    </section>
  );
}
