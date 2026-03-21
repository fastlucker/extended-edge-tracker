// ─── Projections engine ───────────────────────────────────────────────────────
//
// Baseline : ton volume7d / 7 = pace quotidienne de la semaine en cours
// avgDailyVolume : totalVolume / nb_jours (passé en paramètre depuis analysis.ts)
//
// Modes :
//   conservative × 0.65 — tu trades 35% moins que cette semaine
//   current      × 1.00 — tu maintiens exactement ton pace actuel
//   aggressive   × 1.45 — tu trades 45% plus que cette semaine
//
// Points projetés :
//   On utilise le ratio points/volume de l'epoch en cours (7 derniers jours)
//   plutôt que le ratio historique global — plus représentatif de l'activité récente.
//   Si volume7d = 0, on replie sur le ratio global (totalPoints / totalVolume).
//
// Score projeté :
//   On recalcule le Edge Score avec les nouvelles valeurs projetées.
//   Le rank est conservé (on ne peut pas prédire l'évolution du rank des autres).
//   Le volume total projeté = totalVolume + volume additionnel sur la période.

import type { ProjectionMode, ProjectionResult, Projections, UserTier } from "./types";
import { computeScoreBreakdown, scoreToTier } from "./scoring";
import type { DailyActivity } from "./types";

const MODE_MULTIPLIERS: Record<ProjectionMode, number> = {
  conservative: 0.65,
  current:      1.00,
  aggressive:   1.45,
};

export function computeProjections(
  mode: ProjectionMode,
  volume7d: number,
  totalPoints: number,
  totalVolume: number,
  activeDays30d: number,
  activityAll: DailyActivity[],
  rank: number | null = null,
  avgDailyVolume: number = 0
): Projections {
  const mult = MODE_MULTIPLIERS[mode];

  // Pace quotidienne basée sur volume7d (semaine en cours)
  // Si volume7d = 0 (pas de trades cette semaine), on replie sur avgDailyVolume
  const baseDailyPace = volume7d > 0 ? volume7d / 7 : avgDailyVolume;
  const dailyVolumePace = baseDailyPace * mult;

  // Ratio points/volume : priorité à l'epoch courante (7d), fallback global
  const ptPerVolRecent = volume7d > 0
    ? (activityAll.slice(-7).reduce((s, d) => s + d.points, 0)) / volume7d
    : 0;
  const ptPerVolGlobal = totalVolume > 0 ? totalPoints / totalVolume : 0.0003;
  const ptPerVol = ptPerVolRecent > 0 ? ptPerVolRecent : ptPerVolGlobal;

  const dailyPointsPace = dailyVolumePace * ptPerVol;

  // Volumes et points projetés
  const proj7Volume  = Math.round(dailyVolumePace * 7);
  const proj7Points  = Math.round(dailyPointsPace * 7);
  const proj30Volume = Math.round(dailyVolumePace * 30);
  const proj30Points = Math.round(dailyPointsPace * 30);

  // Consistency projetée : si aggressive, plus de jours actifs
  const projActiveDays30d = Math.min(30, Math.round(activeDays30d * mult));

  // Score projeté 7j : totalVolume + proj7Volume, rank inchangé
  const proj7Breakdown = computeScoreBreakdown(
    totalVolume + proj7Volume,
    projActiveDays30d,
    proj7Volume,          // volume7d projeté = ce qu'on ferait sur 7j
    dailyVolumePace,      // avgDailyVolume projeté
    activityAll,
    totalPoints + proj7Points,
    rank                  // rank conservé — on ne peut pas prédire son évolution
  );

  // Score projeté 30j : totalVolume + proj30Volume, rank inchangé
  const proj30Breakdown = computeScoreBreakdown(
    totalVolume + proj30Volume,
    projActiveDays30d,
    proj30Volume / 4,     // approximation : volume sur 7j dans les 30j projetés
    dailyVolumePace,
    activityAll,
    totalPoints + proj30Points,
    rank
  );

  return {
    sevenDay: {
      volume: proj7Volume,
      points: proj7Points,
      score:  proj7Breakdown.finalScore,
      tier:   scoreToTier(proj7Breakdown.finalScore),
    },
    thirtyDay: {
      volume: proj30Volume,
      points: proj30Points,
      score:  proj30Breakdown.finalScore,
      tier:   scoreToTier(proj30Breakdown.finalScore),
    },
  };
}
