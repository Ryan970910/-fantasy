import { describe, expect, it } from "vitest";
import {
  playerSalary,
  selectDisplayStats,
  selectPricingStats,
  stableFantasyScore
} from "./player-pricing";

describe("player pricing", () => {
  it("maps stable fantasy production to the 10-60 salary range", () => {
    expect(playerSalary({ gamesPlayed: 20, points: 0 })).toBe(10);
    expect(playerSalary({ gamesPlayed: 20, points: 20 })).toBe(26);
    expect(playerSalary({ gamesPlayed: 20, points: 38.7 })).toBe(51);
    expect(playerSalary({ gamesPlayed: 20, points: 45 })).toBe(60);
  });

  it("smooths fewer than 20 games against prior production", () => {
    const current = { gamesPlayed: 10, points: 45 };
    const previous = { gamesPlayed: 70, points: 15 };

    expect(stableFantasyScore(current, previous)).toBe(30);
    expect(playerSalary(current, previous)).toBe(39);
  });

  it("prefers an official NBA row over a fallback row", () => {
    const official = { nbaPlayerId: "1629029", season: "2025-26", gamesPlayed: 64, points: 45.2 };
    const fallback = {
      nbaPlayerId: "bbr:doncilu01",
      season: "2025-26",
      gamesPlayed: 64,
      points: 46.4,
      fieldGoalsAttempted: 20
    };

    expect(selectDisplayStats([fallback, official], "2025-26", "2024-25")).toBe(official);
    expect(selectPricingStats([fallback, official], "2025-26", "2024-25")?.current).toBe(official);
  });
});
