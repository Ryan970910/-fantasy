export const FANTASY_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type FantasyPosition = (typeof FANTASY_POSITIONS)[number];
export type PositionPercentages = Record<FantasyPosition, number>;

export type SeasonPositionSample = {
  season: string;
  minutes: number;
  percentages: PositionPercentages;
};

export type ResolvedPlayerPosition = {
  positions: FantasyPosition[];
  percentages: PositionPercentages;
  currentSeasonMinutes: number;
  currentSeasonWeight: number;
  confidence: number;
  dataStatus: "PRESEASON_BASELINE" | "EARLY_SAMPLE" | "BLENDED" | "CURRENT_SEASON" | "PROFILE_FALLBACK" | "MANUAL_REVIEW";
};

const baselineWeights = [0.6, 0.3, 0.1];

export function emptyPositionPercentages(): PositionPercentages {
  return { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
}

function weightedAverage(samples: SeasonPositionSample[], weights: number[]) {
  const result = emptyPositionPercentages();
  const available = samples.map((sample, index) => ({ sample, weight: weights[index] || 0 })).filter(({ weight }) => weight > 0);
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return result;

  for (const { sample, weight } of available) {
    for (const position of FANTASY_POSITIONS) {
      result[position] += sample.percentages[position] * weight / totalWeight;
    }
  }
  return result;
}

export function selectPositions(percentages: PositionPercentages) {
  const ranked = FANTASY_POSITIONS.map((position) => ({ position, percentage: percentages[position] }))
    .sort((a, b) => b.percentage - a.percentage);
  if (!ranked[0] || ranked[0].percentage <= 0) return [];
  return [ranked[0], ...ranked.slice(1).filter((item) => item.percentage > 20)].slice(0, 2).map((item) => item.position);
}

export function resolvePlayerPosition(
  current: SeasonPositionSample | null,
  previous: SeasonPositionSample[],
  profilePositions: FantasyPosition[],
  profileWasRead = profilePositions.length > 0
): ResolvedPlayerPosition {
  const baseline = weightedAverage(previous.slice(0, 3), baselineWeights);
  const hasBaseline = FANTASY_POSITIONS.some((position) => baseline[position] > 0);
  const currentSeasonMinutes = current?.minutes || 0;
  const currentSeasonWeight = Math.min(currentSeasonMinutes / 600, 1);

  if (!current || currentSeasonMinutes <= 0) {
    if (profilePositions.length) {
      const percentages = emptyPositionPercentages();
      for (const position of profilePositions.slice(0, 2)) percentages[position] = 100 / Math.min(profilePositions.length, 2);
      return { positions: profilePositions.slice(0, 2), percentages, currentSeasonMinutes: 0, currentSeasonWeight: 0, confidence: 0.35, dataStatus: "PROFILE_FALLBACK" };
    }
    if (profileWasRead) {
      return { positions: [], percentages: emptyPositionPercentages(), currentSeasonMinutes: 0, currentSeasonWeight: 0, confidence: 0, dataStatus: "MANUAL_REVIEW" };
    }
    if (hasBaseline) {
      return { positions: selectPositions(baseline), percentages: baseline, currentSeasonMinutes: 0, currentSeasonWeight: 0, confidence: 0.6, dataStatus: "PRESEASON_BASELINE" };
    }
    return { positions: [], percentages: emptyPositionPercentages(), currentSeasonMinutes: 0, currentSeasonWeight: 0, confidence: 0, dataStatus: "MANUAL_REVIEW" };
  }

  const percentages = emptyPositionPercentages();
  for (const position of FANTASY_POSITIONS) {
    percentages[position] = hasBaseline
      ? current.percentages[position] * currentSeasonWeight + baseline[position] * (1 - currentSeasonWeight)
      : current.percentages[position];
  }
  const dataStatus = currentSeasonWeight >= 1 ? "CURRENT_SEASON" : currentSeasonMinutes < 150 ? "EARLY_SAMPLE" : "BLENDED";
  const positions = selectPositions(percentages);
  if (positions[1]) {
    const recent = current.percentages[positions[1]] >= 15 || (previous[0]?.percentages[positions[1]] || 0) >= 15;
    if (!recent) positions.pop();
  }
  return { positions, percentages, currentSeasonMinutes, currentSeasonWeight, confidence: hasBaseline ? 0.6 + currentSeasonWeight * 0.4 : currentSeasonWeight, dataStatus };
}
