import { describe, expect, it } from "vitest";

import { playerMatchesNameSearch, savedLineupPlayerFallback } from "./lineup-picker";

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
