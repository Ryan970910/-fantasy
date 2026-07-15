import { describe, expect, it } from "vitest";

import { formatDateTime, historicalGameDates, playerMatchesNameSearch, savedLineupPlayerFallback } from "./lineup-picker";

describe("historicalGameDates", () => {
  it("returns distinct previous game dates with the latest first", () => {
    const lineups = [
      { gameDate: "2026-07-15" },
      { gameDate: "2026-07-14" },
      { gameDate: "2026-07-10" },
      { gameDate: "2026-07-14" },
      { gameDate: null }
    ];

    expect(historicalGameDates(lineups, "2026-07-15")).toEqual(["2026-07-14", "2026-07-10"]);
  });
});

describe("formatDateTime", () => {
  it("formats both UTC instants and database Beijing timestamps as Beijing time", () => {
    expect(formatDateTime("2026-07-15T10:22:00.000Z")).toContain("18:22");
    expect(formatDateTime("2026-07-15T18:22:00.000")).toContain("18:22");
  });
});

describe("playerMatchesNameSearch", () => {
  const player = { name: "卢卡·东契奇", englishName: "Luka Doncic" };

  it("matches partial Chinese and English names while ignoring separators and case", () => {
    expect(playerMatchesNameSearch(player, "东契奇")).toBe(true);
    expect(playerMatchesNameSearch(player, "LUKA")).toBe(true);
    expect(playerMatchesNameSearch(player, "luka-doncic")).toBe(true);
    expect(playerMatchesNameSearch(player, "马克西")).toBe(false);
  });
});

describe("savedLineupPlayerFallback", () => {
  it("keeps a saved player in the editor and applies the team lock", () => {
    const player = savedLineupPlayerFallback({
      slot: "PF",
      id: "nba-202331",
      name: "保罗·乔治",
      englishName: "Paul George",
      team: "PHI",
      position: "SF-PF",
      salary: 32,
      fantasyPoints: 24.4,
      stats: { points: 16, rebounds: 5, assists: 3, steals: 1, blocks: 0, turnovers: 2 }
    }, new Set(["PHI"]));

    expect(player.id).toBe("202331");
    expect(player.eligibleSlots).toEqual(["PF"]);
    expect(player.locked).toBe(true);
  });
});
