import { describe, expect, it } from "vitest";
import { recentUsageRates } from "./player-usage";

describe("recentUsageRates", () => {
  it("calculates a player's usage against only that game's team totals", () => {
    const rows = [
      { gameId: "game-1", nbaPlayerId: "1", team: "LAL", gameDate: new Date("2026-10-21"), minutes: 30, fieldGoalsAttempted: 20, freeThrowsAttempted: 10, turnovers: 4 },
      { gameId: "game-1", nbaPlayerId: "2", team: "LAL", gameDate: new Date("2026-10-21"), minutes: 210, fieldGoalsAttempted: 70, freeThrowsAttempted: 20, turnovers: 8 },
      { gameId: "game-1", nbaPlayerId: "3", team: "BOS", gameDate: new Date("2026-10-21"), minutes: 240, fieldGoalsAttempted: 100, freeThrowsAttempted: 20, turnovers: 10 }
    ];

    const usage = recentUsageRates(rows, ["1"]).get("1");
    expect(usage?.games).toBe(1);
    expect(usage?.rate).toBeCloseTo(39.44, 2);
  });

  it("uses at most the most recent ten games", () => {
    const rows = Array.from({ length: 11 }, (_, index) => ([
      { gameId: `game-${index}`, nbaPlayerId: "1", team: "LAL", gameDate: new Date(2026, 9, index + 1), minutes: 24, fieldGoalsAttempted: 10, freeThrowsAttempted: 2, turnovers: 2 },
      { gameId: `game-${index}`, nbaPlayerId: "2", team: "LAL", gameDate: new Date(2026, 9, index + 1), minutes: 216, fieldGoalsAttempted: 80, freeThrowsAttempted: 18, turnovers: 8 }
    ])).flat();

    expect(recentUsageRates(rows, ["1"]).get("1")?.games).toBe(10);
  });
});
