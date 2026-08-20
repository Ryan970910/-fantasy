import { describe, expect, it } from "vitest";
import { parseBbrPositionRows, parseProfilePositions } from "./player-position-sync";

describe("player position source parsing", () => {
  it("keeps the aggregate row for a traded player", () => {
    const html = `<table id="pbp_stats"><tbody>
      <tr><td data-stat="name_display"><a href="/players/t/testpl01.html">Test Player</a></td><td data-stat="team_name_abbr">2TM</td><td data-stat="games">20</td><td data-stat="mp">600</td><td data-stat="pct_1">45%</td><td data-stat="pct_2">35%</td><td data-stat="pct_3">20%</td><td data-stat="pct_4">0%</td><td data-stat="pct_5">0%</td></tr>
      <tr><td data-stat="name_display"><a href="/players/t/testpl01.html">Test Player</a></td><td data-stat="team_name_abbr">AAA</td><td data-stat="games">10</td><td data-stat="mp">300</td><td data-stat="pct_1">80%</td><td data-stat="pct_2">20%</td><td data-stat="pct_3">0%</td><td data-stat="pct_4">0%</td><td data-stat="pct_5">0%</td></tr>
    </tbody></table>`;
    const rows = parseBbrPositionRows(html, "2026-27", "source");
    expect(rows).toHaveLength(1);
    expect(rows[0].team).toBe("2TM");
    expect(rows[0].percentages.SF).toBe(20);
  });

  it("maps specific personal-page positions and rejects broad labels", () => {
    expect(parseProfilePositions("Position: Point Guard and Shooting Guard &#9642; Shoots: Right</p>")).toEqual(["PG", "SG"]);
    expect(parseProfilePositions("Position: Forward &#9642; Shoots: Right</p>")).toEqual([]);
  });
});
