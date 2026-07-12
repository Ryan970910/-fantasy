import positionOverrides from "./player-position-overrides.json";

const configuredPositions: Record<string, string> = positionOverrides;

const positionLabels = {
  "Point Guard": "PG",
  "Shooting Guard": "SG",
  "Small Forward": "SF",
  "Power Forward": "PF",
  Center: "C"
} as const;

export type FantasySlot = "PG" | "SG" | "SF" | "PF" | "C";

export function normalizePlayerPositionName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'\u2019-]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function preferredFantasySlots(playerName: string, nbaPosition: string): FantasySlot[] {
  const configuredPosition = configuredPositions[normalizePlayerPositionName(playerName)];
  if (!configuredPosition) {
    const normalized = nbaPosition.toUpperCase();
    return [
      ...(normalized.includes("G") || normalized.includes("PG") ? ["PG" as const, "SG" as const] : []),
      ...(normalized.includes("F") || normalized.includes("SF") ? ["SF" as const, "PF" as const] : []),
      ...(normalized.includes("C") ? ["C" as const] : [])
    ];
  }

  const slots = configuredPosition
    .split(",")
    .map((value) => positionLabels[value.trim() as keyof typeof positionLabels])
    .filter((slot): slot is FantasySlot => Boolean(slot));

  return [...new Set(slots)];
}

export function preferredDisplayPosition(playerName: string, nbaPosition: string): string {
  const slots = preferredFantasySlots(playerName, nbaPosition);
  return slots.join("-") || nbaPosition;
}
