import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/nba-injury-source", () => ({ loadOfficialInjuries: vi.fn() }));
vi.mock("@/lib/player-name-translations", () => ({ loadPlayerNameTranslations: vi.fn(), translatePlayerName: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { getCurrentUser } from "@/lib/auth";
import { loadOfficialInjuries } from "@/lib/nba-injury-source";
import { GET } from "./route";

afterEach(() => vi.resetAllMocks());
it("requires authentication before requesting official data", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(loadOfficialInjuries).not.toHaveBeenCalled();
});
it("serves authenticated empty reports without persistent browser caching and distinguishes upstream failures", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "test", email: "test@example.invalid", name: "Test" });
  vi.mocked(loadOfficialInjuries).mockResolvedValue({ sourceUrl: "https://official.nba.com/", reportUrl: null, publishedAt: null, fetchedAt: "2026-09-13T12:00:00Z", entries: [], pendingTeams: [] });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ reportUrl: null, entries: [] });
  vi.mocked(loadOfficialInjuries).mockRejectedValue(new Error("Upstream 403"));
  expect((await GET()).status).toBe(503);
});
