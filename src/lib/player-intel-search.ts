import { normalizeTranslationName } from "./player-name-translations";

export function matchesIntelPlayer(player: { playerName: string; englishName: string }, query: string) {
  const normalized = normalizeTranslationName(query);
  return !normalized || [player.playerName, player.englishName].some(name => normalizeTranslationName(name).includes(normalized));
}
