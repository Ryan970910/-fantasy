import { describe, expect, it } from "vitest";
import { buildPlayerIntel, PLAYER_INTEL_MINIMUM_GAMES, type PlayerIntelGame } from "./player-intel";

function playerGames(playerId: string, team: string, opponent: string, boost = 0): PlayerIntelGame[] {
  return Array.from({ length: PLAYER_INTEL_MINIMUM_GAMES }, (_, index) => ({
    gameId: `game-${index}`,
    nbaPlayerId: playerId,
    playerName: `Player ${playerId}`,
    team,
    homeTeam: index % 2 ? team : opponent,
    awayTeam: index % 2 ? opponent : team,
    gameDate: new Date(2026, 9, index + 1),
    minutes: index >= 10 ? 24 + boost : 24,
    points: 18 + boost,
    rebounds: 5,
    assists: index >= 10 ? 4 + boost : 4,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    threesMade: 2,
    fieldGoalsMade: index >= 10 ? 7 + boost : 7,
    fieldGoalsAttempted: index >= 10 ? 10 + boost : 10,
    freeThrowsMade: 2,
    freeThrowsAttempted: 3,
    offensiveRebounds: 1,
    defensiveRebounds: 4
  }));
}

describe("buildPlayerIntel", () => {
  it("ranks a player with a stronger recent role above a flat teammate", () => {
    const rows = [
      ...playerGames("1", "LAL", "BOS", 4),
      ...playerGames("2", "LAL", "BOS"),
      ...playerGames("3", "BOS", "LAL"),
      ...playerGames("4", "BOS", "LAL")
    ];
    const intel = buildPlayerIntel(rows, [{ id: "next", homeTeam: "LAL", awayTeam: "BOS", startTime: new Date("2026-11-01") }]);
    expect(intel).toHaveLength(4);
    expect(intel.find((row) => row.nbaPlayerId === "1")?.roleChange).toBeGreaterThan(
      intel.find((row) => row.nbaPlayerId === "2")?.roleChange || 0
    );
  });

  it("requires fifteen played games before returning an indicator", () => {
    const rows = playerGames("1", "LAL", "BOS").slice(0, PLAYER_INTEL_MINIMUM_GAMES - 1);
    expect(buildPlayerIntel(rows, [{ id: "next", homeTeam: "LAL", awayTeam: "BOS", startTime: new Date("2026-11-01") }])).toEqual([]);
  });
});
