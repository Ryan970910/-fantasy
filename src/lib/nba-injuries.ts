export const REPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const INJURY_STATUS = {
  Out: "缺阵", Doubtful: "大概率缺阵", Questionable: "出战成疑",
  Probable: "大概率出战", Available: "可出战"
} as const;

export type InjuryEntry = {
  gameDate: string; matchup: string; team: string; englishName: string;
  name: string; status: keyof typeof INJURY_STATUS; reason: string;
};
export type InjuryReport = {
  sourceUrl: string; reportUrl: string | null; publishedAt: string | null;
  fetchedAt: string; entries: InjuryEntry[];
  pendingTeams: { gameDate: string; matchup: string; team: string }[];
};
export type PdfText = { x: number; y: number; R: { T: string }[] };
export type PdfPage = { Texts: PdfText[]; HLines: { x: number; y: number }[] };

// NBA filenames use Eastern wall time. Resolve DST through the IANA timezone.
export function reportTimestamp(url: string): number | null {
  const match = /Injury-Report_(\d{4}-\d{2}-\d{2})_(\d{2})_(\d{2})(AM|PM)\.pdf$/.exec(url);
  if (!match) return null;
  const [, day, hours, minutes, period] = match;
  if (+hours < 1 || +hours > 12 || +minutes > 59) return null;
  const hour = +hours % 12 + (period === "PM" ? 12 : 0);
  const wall = `${day}T${String(hour).padStart(2, "0")}:${minutes}:00`;
  const nominal = Date.parse(`${wall}Z`);
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 10) !== day) return null;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  for (const offset of [4, 5]) {
    const candidate = nominal + offset * 3600000;
    if (formatter.format(candidate).replace(" ", "T") === wall) return candidate;
  }
  return null;
}

export function recentReportLinks(html: string, now: number) {
  const links = [...new Set(html.match(/https:\/\/ak-static\.cms\.nba\.com\/referee\/injury\/Injury-Report_\d{4}-\d{2}-\d{2}_\d{2}_\d{2}(?:AM|PM)\.pdf/g) || [])];
  return links.flatMap(url => {
    const published = reportTimestamp(url);
    return published !== null && published <= now && now - published < REPORT_RETENTION_MS ? [{ url, published }] : [];
  }).sort((a, b) => b.published - a.published);
}

export function parseInjuryPages(pages: PdfPage[]) {
  const entries: InjuryEntry[] = [];
  const pendingTeams: InjuryReport["pendingTeams"] = [];
  const first = pages[0]?.Texts;
  if (!first) throw new Error("Empty injury PDF");
  const text = (item: PdfText) => item.R.map(run => decodeURIComponent(run.T)).join("").trim();
  const labels = ["Game", "Game", "Matchup", "Team", "Player", "Current", "Reason"];
  const header = first.filter(item => Math.abs(item.y - (first.find(t => text(t) === "Matchup")?.y ?? -1)) < 0.1).sort((a, b) => a.x - b.x);
  let cursor = 0;
  const columns = labels.map(label => {
    const index = header.findIndex((item, i) => i >= cursor && text(item) === label);
    if (index < 0) throw new Error("Unrecognized injury report columns");
    cursor = index + 1;
    return header[index].x - 0.1;
  });
  let gameDate = "", matchup = "", team = "";
  let active: InjuryEntry | undefined;
  for (const page of pages) {
    // Cell borders, rather than text baselines, keep centered names with wrapped reasons.
    const boundaries = [...new Set(page.HLines.filter(line => Math.abs(line.x - columns[5] - 0.1) < 0.05).map(line => line.y))].sort((a, b) => a - b);
    if (!boundaries.length) throw new Error("Missing injury row borders");
    const footer = page.Texts.find(item => text(item) === "Page")?.y ?? Infinity;
    const heading = page.Texts.find(item => text(item) === "Injury")?.y ?? 0;
    const localHeader = page.Texts.find(item => text(item) === "Matchup")?.y ?? heading;
    const groups = new Map<number, PdfText[]>();
    for (const item of page.Texts) {
      if (item.y <= localHeader + 0.1 || item.y >= footer - 0.1) continue;
      const boundary = boundaries.find(bottom => bottom > item.y) ?? Infinity;
      const group = groups.get(boundary) ?? [];
      group.push(item);
      groups.set(boundary, group);
    }
    for (const [, group] of [...groups].sort(([a], [b]) => a - b)) {
      const line = group.sort((a, b) => Math.abs(a.y - b.y) < 0.1 ? a.x - b.x : a.y - b.y);
      const joined = line.map(text).join(" ");
      const cells = columns.map((left, i) => line.filter(t => t.x >= left && t.x < (columns[i + 1] ?? Infinity)).map(text).join(" ").trim());
      if (cells.every(cell => !cell)) continue;
      if (cells[0]) {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(cells[0])) throw new Error("Invalid injury game date");
        const [month, day, year] = cells[0].split("/");
        gameDate = `${year}-${month}-${day}`;
      }
      if (cells[2]) { matchup = cells[2]; active = undefined; }
      if (cells[3]) { team = cells[3]; active = undefined; }
      if (joined.includes("NOT YET SUBMITTED")) {
        if (!team || !gameDate || !matchup) throw new Error("Missing pending team context");
        pendingTeams.push({ gameDate, matchup, team });
        active = undefined;
      } else if (cells[4] || cells[5]) {
        const status = cells[5];
        if (!(status in INJURY_STATUS) || !cells[4].includes(",") || !team || !gameDate || !/^[A-Z]{2,3}@[A-Z]{2,3}$/.test(matchup)) throw new Error("Unrecognized injury row");
        const [last, ...given] = cells[4].split(",");
        const englishName = `${given.join(",").trim()} ${last}`;
        active = { gameDate, matchup, team, englishName, name: englishName, status: status as InjuryEntry["status"], reason: cells[6] };
        entries.push(active);
      } else if (cells[6]) {
        if (!active) throw new Error("Orphan injury reason");
        active.reason = `${active.reason} ${cells[6]}`.trim();
      }
    }
  }
  if (!entries.length && !pendingTeams.length) throw new Error("No recognizable injury rows");
  return { entries, pendingTeams };
}
