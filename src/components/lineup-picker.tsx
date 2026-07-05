"use client";

import { RefreshCw, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const slots = ["PG", "SG", "SF", "PF", "C"] as const;
const lockedLabel = "\u5df2\u9501\u5b9a";
type Slot = (typeof slots)[number];
type SortMode = "fantasy" | "points" | "rebounds" | "assists" | "name";

type PoolPlayer = {
  id: string;
  name: string;
  team: string;
  teamName: string;
  jersey: string;
  position: string;
  height: string;
  eligibleSlots: string[];
  locked?: boolean;
  lockReason?: string | null;
  stats: {
    season?: string;
    gamesPlayed?: number | null;
    minutes?: number | null;
    points: number | null;
    rebounds: number | null;
    assists: number | null;
    steals?: number | null;
    blocks?: number | null;
    turnovers?: number | null;
    threesMade?: number | null;
    fieldGoalsMade?: number | null;
    fieldGoalsAttempted?: number | null;
    freeThrowsMade?: number | null;
    freeThrowsAttempted?: number | null;
    offensiveRebounds?: number | null;
    defensiveRebounds?: number | null;
    source?: string;
    sourceUrl?: string;
  };
};

type PoolGame = {
  gameId: string;
  eventName: string;
  status?: number;
  statusText: string;
  startTimeUTC: string;
  homeTeam: { name: string; tricode: string };
  awayTeam: { name: string; tricode: string };
};

type PoolResponse = {
  source: string;
  fetchedAt: string;
  gameDate: string | null;
  poolMode?: string | null;
  games: PoolGame[];
  allGamesOnDate?: PoolGame[];
  lockStatus?: {
    lockedAt: string;
    firstGameStartTimeUTC: string | null;
    firstGameStarted: boolean;
    lockedTeams: string[];
  };
  teams: string[];
  players: PoolPlayer[];
  notes?: string[];
  error?: string;
};

type SubmittedLineup = {
  id: string;
  name: string;
  gameDate: string | null;
  totalPoints: number;
  gameDay: string;
  createdAt: string;
  players: Array<{
    slot: string;
    id: string;
    name: string;
    team: string;
    position: string;
    fantasyPoints: number;
    stats: {
      points: number;
      rebounds: number;
      assists: number;
      steals: number;
      blocks: number;
      turnovers: number;
    };
  }>;
};

type LineupsResponse = {
  lineups: SubmittedLineup[];
  error?: string;
};

function formatGameTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "TBD";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "TBD";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function statValue(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatStatValue(value: number | null) {
  return statValue(value).toFixed(1);
}

function normalizePlayerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'\u2019-]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function playerDisplayKey(player: PoolPlayer) {
  return `${normalizePlayerName(player.name)}:${player.team}`;
}

function dedupePlayersForDisplay(players: PoolPlayer[]) {
  const seen = new Set<string>();
  return players.filter((player) => {
    const key = playerDisplayKey(player);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function projectedScore(player: PoolPlayer) {
  const missedFieldGoals = Math.max(0, statValue(player.stats.fieldGoalsAttempted ?? null) - statValue(player.stats.fieldGoalsMade ?? null));
  const missedFreeThrows = Math.max(0, statValue(player.stats.freeThrowsAttempted ?? null) - statValue(player.stats.freeThrowsMade ?? null));

  return (
    statValue(player.stats.points) +
    statValue(player.stats.threesMade ?? null) * 0.5 +
    statValue(player.stats.fieldGoalsMade ?? null) * 0.4 -
    missedFieldGoals +
    statValue(player.stats.freeThrowsMade ?? null) * 0.2 -
    missedFreeThrows * 0.5 +
    statValue(player.stats.offensiveRebounds ?? null) +
    statValue(player.stats.defensiveRebounds ?? null) * 0.7 +
    statValue(player.stats.assists) * 1.5 +
    statValue(player.stats.steals ?? null) * 2 +
    statValue(player.stats.blocks ?? null) * 1.8 -
    statValue(player.stats.turnovers ?? null)
  );
}

function playerGameLabel(player: PoolPlayer, games: PoolGame[]) {
  const game = games.find((candidate) =>
    candidate.homeTeam.tricode === player.team || candidate.awayTeam.tricode === player.team
  );

  if (!game) {
    return player.team;
  }

  return `${game.awayTeam.tricode} vs ${game.homeTeam.tricode}`;
}

export function LineupPicker() {
  const [data, setData] = useState<PoolResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submittedLineups, setSubmittedLineups] = useState<SubmittedLineup[]>([]);
  const [lineupsError, setLineupsError] = useState<string | null>(null);
  const [editingLineupId, setEditingLineupId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<Slot>("PG");
  const [sortMode, setSortMode] = useState<SortMode>("fantasy");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [lineup, setLineup] = useState<Record<Slot, string>>({
    PG: "",
    SG: "",
    SF: "",
    PF: "",
    C: ""
  });

  async function loadPool() {
    setLoading(true);
    try {
      const response = await fetch("/api/nba/next-player-pool", { cache: "no-store" });
      const payload = (await response.json()) as PoolResponse;
      setData(payload);

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load next game day player pool");
      }

      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load next game day player pool");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubmittedLineups() {
    try {
      const response = await fetch("/api/lineups", { cache: "no-store" });
      const payload = (await response.json()) as LineupsResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load submitted lineups");
      }

      setSubmittedLineups(payload.lineups || []);
      setLineupsError(null);
    } catch (caught) {
      setLineupsError(caught instanceof Error ? caught.message : "Unable to load submitted lineups");
    }
  }

  useEffect(() => {
    void loadPool();
    void loadSubmittedLineups();
  }, []);

  const selectedIds = useMemo(() => new Set(Object.values(lineup).filter(Boolean)), [lineup]);
  const uniquePlayers = useMemo(() => {
    return dedupePlayersForDisplay(data?.players || []);
  }, [data?.players]);
  const selectedPlayers = useMemo(
    () => slots.map((slot) => uniquePlayers.find((player) => player.id === lineup[slot]) || null),
    [lineup, uniquePlayers]
  );
  const selectedPlayersBySlot = useMemo(
    () => Object.fromEntries(
      slots.map((slot) => [slot, uniquePlayers.find((player) => player.id === lineup[slot]) || null])
    ) as Record<Slot, PoolPlayer | null>,
    [lineup, uniquePlayers]
  );
  const projectedLineupScore = useMemo(
    () => selectedPlayers.reduce((total, player) => total + (player ? projectedScore(player) : 0), 0),
    [selectedPlayers]
  );
  const lineupComplete = selectedPlayers.every(Boolean);
  const currentGameDate = data?.gameDate || null;
  const currentGameDayLineups = useMemo(
    () => submittedLineups.filter((submittedLineup) => submittedLineup.gameDate && submittedLineup.gameDate === currentGameDate),
    [currentGameDate, submittedLineups]
  );
  const hasSubmittedLineup = currentGameDayLineups.length > 0;
  const hasLockedTeams = Boolean(data?.lockStatus?.lockedTeams?.length);
  const showPicker = !hasSubmittedLineup || Boolean(editingLineupId);

  const teams = useMemo(() => Array.from(new Set(uniquePlayers.map((player) => player.team))).sort(), [uniquePlayers]);

  const availablePlayers = useMemo(() => {
    const activeSelectedId = lineup[activeSlot];
    const players = uniquePlayers
      .filter((player) => player.eligibleSlots.includes(activeSlot))
      .filter((player) => teamFilter === "ALL" || player.team === teamFilter)
      .filter((player) => !selectedIds.has(player.id) || player.id === activeSelectedId);

    return dedupePlayersForDisplay([...players]).sort((left, right) => {
      if (sortMode === "name") {
        return left.name.localeCompare(right.name);
      }
      if (sortMode === "rebounds") {
        return statValue(right.stats.rebounds) - statValue(left.stats.rebounds) || left.name.localeCompare(right.name);
      }
      if (sortMode === "assists") {
        return statValue(right.stats.assists) - statValue(left.stats.assists) || left.name.localeCompare(right.name);
      }
      if (sortMode === "fantasy") {
        return projectedScore(right) - projectedScore(left) || left.name.localeCompare(right.name);
      }
      return statValue(right.stats.points) - statValue(left.stats.points) || left.name.localeCompare(right.name);
    });
  }, [activeSlot, lineup, selectedIds, sortMode, teamFilter, uniquePlayers]);

  function choosePlayer(playerId: string) {
    const currentPlayer = uniquePlayers.find((player) => player.id === lineup[activeSlot]);
    const nextPlayer = uniquePlayers.find((player) => player.id === playerId);
    if (currentPlayer?.locked || nextPlayer?.locked) {
      return;
    }

    setLineup((current) => ({
      ...current,
      [activeSlot]: playerId
    }));
    setSubmitMessage(null);
  }

  function clearLineup() {
    if (data) {
      setLineup((current) => Object.fromEntries(
        slots.map((slot) => {
          const player = uniquePlayers.find((candidate) => candidate.id === current[slot]);
          return [slot, player?.locked ? current[slot] : ""];
        })
      ) as Record<Slot, string>);
      setSubmitMessage(null);
      return;
    }

    setLineup({
      PG: "",
      SG: "",
      SF: "",
      PF: "",
      C: ""
    });
    setSubmitMessage(null);
  }

  function startEditLineup(submittedLineup: SubmittedLineup) {
    if (submittedLineup.gameDate !== currentGameDate) {
      return;
    }

    const nextLineup = {
      PG: "",
      SG: "",
      SF: "",
      PF: "",
      C: ""
    };

    for (const player of submittedLineup.players) {
      if (slots.includes(player.slot as Slot)) {
        const rawPlayerId = player.id.replace(/^nba-/, "");
        const poolPlayer = uniquePlayers.find((candidate) =>
          candidate.id === rawPlayerId ||
          (candidate.name === player.name && candidate.team === player.team)
        );
        nextLineup[player.slot as Slot] = poolPlayer?.id || rawPlayerId;
      }
    }

    setLineup(nextLineup);
    setEditingLineupId(submittedLineup.id);
    setActiveSlot("PG");
    setSubmitMessage(null);
  }

  function cancelEditLineup() {
    clearLineup();
    setEditingLineupId(null);
  }

  async function submitLineup() {
    if (!data || !lineupComplete) {
      setSubmitMessage("Choose one player for every slot before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const isEditing = Boolean(editingLineupId);
      const response = await fetch("/api/lineups", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lineupId: editingLineupId,
          gameDate: data.gameDate,
          games: data.allGamesOnDate?.length ? data.allGamesOnDate : data.games,
          playersBySlot: selectedPlayersBySlot
        })
      });
      const payload = (await response.json()) as { lineupId?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit lineup.");
      }

      setSubmitMessage(isEditing ? "Lineup updated." : `Lineup submitted: ${payload.lineupId}`);
      setEditingLineupId(null);
      setLineup({
        PG: "",
        SG: "",
        SF: "",
        PF: "",
        C: ""
      });
      await loadSubmittedLineups();
    } catch (caught) {
      setSubmitMessage(caught instanceof Error ? caught.message : "Unable to submit lineup.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`lineupPicker${showPicker ? " pickerActive" : ""}`} aria-labelledby="lineup-picker-title">
      {showPicker ? (
        <div className="lineupHeader">
          <div>
            <p className="eyebrow">Next game day player pool</p>
            <h2 id="lineup-picker-title">{editingLineupId ? "Edit your starting five" : "Pick your starting five"}</h2>
            <p className="liveMeta">
              {data
                ? `${data.gameDate || "Next game day"} | ${uniquePlayers.length} players | ${data.teams.length} teams`
                : "Loading player pool"}
            </p>
          </div>
          <button className="refreshButton" type="button" onClick={() => void loadPool()} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      ) : null}

      {showPicker && error ? (
        <div className="liveEmpty">
          <strong>Player pool unavailable</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {showPicker && hasLockedTeams ? (
        <div className="lineupLockedNotice">
          <strong>Players locked</strong>
          <span>{`\u5df2\u5f00\u8d5b\u7403\u961f\u7684\u7403\u5458\u5df2\u9501\u5b9a\uff0c\u8fd8\u6ca1\u5f00\u8d5b\u7684\u7403\u5458\u4ecd\u7136\u53ef\u4ee5\u9009\u62e9\u6216\u66f4\u6362\u3002`}</span>
        </div>
      ) : null}

      {showPicker && !error && data ? (
        <div className="lineupGrid lineupSelectionGrid">
          <aside className="lineupRail" aria-label="Current lineup">
            <h3>
              <UserRoundCheck size={18} aria-hidden="true" />
              Lineup
            </h3>
            <div className="lineupSlotList">
              {slots.map((slot) => {
                const player = uniquePlayers.find((candidate) => candidate.id === lineup[slot]) || null;
                return (
                  <button
                    key={slot}
                    className={`lineupSlotButton${activeSlot === slot ? " active" : ""}`}
                    type="button"
                    onClick={() => setActiveSlot(slot)}
                  >
                    <span>{slot}</span>
                    <strong>{player ? player.name : "Open"}</strong>
                    <small>
                      {player
                        ? `${player.team} | ${formatStatValue(player.stats.points)} PTS | ${player.locked ? lockedLabel : player.stats.season || "stats"}`
                        : "Tap to fill"}
                    </small>
                  </button>
                );
              })}
            </div>

            <div className="lineupActionsBar">
              <button className="clearLineupButton" type="button" onClick={clearLineup}>
                Clear lineup
              </button>
              {editingLineupId ? (
                <button className="cancelLineupButton" type="button" onClick={cancelEditLineup}>
                  Cancel edit
                </button>
              ) : null}
              <span className="lineupActionScore">Fantasy {projectedLineupScore.toFixed(1)}</span>
              <button
                className={`lineupSubmitButton${lineupComplete ? " ready" : ""}`}
                type="button"
                onClick={() => void submitLineup()}
                disabled={!lineupComplete || submitting}
              >
                {submitting ? "Saving" : editingLineupId ? "Save changes" : "Submit"}
              </button>
              {submitMessage ? <small className="lineupMessage">{submitMessage}</small> : null}
            </div>
          </aside>

          <div className="playerBoard">
            <div className="playerBoardToolbar">
              <div>
                <strong>Choose {activeSlot}</strong>
                <small>{availablePlayers.length} available players</small>
              </div>
              <div className="toolbarControls">
                <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} aria-label="Filter team">
                  <option value="ALL">All teams</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Sort players">
                  <option value="fantasy">Sort by fantasy</option>
                  <option value="points">Sort by PTS</option>
                  <option value="rebounds">Sort by REB</option>
                  <option value="assists">Sort by AST</option>
                  <option value="name">Sort by name</option>
                </select>
              </div>
            </div>

            <div key={activeSlot} className="playerRows">
              {availablePlayers.map((player) => {
                const selectedForActiveSlot = lineup[activeSlot] === player.id;
                const activeSlotLocked = Boolean(uniquePlayers.find((candidate) => candidate.id === lineup[activeSlot])?.locked);
                const disabled = Boolean(player.locked || (activeSlotLocked && !selectedForActiveSlot));
                return (
                  <button
                    key={`${activeSlot}:${playerDisplayKey(player)}`}
                    className={`playerChoice${selectedForActiveSlot ? " selected" : ""}${disabled ? " locked" : ""}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => choosePlayer(player.id)}
                  >
                    <span className="positionTag">{player.position || activeSlot}</span>
                    <span className="playerChoiceMain">
                      <strong>{player.name}</strong>
                      <small>{playerGameLabel(player, data.allGamesOnDate?.length ? data.allGamesOnDate : data.games)}</small>
                    </span>
                    <span className="playerStats">
                      <small className="playerStatsLabel">Fantasy</small>
                      <strong>{projectedScore(player).toFixed(1)}</strong>
                      <small>{formatStatValue(player.stats.minutes ?? null)} MIN</small>
                    </span>
                    <span className="selectPill">{player.locked ? lockedLabel : selectedForActiveSlot ? "Selected" : "Select"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {showPicker && data?.games.length ? (
        <div className="nextGames">
          {data.games.map((game) => (
            <div key={game.gameId} className="nextGame">
              <strong>{game.awayTeam.tricode} @ {game.homeTeam.tricode}</strong>
              <span>{game.eventName}</span>
              <small>{formatGameTime(game.startTimeUTC)} - {game.statusText}</small>
            </div>
          ))}
        </div>
      ) : null}

      <section className="submittedLineups" aria-labelledby="submitted-lineups-title">
        <div className="submittedLineupsHeader">
          <div>
            <p className="eyebrow">Submitted lineup</p>
            <h3 id="submitted-lineups-title">Your saved picks</h3>
          </div>
          <span>{submittedLineups.length} submitted</span>
        </div>

        {lineupsError ? (
          <div className="lineupEmpty">
            <strong>Unable to load submitted lineup</strong>
            <span>{lineupsError}</span>
          </div>
        ) : null}

        {!lineupsError && submittedLineups.length === 0 ? (
          <div className="lineupEmpty">
            <strong>No lineup submitted yet</strong>
            <span>Your submitted picks will show here after you press Submit.</span>
          </div>
        ) : null}

        {!lineupsError && submittedLineups.map((submittedLineup) => (
          <article key={submittedLineup.id} className="submittedLineupCard">
            <div className="submittedLineupMeta">
              <div>
                <strong>{submittedLineup.name}</strong>
                <small>Game day {formatDateTime(submittedLineup.gameDay)} | Submitted {formatDateTime(submittedLineup.createdAt)}</small>
              </div>
              <div className="submittedLineupActions">
                <span>{submittedLineup.totalPoints.toFixed(1)}</span>
                <button
                  type="button"
                  onClick={() => startEditLineup(submittedLineup)}
                  disabled={submittedLineup.gameDate !== currentGameDate}
                >
                  {submittedLineup.gameDate !== currentGameDate ? "Locked" : "Edit"}
                </button>
              </div>
            </div>
            <div className="submittedPlayers">
              {submittedLineup.players.map((player) => (
                <div key={`${submittedLineup.id}-${player.slot}-${player.id}`} className="submittedPlayer">
                  <span>{player.slot}</span>
                  <strong>{player.name}</strong>
                  <small>{player.team} | {player.position}</small>
                  <em>{player.fantasyPoints.toFixed(1)}</em>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
