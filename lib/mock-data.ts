// ─── Mock data ────────────────────────────────────────────────────────────────
// Used only when ENABLE_MOCK_MODE = true.
// Generates stable, deterministic fake data from an API key string.
// Shape is identical to real WalletAnalysis so the frontend is unaffected.

import type { WalletAnalysis, DailyActivity } from "./types";
import { computeScoreBreakdown, scoreToTier, estimatePercentile } from "./scoring";
import { computeConsistency } from "./consistency";
import { computeProjections } from "./projections";
import { generateRecommendations } from "./recommendations";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const PROFILES = [
  { name: "Beginner",     totalVolume: 180_000,  totalPoints: 12_000,  activeDaysBase: 8,  trendMult: 0.6 },
  { name: "Casual",       totalVolume: 620_000,  totalPoints: 48_000,  activeDaysBase: 14, trendMult: 0.85 },
  { name: "Consistent",   totalVolume: 1_800_000,totalPoints: 142_000, activeDaysBase: 22, trendMult: 1.1 },
  { name: "Heavy Volume", totalVolume: 4_200_000,totalPoints: 310_000, activeDaysBase: 18, trendMult: 1.3 },
  { name: "Elite",        totalVolume: 9_800_000,totalPoints: 740_000, activeDaysBase: 27, trendMult: 1.5 },
];

export function generateMockAnalysis(apiKey: string): WalletAnalysis {
  const hash = hashString(apiKey);
  const rng = seededRng(hash);
  const profile = PROFILES[hash % PROFILES.length];
  const noise = (rng() - 0.5) * 0.3;

  const totalVolume = Math.round(profile.totalVolume * (1 + noise));
  const totalPoints = Math.round(profile.totalPoints * (1 + noise * 0.8));
  const activeDays = Math.min(30, Math.round(profile.activeDaysBase + (rng() - 0.5) * 4));

  const activeSet = new Set<number>();
  while (activeSet.size < activeDays) activeSet.add(Math.floor(rng() * 30));

  const dailyVol = (totalVolume * 0.4) / Math.max(activeDays, 1);
  let cumPoints = totalPoints * 0.1;
  const activity30d: DailyActivity[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const active = activeSet.has(i);
    const vol = active ? Math.round(dailyVol * (0.4 + rng() * 1.6) * profile.trendMult) : 0;
    const pts = active ? Math.round(vol * (0.03 + rng() * 0.02)) : 0;
    cumPoints += pts;
    activity30d.push({ date: dateStr, volume: vol, points: pts, active });
  }

  const volume7d = activity30d.slice(-7).reduce((s, d) => s + d.volume, 0);
  const avgDailyVolume = Math.round(totalVolume * 0.4 / 30);
  const consistency = computeConsistency(activity30d);
  const scoreBreakdown = computeScoreBreakdown(totalVolume, consistency.activeDays30d, volume7d, avgDailyVolume, activity30d);
  const tier = scoreToTier(scoreBreakdown.finalScore);
  const estimatedPercentile = estimatePercentile(scoreBreakdown.finalScore, null);
  const projections = computeProjections("current", volume7d, totalPoints, totalVolume, consistency.activeDays30d, activity30d);
  const recommendations = generateRecommendations({ tier, scoreBreakdown, activeDays30d: consistency.activeDays30d, currentStreak: consistency.currentStreak, volume7d, avgDailyVolume, totalVolume, rank: null });

  return {
    account: {
      accountId: `mock-${hash.toString(16)}`,
      walletAddress: `0x${hash.toString(16).padStart(40, "0")}`,
      username: `farmer_${hash.toString(16).slice(0, 6)}`,
    },
    totalPoints,
    rank: null,
    estimatedPercentile,
    totalVolume,
    volume7d,
    avgDailyVolume,
    activeDays30d: consistency.activeDays30d,
    currentStreak: consistency.currentStreak,
    longestStreak: consistency.longestStreak,
    consistencyScore: consistency.consistencyScore,
    tier,
    scoreBreakdown,
    activity30d,
    recommendations,
    projections,
    dataSource: "mock",
  };
}
