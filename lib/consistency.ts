// ─── Consistency engine ───────────────────────────────────────────────────────
// Works on the full activity timeline, not just 30 days.

import type { DailyActivity } from "./types";

export interface ConsistencyMetrics {
  activeDays30d: number;    // active days in last 30 days (for recency context)
  activeDaysTotal: number;  // active days over full history
  totalDays: number;        // total days since first activity
  currentStreak: number;
  longestStreak: number;
  consistencyScore: number; // 0–100
}

export function computeConsistency(activity: DailyActivity[]): ConsistencyMetrics {
  if (activity.length === 0) {
    return { activeDays30d: 0, activeDaysTotal: 0, totalDays: 0, currentStreak: 0, longestStreak: 0, consistencyScore: 0 };
  }

  const totalDays = activity.length;
  const activeDaysTotal = activity.filter(d => d.active).length;

  // Active days in last 30 days
  const last30 = activity.slice(-30);
  const activeDays30d = last30.filter(d => d.active).length;

  // Current streak (from today backwards)
  let currentStreak = 0;
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i].active) currentStreak++;
    else break;
  }

  // Longest streak over full history
  let longestStreak = 0, run = 0;
  for (const d of activity) {
    run = d.active ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }

  // Consistency score: blend of overall active-day ratio + streak quality
  const activeDayRatio = activeDaysTotal / Math.max(totalDays, 1);
  const streakBonus = Math.min(1, longestStreak / 30); // 30-day streak = full bonus
  const consistencyScore = Math.min(100, Math.round((activeDayRatio * 0.7 + streakBonus * 0.3) * 100));

  return { activeDays30d, activeDaysTotal, totalDays, currentStreak, longestStreak, consistencyScore };
}
