import { describe, expect, it } from "vitest";
import { buildBallShareRows, type MetricWindows, type TrackingWindows } from "./player-ball-share-sync";

function windows(team: string, value: number): TrackingWindows {
  const row = { playerId: "1", playerName: "Test Player", team, gamesPlayed: 20, value };
  return { 0: new Map([["1", row]]), 5: new Map([["1", row]]), 10: new Map([["1", row]]) };
}

function metrics(team: string): MetricWindows {
  return { usageRate: windows(team, 0.25), timePossession: windows(team, 5), touches: windows(team, 70), potentialAssists: windows(team, 10) };
}

describe("buildBallShareRows", () => {
  it("keeps rookies and team changes unavailable instead of applying old-team tracking data", () => {
    const source = metrics("DAL");
    const rows = buildBallShareRows([
      { nbaPlayerId: "1", playerName: "Test Player", team: "DAL", firstSeason: 2024 },
      { nbaPlayerId: "1", playerName: "Test Player", team: "LAL", firstSeason: 2024 },
      { nbaPlayerId: "2", playerName: "Rookie Player", team: "LAL", firstSeason: 2026 }
    ], source, "2025-26", "https://stats.nba.com/example");

    expect(rows.map((row) => row.dataStatus)).toEqual(["AVAILABLE", "TEAM_CHANGED", "ROOKIE"]);
    expect(rows[1].unavailableReason).toContain("DAL");
    expect(rows[2].unavailableReason).toContain("新秀");
  });
});
