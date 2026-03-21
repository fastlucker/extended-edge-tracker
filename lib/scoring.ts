// ─── Edge Score engine ────────────────────────────────────────────────────────
//
// Weighting:
//   Rank score      → 50%  (official Extended leaderboard rank)
//   Volume          → 20%  (40% of remaining 50%)
//   Consistency     → 15%  (30% of remaining 50%)
//   Recent activity → 10%  (20% of remaining 50%)
//   Growth trend    →  5%  (10% of remaining 50%)
//
// Benchmarks (shown in UI):
//   Rank:        top rank = #1, Elite threshold ≈ top 500 (~rank ≤ 500 out of ~50k)
//   Volume:      $20M cumulative = Elite benchmark
//   Consistency: 28 active days / 30 = Elite benchmark
//   Recent:      100% of your own avg daily pace = baseline
//   Growth:      volume this week ≥ last week = positive signal

import type { DailyActivity, ScoreBreakdown, UserTier } from "./types";

export const SCORING_BENCHMARKS = {
  eliteVolume: 20_000_000,       // $20M cumulative volume = 100 on volume sub-score
  eliteActiveDays: 28,           // 28/30 active days = 100 on consistency sub-score
  assumedCommunitySize: 50_000,  // estimated total Extended farmers for percentile
  eliteRank: 500,                // rank ≤ 500 = 100 on rank sub-score
};

export function computeScoreBreakdown(
  totalVolume: number,
  activeDays30d: number,
  volume7d: number,
  avgDailyVolume: number,
  activityAll: DailyActivity[],
  totalPoints: number = 0,
  rank: number | null = null
): ScoreBreakdown {
  // ── Rank sub-score (50%) ──────────────────────────────────────────────────
  // rank #1 = 100, rank #500 = ~60, rank #5000 = ~20, no rank = 0
  // Formula: max(0, 100 - (rank / eliteRank) * 40) capped at 100
  // Or simpler: percentile-based — top 1% = 100, top 50% = 50
  let rankScore = 0;
  if (rank !== null && rank > 0) {
    // Convert rank to a 0-100 score: rank 1 = 100, rank 50k = 0
    rankScore = Math.max(0, Math.min(100, Math.round((1 - (rank - 1) / SCORING_BENCHMARKS.assumedCommunitySize) * 100)));
  }

  // ── Volume sub-score (20%) ────────────────────────────────────────────────
  const totalVolumeScore = Math.min(100, Math.round((totalVolume / SCORING_BENCHMARKS.eliteVolume) * 100));

  // ── Consistency sub-score (15%) ───────────────────────────────────────────
  const consistencyScore = Math.min(100, Math.round((activeDays30d / SCORING_BENCHMARKS.eliteActiveDays) * 100));

  // ── Recent activity sub-score (10%) ──────────────────────────────────────
  const expectedWeekly = Math.max(1, avgDailyVolume * 7);
  const recentActivityScore = Math.min(100, Math.round((volume7d / expectedWeekly) * 80));

  // ── Growth trend sub-score (5%) ───────────────────────────────────────────
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const d6ago = new Date(today); d6ago.setUTCDate(today.getUTCDate() - 6);
  const d13ago = new Date(today); d13ago.setUTCDate(today.getUTCDate() - 13);
  const d6agoStr = d6ago.toISOString().split("T")[0];
  const d13agoStr = d13ago.toISOString().split("T")[0];
  const last7 = activityAll.filter(d => d.date >= d6agoStr).reduce((s, d) => s + d.volume, 0);
  const prev7 = activityAll.filter(d => d.date >= d13agoStr && d.date < d6agoStr).reduce((s, d) => s + d.volume, 0);
  const ratio = prev7 > 0 ? last7 / prev7 : last7 > 0 ? 1.5 : 0.5;
  const growthScore = Math.min(100, Math.max(0, Math.round(ratio * 60)));

  // ── Final weighted score ──────────────────────────────────────────────────
  const finalScore = Math.round(
    rankScore         * 0.50 +
    totalVolumeScore  * 0.20 +
    consistencyScore  * 0.15 +
    recentActivityScore * 0.10 +
    growthScore       * 0.05
  );

  return { totalVolumeScore, consistencyScore, recentActivityScore, growthScore, finalScore, rankScore };
}

export function scoreToTier(finalScore: number): UserTier {
  if (finalScore >= 85) return "Elite";
  if (finalScore >= 70) return "Strong";
  if (finalScore >= 40) return "Average";
  return "Underfarming";
}

export function estimatePercentile(finalScore: number, rank: number | null): number {
  if (rank !== null && rank > 0) {
    return Math.max(1, Math.min(99, Math.round((rank / SCORING_BENCHMARKS.assumedCommunitySize) * 100)));
  }
  return Math.max(1, Math.round(100 - finalScore * 0.95));
}
