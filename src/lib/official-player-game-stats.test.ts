import { describe, expect, it } from "vitest";
import { isRegularSeasonGame, parseBoxScorePlayerStats } from "./official-player-game-stats";

describe("official player game stats", () => {
  it("keeps only players who played and preserves their final box score totals", () => {
    const rows = parseBoxScorePlayerStats("0022600001", "2026-10-21T23:30:00Z", {
      game: {
        awayTeam: {
          teamTricode: "LAL",
          players: [
            {
              personId: 2544,
              firstName: "LeBron",
              familyName: "James",
              statistics: {
                minutes: "PT35M30.00S", points: 28, reboundsTotal: 8, assists: 7, steals: 2, blocks: 1,
                turnovers: 3, threePointersMade: 2, fieldGoalsMade: 10, fieldGoalsAttempted: 19,
                freeThrowsMade: 6, freeThrowsAttempted: 7, reboundsOffensive: 1, reboundsDefensive: 7
              }
            },
            { personId: 1, firstName: "Did", familyName: "Not Play", statistics: { minutes: "PT0M0.00S" } }
          ]
        }
      }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nbaPlayerId: "2544", team: "LAL", season: "2026-27", minutes: 35.5, points: 28, rebounds: 8 });
  });

  it("limits calculated averages to NBA regular-season game ids", () => {
    expect(isRegularSeasonGame("0022600001")).toBe(true);
    expect(isRegularSeasonGame("0012600001")).toBe(false);
    expect(isRegularSeasonGame("0042600001")).toBe(false);
  });
});
