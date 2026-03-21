// ─── Recommendations engine ───────────────────────────────────────────────────
// Generates ≤3 action-oriented recommendations based on the new scoring
// which weights rank at 50%. Recommendations are rank-first, then activity signals.

import type { Recommendation, ScoreBreakdown, UserTier } from "./types";
import { SCORING_BENCHMARKS } from "./scoring";

interface RecommendationInput {
  tier: UserTier;
  scoreBreakdown: ScoreBreakdown;
  activeDays30d: number;
  currentStreak: number;
  volume7d: number;
  avgDailyVolume: number;
  totalVolume: number;
  rank: number | null;
}

export function generateRecommendations(input: RecommendationInput): Recommendation[] {
  const { tier, scoreBreakdown, activeDays30d, currentStreak, volume7d, avgDailyVolume, totalVolume, rank } = input;
  const recs: Recommendation[] = [];
  const { assumedCommunitySize } = SCORING_BENCHMARKS;

  // ── 1. Rank signal (most important — 50% of score) ────────────────────────
  if (rank !== null && rank > 0) {
    const pct = Math.round((rank / assumedCommunitySize) * 100);

    if (pct <= 1) {
      recs.push({
        title: `Top 1% — rank #${rank}`,
        description: "You are in the top 1% of Extended farmers. Focus on defending your position — consistency and weekly volume are your moat.",
        severity: "positive",
      });
    } else if (pct <= 5) {
      recs.push({
        title: `Top 5% — rank #${rank}`,
        description: `You are ranked #${rank}. A ${Math.round((rank * 0.8))} target would put you in the top 1%. Increasing weekly volume and streak length are the fastest levers.`,
        severity: "positive",
      });
    } else if (pct <= 10) {
      const rankToTop5 = Math.round(assumedCommunitySize * 0.05);
      recs.push({
        title: `Close to top 5% — rank #${rank}`,
        description: `You need to reach rank #${rankToTop5} to enter top 5%. At your current weekly pace, focus on consistency to close the gap.`,
        severity: "info",
      });
    } else if (pct <= 25) {
      const rankToTop10 = Math.round(assumedCommunitySize * 0.10);
      recs.push({
        title: `Top 25% — rank #${rank}`,
        description: `Target rank #${rankToTop10} for top 10%. Your weekly volume pace is the main lever — a 20% increase would accelerate your climb significantly.`,
        severity: "info",
      });
    } else {
      recs.push({
        title: `Rank #${rank} — room to climb`,
        description: `You are in the top ${pct}%. Increasing both weekly volume and active days will push your rank up consistently.`,
        severity: "warning",
      });
    }
  } else {
    recs.push({
      title: "No rank yet",
      description: "You don't have an official rank yet. Start trading consistently to enter the Extended leaderboard.",
      severity: "warning",
    });
  }

  // ── 2. Recent momentum vs own average ────────────────────────────────────
  const expectedWeekly = avgDailyVolume * 7;
  const recentRatio = expectedWeekly > 0 ? volume7d / expectedWeekly : 1;

  if (recentRatio < 0.5) {
    recs.push({
      title: "Recent momentum is slowing",
      description: `Your last 7 days ($${Math.round(volume7d / 1000)}k) represent only ${Math.round(recentRatio * 100)}% of your average weekly pace ($${Math.round(expectedWeekly / 1000)}k). This will drag your rank down if it continues.`,
      severity: "warning",
    });
  } else if (recentRatio > 1.3) {
    recs.push({
      title: "Above-average week — sustain it",
      description: `Your last 7 days ($${Math.round(volume7d / 1000)}k) are ${Math.round(recentRatio * 100)}% of your average weekly pace. Sustaining this tempo will improve your rank over the next epoch.`,
      severity: "positive",
    });
  }

  // ── 3. Consistency signal ─────────────────────────────────────────────────
  if (scoreBreakdown.consistencyScore < 40) {
    recs.push({
      title: "Consistency is your biggest weakness",
      description: `Active on ${activeDays30d}/30 days this month (score: ${scoreBreakdown.consistencyScore}/100). This is dragging your Edge Score — even small daily trades compound your consistency sub-score.`,
      severity: "warning",
    });
  } else if (scoreBreakdown.consistencyScore < 65) {
    recs.push({
      title: "Improve your daily cadence",
      description: `${activeDays30d} active days this month (score: ${scoreBreakdown.consistencyScore}/100). Reaching 22+ days would push your consistency sub-score above 78 and improve your rank trajectory.`,
      severity: "info",
    });
  }

  // ── 4. Streak signal ──────────────────────────────────────────────────────
  if (currentStreak === 0) {
    recs.push({
      title: "No active streak — start today",
      description: "A broken streak hurts your consistency score. Even a minimal trade resets the clock — don't let this compound.",
      severity: "warning",
    });
  } else if (currentStreak >= 10) {
    recs.push({
      title: `${currentStreak}-day streak — protect it`,
      description: `A ${currentStreak}-day streak is a strong consistency signal. One missed day now would cost more than it looks given its weight in your score.`,
      severity: "positive",
    });
  }

  // ── 5. Volume vs benchmark ────────────────────────────────────────────────
  if (scoreBreakdown.totalVolumeScore < 30) {
    recs.push({
      title: "Volume sub-score is low",
      description: `Your cumulative volume ($${Math.round(totalVolume / 1000)}k) scores ${scoreBreakdown.totalVolumeScore}/100 against the $${SCORING_BENCHMARKS.eliteVolume / 1_000_000}M benchmark. Growing weekly volume is the compounding lever here.`,
      severity: "info",
    });
  }

  return recs.slice(0, 3);
}
