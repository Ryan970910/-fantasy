import { describe, expect, it } from "vitest";
import { resolvePlayerPosition, selectPositions, type SeasonPositionSample } from "./player-position-resolution";

const sample = (season: string, minutes: number, PG: number, SG: number, SF = 0, PF = 0, C = 0): SeasonPositionSample => ({ season, minutes, percentages: { PG, SG, SF, PF, C } });

describe("player position resolution", () => {
  it("uses a strict 20 percent threshold and keeps at most two positions", () => {
    expect(selectPositions({ PG: 45, SG: 35, SF: 20, PF: 0, C: 0 })).toEqual(["PG", "SG"]);
    expect(selectPositions({ PG: 40, SG: 30, SF: 30, PF: 0, C: 0 })).toEqual(["PG", "SG"]);
  });

  it("uses the personal profile for a player with zero current minutes", () => {
    const result = resolvePlayerPosition(null, [sample("2025-26", 1800, 10, 70, 20)], ["SF"]);
    expect(result.positions).toEqual(["SF"]);
    expect(result.dataStatus).toBe("PROFILE_FALLBACK");
  });

  it("blends current and baseline equally at 300 minutes", () => {
    const result = resolvePlayerPosition(sample("2026-27", 300, 80, 20), [sample("2025-26", 1800, 20, 80)], []);
    expect(result.percentages.PG).toBe(50);
    expect(result.percentages.SG).toBe(50);
    expect(result.currentSeasonWeight).toBe(0.5);
  });

  it("fully adopts the current season at 600 minutes", () => {
    const result = resolvePlayerPosition(sample("2026-27", 600, 90, 10), [sample("2025-26", 1800, 10, 90)], []);
    expect(result.positions).toEqual(["PG"]);
    expect(result.dataStatus).toBe("CURRENT_SEASON");
  });

  it("uses a profile fallback when no season data exists", () => {
    const result = resolvePlayerPosition(null, [], ["PF"]);
    expect(result.positions).toEqual(["PF"]);
    expect(result.dataStatus).toBe("PROFILE_FALLBACK");
  });

  it("requires manual review when a read profile only has a broad position", () => {
    const result = resolvePlayerPosition(null, [sample("2025-26", 1800, 20, 80)], [], true);
    expect(result.positions).toEqual([]);
    expect(result.dataStatus).toBe("MANUAL_REVIEW");
  });
});
