import { describe, expect, it } from "vitest";

import { playerMatchesNameSearch } from "./lineup-picker";

describe("playerMatchesNameSearch", () => {
  const player = { name: "卢卡·东契奇", englishName: "Luka Doncic" };

  it("matches partial Chinese and English names while ignoring separators and case", () => {
    expect(playerMatchesNameSearch(player, "东契奇")).toBe(true);
    expect(playerMatchesNameSearch(player, "LUKA")).toBe(true);
    expect(playerMatchesNameSearch(player, "luka-doncic")).toBe(true);
    expect(playerMatchesNameSearch(player, "马克西")).toBe(false);
  });
});
