"use client";

import { Search, UserRoundCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const slots = ["PG", "SG", "SF", "PF", "C"] as const;
const lockedLabel = "\u5df2\u9501\u5b9a";
const LINEUP_SALARY_CAP = 125;
type Slot = (typeof slots)[number];
type SortMode = "fantasy" | "points" | "rebounds" | "assists" | "name";

type PoolPlayer = {
  id: string;
  name: string;
  englishName?: string;
  team: string;
  teamName: string;
  jersey: string;
  position: string;
  height: string;
  salary: number;
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
  teamTranslations?: Record<string, string>;
  players: PoolPlayer[];
  notes?: string[];
  error?: string;
};

type SubmittedLineup = {
  id: string;
  name: string;
  gameDate: string | null;
  totalSalary: number;
  totalPoints: number;
  gameDay: string;
  createdAt: string;
  players: Array<{
    slot: string;
    id: string;
    name: string;
    englishName?: string;
    team: string;
    position: string;
    salary: number;
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

async function readJsonResponse<T>(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    const isHtml = /<(!doctype|html)\b/i.test(body);
    const responseType = contentType || "未知类型";
    const detail = `状态 ${response.status}，类型 ${responseType}`;
    throw new Error(isHtml ? `${fallbackMessage} 服务器返回了网页内容（${detail}），请刷新或重新登录后重试。` : `${fallbackMessage} ${detail}`);
  }

  return (await response.json()) as T;
}

async function fetchJsonResponse<T>(url: string, fallbackMessage: string) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestUrl = new URL(url, window.location.origin);
    if (attempt > 0) {
      requestUrl.searchParams.set("_retry", String(Date.now()));
    }

    try {
      const response = await fetch(requestUrl.toString(), {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await readJsonResponse<T>(response, fallbackMessage);
      return { response, payload };
    } catch (caught) {
      lastError = caught;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(fallbackMessage);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "待定";
  }

  return new Intl.DateTimeFormat("zh-CN", {
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

function normalizePlayerSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s.'\u2019·‐‑‒–—﹘﹣－-]/g, "")
    .toLowerCase();
}

export function playerMatchesNameSearch(player: Pick<PoolPlayer, "name" | "englishName">, query: string) {
  const normalizedQuery = normalizePlayerSearchText(query);
  return !normalizedQuery || [player.name, player.englishName || ""]
    .some((name) => normalizePlayerSearchText(name).includes(normalizedQuery));
}

function playerDisplayKey(player: PoolPlayer) {
  return `${normalizePlayerName(player.englishName || player.name)}:${player.team}`;
}

function playerLabel(player: Pick<PoolPlayer, "name" | "englishName"> | null) {
  // `name` is the translated display label. Keep `englishName` as the identity
  // fallback only; it must not override a Chinese name returned by the API.
  return player?.name || player?.englishName || "待选";
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

function teamLabel(team: string, translations?: Record<string, string>) {
  return translations?.[team] || team;
}

function playerGameLabel(player: PoolPlayer, games: PoolGame[], translations?: Record<string, string>) {
  const game = games.find((candidate) =>
    candidate.homeTeam.tricode === player.team || candidate.awayTeam.tricode === player.team
  );

  if (!game) {
    return teamLabel(player.team, translations);
  }

  return `${teamLabel(game.awayTeam.tricode, translations)} vs ${teamLabel(game.homeTeam.tricode, translations)}`;
}

function lineupDisplayName(name: string) {
  if (name === "My Lineup") {
    return "我的阵容";
  }

  return name.replace(/^Lineup\s+/, "阵容 ");
}

export function LineupPicker() {
  const [data, setData] = useState<PoolResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [salaryCapPopupOpen, setSalaryCapPopupOpen] = useState(false);
  const [submittedLineups, setSubmittedLineups] = useState<SubmittedLineup[]>([]);
  const [lineupsError, setLineupsError] = useState<string | null>(null);
  const [editingLineupId, setEditingLineupId] = useState<string | null>(null);
  const [isCreatingLineup, setIsCreatingLineup] = useState(false);
  const [submittedTab, setSubmittedTab] = useState<"current" | "history">("current");
  const [expandedLineupIds, setExpandedLineupIds] = useState<Set<string>>(() => new Set());
  const [activeSlot, setActiveSlot] = useState<Slot>("PG");
  const [sortMode, setSortMode] = useState<SortMode>("fantasy");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [playerNameQuery, setPlayerNameQuery] = useState("");
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
      const { response, payload } = await fetchJsonResponse<PoolResponse>(
        "/api/nba/next-player-pool",
        "无法加载下一比赛日球员池。"
      );
      setData(payload);

      if (!response.ok) {
        throw new Error(payload.error || "无法加载下一比赛日球员池。");
      }

      setError(null);
      setSubmitMessage(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法加载下一比赛日球员池。");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubmittedLineups() {
    try {
      const { response, payload } = await fetchJsonResponse<LineupsResponse>(
        "/api/lineups",
        "无法加载已提交阵容。"
      );

      if (!response.ok) {
        throw new Error(payload.error || "无法加载已提交阵容。");
      }

      setSubmittedLineups(payload.lineups || []);
      setLineupsError(null);
    } catch (caught) {
      setLineupsError(caught instanceof Error ? caught.message : "无法加载已提交阵容。");
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
  const projectedLineupSalary = useMemo(
    () => selectedPlayers.reduce((total, player) => total + (player ? statValue(player.salary) : 0), 0),
    [selectedPlayers]
  );
  const remainingSalary = LINEUP_SALARY_CAP - projectedLineupSalary;
  const salaryCapExceeded = projectedLineupSalary > LINEUP_SALARY_CAP;
  const salaryCapWarning = salaryCapExceeded
    ? `超出工资帽 $${projectedLineupSalary - LINEUP_SALARY_CAP}，请调整阵容后再提交。`
    : null;
  const lineupComplete = selectedPlayers.every(Boolean);
  const selectedPlayerCount = selectedPlayers.filter(Boolean).length;
  const currentGameDate = data?.gameDate || null;
  const currentGameDayLineups = useMemo(
    () => submittedLineups.filter((submittedLineup) => submittedLineup.gameDate && submittedLineup.gameDate === currentGameDate),
    [currentGameDate, submittedLineups]
  );
  const historicalLineups = useMemo(
    () => submittedLineups.filter((submittedLineup) => !submittedLineup.gameDate || submittedLineup.gameDate !== currentGameDate),
    [currentGameDate, submittedLineups]
  );
  const visibleSubmittedLineups = submittedTab === "current" ? currentGameDayLineups : historicalLineups;
  const hasLockedTeams = Boolean(data?.lockStatus?.lockedTeams?.length);
  const canCreateLineup = Boolean(data && !error && uniquePlayers.some((player) => !player.locked));
  const showPicker = isCreatingLineup || Boolean(editingLineupId);

  useEffect(() => {
    document.body.classList.toggle("pickerScreenLocked", showPicker);
    return () => document.body.classList.remove("pickerScreenLocked");
  }, [showPicker]);

  const teams = useMemo(() => Array.from(new Set(uniquePlayers.map((player) => player.team))).sort(), [uniquePlayers]);

  const availablePlayers = useMemo(() => {
    const activeSelectedId = lineup[activeSlot];
    const players = uniquePlayers
      .filter((player) => player.eligibleSlots.includes(activeSlot))
      .filter((player) => teamFilter === "ALL" || player.team === teamFilter)
      .filter((player) => playerMatchesNameSearch(player, playerNameQuery))
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
  }, [activeSlot, lineup, playerNameQuery, selectedIds, sortMode, teamFilter, uniquePlayers]);

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
    if (submittedLineup.gameDate !== currentGameDate || !canCreateLineup) {
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
          ((candidate.englishName || candidate.name) === (player.englishName || player.name) && candidate.team === player.team)
        );
        nextLineup[player.slot as Slot] = poolPlayer?.id || rawPlayerId;
      }
    }

    setLineup(nextLineup);
    setIsCreatingLineup(false);
    setEditingLineupId(submittedLineup.id);
    setActiveSlot("PG");
    setSubmitMessage(null);
  }

  function cancelEditLineup() {
    clearLineup();
    setEditingLineupId(null);
    setIsCreatingLineup(false);
  }

  function startCreateLineup() {
    setLineup({
      PG: "",
      SG: "",
      SF: "",
      PF: "",
      C: ""
    });
    setEditingLineupId(null);
    setIsCreatingLineup(true);
    setSubmittedTab("current");
    setActiveSlot("PG");
    setSubmitMessage(null);
    if (!canCreateLineup) {
      void loadPool();
    }
  }

  function toggleLineupExpanded(lineupId: string) {
    setExpandedLineupIds((current) => {
      const next = new Set(current);
      if (next.has(lineupId)) {
        next.delete(lineupId);
      } else {
        next.add(lineupId);
      }
      return next;
    });
  }

  async function submitLineup() {
    if (!data || !lineupComplete) {
      setSubmitMessage("请为每个位置选择一名球员。");
      return;
    }
    if (salaryCapExceeded) {
      setSalaryCapPopupOpen(true);
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
        throw new Error(payload.error || "无法提交阵容。");
      }

      setSubmitMessage(isEditing ? "阵容已更新。" : "阵容已提交。");
      setEditingLineupId(null);
      setIsCreatingLineup(false);
      setLineup({
        PG: "",
        SG: "",
        SF: "",
        PF: "",
        C: ""
      });
      await loadSubmittedLineups();
    } catch (caught) {
      setSubmitMessage(caught instanceof Error ? caught.message : "无法提交阵容。");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteLineup(lineupId: string) {
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const response = await fetch(`/api/lineups?lineupId=${encodeURIComponent(lineupId)}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "无法删除阵容。");
      }

      if (editingLineupId === lineupId) {
        setEditingLineupId(null);
      }
      setIsCreatingLineup(false);
      clearLineup();
      setSubmitMessage("阵容已删除。");
      await loadSubmittedLineups();
    } catch (caught) {
      setSubmitMessage(caught instanceof Error ? caught.message : "无法删除阵容。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`lineupPicker${showPicker ? " pickerActive" : ""}`} aria-label="阵容编辑">
      {showPicker && error ? (
        <div className="liveEmpty">
          <strong>球员池不可用</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {showPicker && hasLockedTeams ? (
        <div className="lineupLockedNotice">
          <strong>球员已锁定</strong>
          <span>{`\u5df2\u5f00\u8d5b\u7403\u961f\u7684\u7403\u5458\u5df2\u9501\u5b9a\uff0c\u8fd8\u6ca1\u5f00\u8d5b\u7684\u7403\u5458\u4ecd\u7136\u53ef\u4ee5\u9009\u62e9\u6216\u66f4\u6362\u3002`}</span>
        </div>
      ) : null}

      {showPicker && !error && data ? (
        <>
          <div className="lineupGrid lineupSelectionGrid">
          <aside className="lineupRail" aria-label="当前阵容">
            <h3>
              <span>
                <UserRoundCheck size={18} aria-hidden="true" />
                我的阵容
              </span>
              <b>{selectedPlayerCount} / 5</b>
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
                    <strong>{playerLabel(player)}</strong>
                    <small>
                      {player
                        ? `${teamLabel(player.team, data?.teamTranslations)} | $${player.salary} | ${formatStatValue(player.stats.points)} 得分`
                        : "点击选择"}
                    </small>
                  </button>
                );
              })}
            </div>

          </aside>
          <div className="playerBoard">
            <div className="playerBoardToolbar">
              <div className="playerBoardTitle">
                <strong>选择球员</strong>
                <small>当前选择：{activeSlot} · {availablePlayers.length} 名可选</small>
              </div>
              <div className="toolbarControls">
                <div className="playerSearchField">
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    value={playerNameQuery}
                    onChange={(event) => setPlayerNameQuery(event.target.value)}
                    placeholder="搜索中文或英文名"
                    aria-label="搜索球员姓名"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {playerNameQuery ? (
                    <button type="button" onClick={() => setPlayerNameQuery("")} aria-label="清除姓名搜索">
                      <X size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} aria-label="筛选球队">
                  <option value="ALL">全部球队</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>{teamLabel(team, data?.teamTranslations)}</option>
                  ))}
                </select>
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="球员排序">
                  <option value="fantasy">按梦幻分排序</option>
                  <option value="points">按得分排序</option>
                  <option value="rebounds">按篮板排序</option>
                  <option value="assists">按助攻排序</option>
                  <option value="name">按姓名排序</option>
                </select>
              </div>
            </div>

            <div className="playerColumnHeadings" aria-hidden="true">
              <span>位置</span>
              <span>球员</span>
              <span>对阵</span>
              <span>梦幻分</span>
              <span>平均 MIN</span>
              <span>薪资</span>
              <span>操作</span>
            </div>

            <div key={activeSlot} className="playerRows">
              {availablePlayers.length === 0 ? (
                <div className="playerSearchEmpty">
                  <strong>找不到符合条件的球员</strong>
                  <span>请尝试其他姓名、球队或位置</span>
                </div>
              ) : null}
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
                      <strong>{playerLabel(player)}</strong>
                      <small>{playerGameLabel(player, data.allGamesOnDate?.length ? data.allGamesOnDate : data.games, data.teamTranslations)}</small>
                    </span>
                    <span className="playerStats">
                      <small className="playerStatsLabel">身价</small>
                      <strong>${player.salary}</strong>
                      <small>梦幻分 {projectedScore(player).toFixed(1)} | {formatStatValue(player.stats.minutes ?? null)} 分钟</small>
                    </span>
                    <span className="selectPill">{player.locked ? lockedLabel : selectedForActiveSlot ? "已选" : "选择"}</span>
                  </button>
                );
              })}
            </div>
          </div>
          </div>

          <div className="lineupActionsBar">
          <span className={`lineupActionScore${salaryCapExceeded ? " over" : ""}`}>
            <small>梦幻分</small>
            {projectedLineupScore.toFixed(1)}
          </span>
          <div className={`salaryCapMeter${salaryCapExceeded ? " over" : ""}`}>
            <span>薪资使用</span>
            <strong>${projectedLineupSalary} / ${LINEUP_SALARY_CAP}</strong>
            <small>{remainingSalary >= 0 ? `剩余 $${remainingSalary}` : `超出 $${Math.abs(remainingSalary)}`}</small>
          </div>
          <div className={`salaryGauge${salaryCapExceeded ? " over" : ""}`} aria-label={`薪资使用 $${projectedLineupSalary} / $${LINEUP_SALARY_CAP}`}>
            <span style={{ width: `${Math.min(100, (projectedLineupSalary / LINEUP_SALARY_CAP) * 100)}%` }} />
          </div>
          <button className="clearLineupButton" type="button" onClick={clearLineup}>
            清空阵容
          </button>
          {editingLineupId ? (
            <button className="cancelLineupButton" type="button" onClick={cancelEditLineup}>
              取消编辑
            </button>
          ) : isCreatingLineup ? (
            <button className="cancelLineupButton" type="button" onClick={cancelEditLineup}>
              取消创建
            </button>
          ) : null}
          <button
            className={`lineupSubmitButton${lineupComplete && !salaryCapExceeded ? " ready" : ""}${lineupComplete && salaryCapExceeded ? " overCap" : ""}`}
            type="button"
            onClick={() => void submitLineup()}
            disabled={!lineupComplete || submitting}
          >
            {submitting ? "保存中" : editingLineupId ? "保存修改" : "保存阵容"}
          </button>
          {submitMessage ? <small className="lineupMessage">{submitMessage}</small> : null}
          </div>
        </>
      ) : null}

      {salaryCapPopupOpen && salaryCapWarning ? (
        <div className="lineupPopupBackdrop" role="presentation" onClick={() => setSalaryCapPopupOpen(false)}>
          <div
            className="lineupPopup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="salary-cap-popup-title"
            aria-describedby="salary-cap-popup-message"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">工资帽</p>
            <h3 id="salary-cap-popup-title">阵容超出工资帽</h3>
            <p id="salary-cap-popup-message">{salaryCapWarning}</p>
            <button type="button" onClick={() => setSalaryCapPopupOpen(false)}>
              确定
            </button>
          </div>
        </div>
      ) : null}

      <section className="submittedLineups" aria-labelledby="submitted-lineups-title">
        <div className="submittedLineupsHeader">
          <div>
            <p className="eyebrow">已提交阵容</p>
            <h3 id="submitted-lineups-title">已保存选择</h3>
          </div>
          <span>已提交 {submittedLineups.length} 个</span>
        </div>

        <div className="submittedLineupTabs" role="tablist" aria-label="已提交阵容">
          <button
            className={`submittedLineupTab${submittedTab === "current" ? " active" : ""}`}
            type="button"
            role="tab"
            aria-selected={submittedTab === "current"}
            onClick={() => setSubmittedTab("current")}
          >
            当前阵容
            <span>{currentGameDayLineups.length}</span>
          </button>
          <button
            className={`submittedLineupTab${submittedTab === "history" ? " active" : ""}`}
            type="button"
            role="tab"
            aria-selected={submittedTab === "history"}
            onClick={() => setSubmittedTab("history")}
          >
            历史阵容
            <span>{historicalLineups.length}</span>
          </button>
        </div>

        {lineupsError ? (
          <div className="lineupEmpty">
            <strong>无法加载已提交阵容</strong>
            <span>{lineupsError}</span>
          </div>
        ) : null}

        {!lineupsError && submittedLineups.length === 0 ? (
          <div className="lineupEmpty">
            <strong>还没有提交阵容</strong>
            <span>提交后会显示在这里。</span>
            {submittedTab === "current" && !showPicker ? (
              <button className="createLineupButton" type="button" onClick={startCreateLineup}>
                创建
              </button>
            ) : null}
          </div>
        ) : null}

        {!lineupsError && submittedLineups.length > 0 && visibleSubmittedLineups.length === 0 ? (
          <div className="lineupEmpty">
            <strong>{submittedTab === "current" ? "暂无当前阵容" : "暂无历史阵容"}</strong>
            <span>
              {submittedTab === "current"
                ? "提交本比赛日阵容后会显示在这里。"
                : "新比赛日开启后，旧阵容会显示在这里。"}
            </span>
            {submittedTab === "current" && !showPicker ? (
              <button className="createLineupButton" type="button" onClick={startCreateLineup}>
                创建
              </button>
            ) : null}
          </div>
        ) : null}

        {!lineupsError && visibleSubmittedLineups.length > 0 ? (
          <div className="submittedLineupList">
            {visibleSubmittedLineups.map((submittedLineup) => {
              const isExpanded = expandedLineupIds.has(submittedLineup.id);
              const canEdit = submittedLineup.gameDate === currentGameDate && canCreateLineup;
              return (
                <article
                  key={submittedLineup.id}
                  className={`submittedLineupCard${isExpanded ? " expanded" : ""}`}
                >
                  <button
                    className="submittedLineupSummary"
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleLineupExpanded(submittedLineup.id)}
                  >
                      <span className="lineupThumbTop">
                        <span>{lineupDisplayName(submittedLineup.name)}</span>
                        <strong>{submittedLineup.totalPoints.toFixed(1)}</strong>
                      </span>
                      <span className="lineupThumbMeta">
                      比赛日 {formatDateTime(submittedLineup.gameDay)} | 工资 $${submittedLineup.totalSalary || 0}/${LINEUP_SALARY_CAP}
                      </span>
                    <span className="lineupMiniPlayers" aria-hidden="true">
                      {slots.map((slot) => {
                        const player = submittedLineup.players.find((candidate) => candidate.slot === slot);
                        return (
                          <span key={`${submittedLineup.id}-thumb-${slot}`} className="lineupMiniPlayer">
                            <span>{slot}</span>
                            <strong>{player ? player.name : "待选"}</strong>
                            <small>{player ? `$${player.salary || 0}` : "$0"}</small>
                          </span>
                        );
                      })}
                    </span>
                    <span className="lineupExpandHint">{isExpanded ? "点击收起" : "点击展开"}</span>
                  </button>

                  <div className="submittedLineupFooter">
                    <small>提交时间 {formatDateTime(submittedLineup.createdAt)}</small>
                    <span className="submittedLineupButtons">
                      {submittedTab === "current" && canEdit ? (
                        <button
                          className="submittedLineupDelete"
                          type="button"
                          onClick={() => {
                            if (window.confirm("确定删除当前阵容？")) {
                              void deleteLineup(submittedLineup.id);
                            }
                          }}
                          disabled={submitting}
                        >
                          删除
                        </button>
                      ) : null}
                      <button
                        className="submittedLineupEdit"
                        type="button"
                        onClick={() => startEditLineup(submittedLineup)}
                        disabled={!canEdit || submitting}
                      >
                        {canEdit ? "编辑" : "已锁定"}
                      </button>
                    </span>
                  </div>

                  {isExpanded ? (
                    <div className="submittedPlayers">
                      {slots.map((slot) => {
                        const player = submittedLineup.players.find((candidate) => candidate.slot === slot);
                        return (
                          <div
                            key={`${submittedLineup.id}-${slot}-${player?.id || "open"}`}
                            className="submittedPlayer"
                          >
                            <span>{slot}</span>
                            <strong>{player ? player.name : "待选"}</strong>
                            <small>{player ? `${teamLabel(player.team, data?.teamTranslations)} | ${player.position}` : "未选择球员"}</small>
                            <em>{player ? `$${player.salary || 0} | ${player.fantasyPoints.toFixed(1)}` : "$0 | 0.0"}</em>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </section>
  );
}
