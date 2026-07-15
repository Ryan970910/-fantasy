import { describe, expect, it } from "vitest";

import { allGamesStarted, gameHasStarted, lockedTeamCodes, nbaGameDate } from "./game-window";

const future = "2026-07-15T02:30:00Z";
const past = "2026-07-14T19:30:00Z";
const now = Date.parse("2026-07-15T00:49:00Z");

describe("game window", () => {
  it("uses the NBA Eastern date instead of the Beijing calendar date", () => {
    expect(nbaGameDate(0, now)).toBe("2026-07-14");
  });

  it("locks only games whose official status has started", () => {
    expect(gameHasStarted({ status: 1, startTimeUTC: past }, now)).toBe(false);
    expect(gameHasStarted({ status: 0, startTimeUTC: future }, now)).toBe(false);
    expect(gameHasStarted({ status: 2, startTimeUTC: future }, now)).toBe(true);
  });

  it("keeps a game day active until every game starts and locks only started teams", () => {
    const games = [
      { status: 2, homeTeam: { tricode: "LAL" }, awayTeam: { tricode: "BOS" } },
      { status: 1, homeTeam: { tricode: "LAC" }, awayTeam: { tricode: "WAS" } }
    ];

    expect(allGamesStarted(games, now)).toBe(false);
    expect(Array.from(lockedTeamCodes(games, now)).sort()).toEqual(["BOS", "LAL"]);
  });
});
