import { afterEach, expect, it, vi } from "vitest";
import { fetchOfficialInjuries, loadOfficialInjuries } from "./nba-injury-source";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const index = "https://official.nba.com/nba-injury-report-2026-27-season/";
it("returns an explicit empty report when the official page has no recent report, without requesting old PDFs", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(`<a href="${index}">Team Injury Reports</a>`))
    .mockResolvedValueOnce(new Response("Injury Report <a href='https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-09-01_08_00AM.pdf'>old</a>"));
  vi.stubGlobal("fetch", fetcher);
  const result = await fetchOfficialInjuries(Date.parse("2026-09-13T12:00:00Z"));
  expect(result).toMatchObject({ reportUrl: null, publishedAt: null, entries: [], pendingTeams: [], sourceUrl: index });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(call => call[1].cache === "no-store")).toBe(true);
});
it("fails closed on upstream errors, missing indexes and invalid PDF content", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
  await expect(fetchOfficialInjuries()).rejects.toThrow("unavailable");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>challenge</html>")));
  await expect(fetchOfficialInjuries()).rejects.toThrow("index unavailable");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(index))
    .mockResolvedValueOnce(new Response("Injury Report https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-09-13_08_00AM.pdf"))
    .mockResolvedValueOnce(new Response("<html>blocked</html>", { headers: { "content-type": "text/html" } })));
  await expect(fetchOfficialInjuries(Date.parse("2026-09-13T12:00:00Z"))).rejects.toThrow("Expected official PDF");
});

it("shares concurrent loads in process memory and expires successful results after five minutes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T12:00:00Z"));
  const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(url === "https://official.nba.com/" ? index : "Injury Report"));
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([loadOfficialInjuries(), loadOfficialInjuries()]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
  await loadOfficialInjuries();
  expect(fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  await loadOfficialInjuries();
  expect(fetcher).toHaveBeenCalledTimes(4);
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
});
