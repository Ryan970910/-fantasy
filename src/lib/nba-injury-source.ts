import PDFParser from "pdf2json";
import { parseInjuryPages, recentReportLinks, REPORT_RETENTION_MS, type InjuryReport } from "./nba-injuries";

const OFFICIAL_HOME = "https://official.nba.com/";
const CACHE_MS = 5 * 60 * 1000;
let cached: InjuryReport | undefined;
let expiresAt = 0;
let pending: Promise<InjuryReport> | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

async function request(url: string) {
  const response = await fetch(url, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "FantasyNBA/1.0 (official injury report reader)", Accept: "text/html,application/pdf" }
  });
  if (!response.ok) throw new Error("Official injury source unavailable");
  return response;
}

export async function fetchOfficialInjuries(now = Date.now()): Promise<InjuryReport> {
  const home = await (await request(OFFICIAL_HOME)).text();
  const sourceUrl = [...new Set(home.match(/https:\/\/official\.nba\.com\/nba-injury-report-\d{4}-\d{2}-season\//g) || [])].sort().at(-1);
  if (!sourceUrl) throw new Error("Official injury report index unavailable");
  const html = await (await request(sourceUrl)).text();
  if (!/injury report/i.test(html)) throw new Error("Invalid official injury index");
  const latest = recentReportLinks(html, now)[0];
  const base: InjuryReport = { sourceUrl, reportUrl: latest?.url ?? null, publishedAt: latest ? new Date(latest.published).toISOString() : null, fetchedAt: new Date(now).toISOString(), entries: [], pendingTeams: [] };
  if (!latest) return base;
  const response = await request(latest.url);
  if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("Expected official PDF");
  // Official reports are small; reject unexpectedly large documents before parsing.
  if (Number(response.headers.get("content-length")) > 5_000_000) throw new Error("Injury PDF too large");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5_000_000 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid injury PDF");
  const parsed = await new Promise<ReturnType<typeof parseInjuryPages>>((resolve, reject) => {
    const parser = new PDFParser();
    const timer = setTimeout(() => { parser.destroy(); reject(new Error("Injury PDF parse timeout")); }, 10000);
    parser.on("pdfParser_dataError", () => { clearTimeout(timer); parser.destroy(); reject(new Error("Injury PDF parse failed")); });
    parser.on("pdfParser_dataReady", data => {
      clearTimeout(timer);
      try { resolve(parseInjuryPages(data.Pages)); } catch (error) { reject(error); }
      finally { parser.destroy(); }
    });
    parser.parseBuffer(bytes);
  });
  return { ...base, ...parsed };
}

export async function loadOfficialInjuries() {
  const now = Date.now();
  if (cached && now < expiresAt) return cached;
  cached = undefined;
  if (!pending) pending = fetchOfficialInjuries().then(report => {
    if (report.publishedAt && Date.now() - Date.parse(report.publishedAt) >= REPORT_RETENTION_MS) {
      report = { ...report, reportUrl: null, publishedAt: null, entries: [], pendingTeams: [] };
    }
    expiresAt = Math.min(Date.now() + CACHE_MS, report.publishedAt ? Date.parse(report.publishedAt) + REPORT_RETENTION_MS : Infinity);
    if (expiresAt > Date.now()) {
      cached = report;
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => { cached = undefined; }, expiresAt - Date.now());
      expiryTimer.unref();
    }
    return report;
  }).finally(() => { pending = undefined; });
  return pending;
}
