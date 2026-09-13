import { describe, expect, it } from "vitest";
import { parseInjuryPages, recentReportLinks, reportTimestamp, type PdfPage } from "./nba-injuries";

describe("official report dates and retention", () => {
  it("resolves Eastern daylight/standard time, noon, midnight and invalid dates", () => {
    expect(new Date(reportTimestamp("Injury-Report_2026-03-17_08_00AM.pdf")!).toISOString()).toBe("2026-03-17T12:00:00.000Z");
    expect(new Date(reportTimestamp("Injury-Report_2026-01-17_12_00AM.pdf")!).toISOString()).toBe("2026-01-17T05:00:00.000Z");
    expect(new Date(reportTimestamp("Injury-Report_2026-01-17_12_00PM.pdf")!).toISOString()).toBe("2026-01-17T17:00:00.000Z");
    expect(reportTimestamp("Injury-Report_2026-02-30_08_00AM.pdf")).toBeNull();
    expect(reportTimestamp("Injury-Report_2026-03-08_02_30AM.pdf")).toBeNull();
  });
  it("keeps only official reports less than seven days old, deduplicated newest first", () => {
    const url = (day: string) => `https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-09-${day}_08_00AM.pdf`;
    const html = [url("13"), url("06"), url("07"), url("14"), url("13"), url("12").replace("ak-static.cms.nba.com", "example.com")].join("\n");
    expect(recentReportLinks(html, Date.parse("2026-09-13T12:00:00Z")).map(item => item.url)).toEqual([url("13"), url("07")]);
  });
});

const cell = (x: number, y: number, value: string) => ({ x, y, R: [{ T: encodeURIComponent(value) }] });
const header = [cell(1, 6, "Game"), cell(3, 6, "Date"), cell(7, 6, "Game"), cell(9, 6, "Time"), cell(12, 6, "Matchup"), cell(16, 6, "Team"), cell(26, 6, "Player"), cell(36, 6, "Current"), cell(41, 6, "Reason")];

describe("official PDF table parsing", () => {
  it("keeps wrapped reasons with centered names, carries page context, and separates unsubmitted teams", () => {
    const pages: PdfPage[] = [
      { HLines: [{ x: 36, y: 10 }, { x: 36, y: 13 }], Texts: [
        ...header, cell(1, 8, "09/13/2026"), cell(12, 8, "BOS@NYK"), cell(16, 8, "Boston Celtics"),
        cell(26, 8, "Example Jr., Test"), cell(36, 8, "Questionable"),
        cell(41, 7.5, "Injury/Illness - Left Knee;"), cell(41, 8.5, "Soreness"),
        cell(26, 11, "Sample, Other"), cell(36, 11, "Out"), cell(41, 11, "Injury/Illness - Right Shoulder;")
      ] },
      { HLines: [{ x: 36, y: 6 }, { x: 36, y: 9 }], Texts: [
        cell(17, 3, "Injury"), cell(41, 5, "Impingement"), cell(16, 7, "New York Knicks"), cell(26, 7, "NOT YET SUBMITTED"),
        cell(24, 33, "Page"), cell(26, 33, "2 of 2")
      ] }
    ];
    const result = parseInjuryPages(pages);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({ englishName: "Test Example Jr.", status: "Questionable", reason: "Injury/Illness - Left Knee; Soreness" });
    expect(result.entries[1]).toMatchObject({ team: "Boston Celtics", matchup: "BOS@NYK", gameDate: "2026-09-13", reason: "Injury/Illness - Right Shoulder; Impingement" });
    expect(result.pendingTeams).toEqual([{ gameDate: "2026-09-13", matchup: "BOS@NYK", team: "New York Knicks" }]);
    expect(() => parseInjuryPages([{ ...pages[0], Texts: pages[0].Texts.map(item => item.x === 36 && item.y === 8 ? cell(36, 8, "Unknown") : item) }])).toThrow("Unrecognized injury row");
    expect(() => parseInjuryPages([])).toThrow();
  });
});
