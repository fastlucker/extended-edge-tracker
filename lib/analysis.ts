// ─── Analysis orchestrator ────────────────────────────────────────────────────

import type { WalletAnalysis, DailyActivity } from "./types";
import type { MappedLeaderboardStats, MappedRewards, MappedTrade, MappedPositionsHistory } from "./extended-mappers";
import { buildActivityTimeline } from "./extended-mappers";
import { computeScoreBreakdown, scoreToTier, estimatePercentile } from "./scoring";
import { computeConsistency } from "./consistency";
import { computeProjections } from "./projections";
import { generateRecommendations } from "./recommendations";
import type { ExtendedAccountInfo } from "./types";

interface RawAnalysisInput {
  account: ExtendedAccountInfo;
  leaderboard: MappedLeaderboardStats;
  rewards: MappedRewards;
  trades: MappedTrade[];
  positions: MappedPositionsHistory;
}

export function assembleAnalysis(input: RawAnalysisInput): WalletAnalysis {
  const { account, leaderboard, rewards, trades, positions } = input;

  const totalPoints = leaderboard.totalPoints > 0 ? leaderboard.totalPoints : rewards.totalPoints;

  // Total volume: from /user/referrals/status (exact full history)
  const recentTradeVolume = trades.reduce((s, t) => s + t.volume, 0);
  const totalVolume = positions.totalVolume > 0 ? positions.totalVolume : recentTradeVolume;

  const activityAll: DailyActivity[] = buildActivityTimeline(trades, rewards.epochRewards);

  // 7D volume: last 7 days including today (J-6 to J+0)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sixDaysAgo = new Date(today);
  sixDaysAgo.setUTCDate(today.getUTCDate() - 6);
  const sixDaysAgoStr = sixDaysAgo.toISOString().split("T")[0];
  const volume7d = activityAll
    .filter(d => d.date >= sixDaysAgoStr)
    .reduce((s, d) => s + d.volume, 0);

  // Avg daily volume = totalVolume / nb days since first trade
  // Uses the real total volume (not just recent 300 trades) for accuracy
  let avgDailyVolume = 0;
  if (activityAll.length > 0 && totalVolume > 0) {
    const firstDate = new Date(activityAll[0].date);
    const todayDate = new Date(today);
    const daysSinceStart = Math.max(1, Math.round((todayDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
    avgDailyVolume = Math.round(totalVolume / daysSinceStart);
  }

  const consistency = computeConsistency(activityAll);

  const scoreBreakdown = computeScoreBreakdown(
    totalVolume,
    consistency.activeDays30d,
    volume7d,
    avgDailyVolume,
    activityAll,
    totalPoints,
    leaderboard.rank
  );

  const tier = scoreToTier(scoreBreakdown.finalScore);
  const estimatedPercentile = estimatePercentile(scoreBreakdown.finalScore, leaderboard.rank);

  const projections = computeProjections(
    "current", volume7d, totalPoints, totalVolume,
    consistency.activeDays30d, activityAll,
    leaderboard.rank, avgDailyVolume
  );

  const recommendations = generateRecommendations({
    tier, scoreBreakdown,
    activeDays30d: consistency.activeDays30d,
    currentStreak: consistency.currentStreak,
    volume7d, avgDailyVolume, totalVolume,
    rank: leaderboard.rank,
  });

  return {
    account, totalPoints, rank: leaderboard.rank, estimatedPercentile,
    totalVolume, volume7d, avgDailyVolume,
    activeDays30d: consistency.activeDays30d,
    currentStreak: consistency.currentStreak,
    longestStreak: consistency.longestStreak,
    consistencyScore: consistency.consistencyScore,
    tier, scoreBreakdown,
    activity30d: activityAll,
    recommendations, projections,
    dataSource: "real",
  };
}
