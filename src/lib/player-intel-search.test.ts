import { describe, expect, it } from "vitest";
import { matchesIntelPlayer } from "./player-intel-search";

describe("intel name search", () => {
  const player = { playerName: "尼古拉·约基奇", englishName: "Nikola Jokić" };
  it("matches Chinese and accent-insensitive English partial names", () => {
    expect(matchesIntelPlayer(player, "约基奇")).toBe(true);
    expect(matchesIntelPlayer(player, "  JOKIC  ")).toBe(true);
    expect(matchesIntelPlayer(player, "库里")).toBe(false);
    expect(matchesIntelPlayer(player, " ")).toBe(true);
  });
});
