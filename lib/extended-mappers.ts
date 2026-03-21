// ─── Extended response mappers ────────────────────────────────────────────────

import type {
  RawAccountInfo,
  RawLeaderboardStats,
  RawRewardsEarned,
  RawTradesResponse,
  ExtendedAccountInfo,
  DailyActivity,
} from "./types";

export function mapAccountInfo(raw: RawAccountInfo): ExtendedAccountInfo {
  const d: any = (raw as any)?.data ?? raw;
  return {
    accountId: d.accountId?.toString() ?? d.account_id?.toString() ?? undefined,
    walletAddress: d.bridgeStarknetAddress ?? d.wallet_address ?? d.address ?? undefined,
    username: d.username ?? d.name ?? undefined,
  };
}

export interface MappedLeaderboardStats {
  rank: number | null;
  totalPoints: number;
  totalVolume: number;
  percentile: number | null;
}

export function mapLeaderboardStats(raw: RawLeaderboardStats): MappedLeaderboardStats {
  const d: any = (raw as any)?.data ?? raw;
  return {
    rank: safeNumber(d.rank) ?? null,
    totalPoints: safeNumber(d.totalPoints) ?? safeNumber(d.total_points) ?? 0,
    totalVolume: 0,
    percentile: safeNumber(d.percentile) ?? null,
  };
}

export interface MappedRewards {
  totalPoints: number;
  epochRewards: Array<{ date: string; points: number }>;
}

export function mapRewardsEarned(raw: RawRewardsEarned): MappedRewards {
  const d: any = (raw as any)?.data ?? raw;
  const seasons: any[] = Array.isArray(d) ? d : [];
  let totalPoints = 0;
  const epochRewards: Array<{ date: string; points: number }> = [];
  for (const season of seasons) {
    for (const epoch of (season.epochRewards ?? [])) {
      const pts = safeNumber(epoch.pointsReward) ?? 0;
      totalPoints += pts;
      if (pts > 0 && epoch.startDate) epochRewards.push({ date: epoch.startDate, points: pts });
    }
  }
  return { totalPoints, epochRewards };
}

export interface MappedTrade {
  date: string;
  volume: number;
  points: number;
}

export function mapTrades(raw: RawTradesResponse): MappedTrade[] {
  const d: any = (raw as any)?.data ?? raw;
  const rawTrades: any[] = Array.isArray(d) ? d
    : Array.isArray((raw as any).trades) ? (raw as any).trades
    : [];

  return rawTrades.map((t: any) => {
    let dateStr = "";
    if (t.createdTime) {
      try { dateStr = new Date(Number(t.createdTime)).toISOString().split("T")[0]; } catch { dateStr = ""; }
    }
    if (!dateStr) return null;
    const volume = safeNumber(t.value) ?? safeNumber(t.notional) ?? 0;
    return { date: dateStr, volume, points: safeNumber(t.points) ?? 0 };
  }).filter((t): t is MappedTrade => t !== null && t.date !== "");
}

export function buildActivityTimeline(
  trades: MappedTrade[],
  epochRewards: Array<{ date: string; points: number }>
): DailyActivity[] {
  if (trades.length === 0 && epochRewards.length === 0) return [];

  const volByDate: Record<string, number> = {};
  const ptsByDate: Record<string, number> = {};

  for (const t of trades) {
    if (t.date) volByDate[t.date] = (volByDate[t.date] ?? 0) + t.volume;
  }
  for (const r of epochRewards) {
    if (r.date) ptsByDate[r.date] = (ptsByDate[r.date] ?? 0) + r.points;
  }

  const allDates = [...Object.keys(volByDate), ...Object.keys(ptsByDate)];
  if (allDates.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const earliest = allDates.reduce((min, d) => d < min ? d : min, allDates[0]);
  const start = new Date(earliest);
  start.setHours(0, 0, 0, 0);

  const result: DailyActivity[] = [];
  const current = new Date(start);
  while (current <= today) {
    const dateStr = current.toISOString().split("T")[0];
    const volume = volByDate[dateStr] ?? 0;
    const points = ptsByDate[dateStr] ?? 0;
    result.push({ date: dateStr, volume, points, active: volume > 0 || points > 0 });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

export function buildActivity30d(
  trades: MappedTrade[],
  dailyRewards: Array<{ date: string; points: number }>
): DailyActivity[] {
  return buildActivityTimeline(trades, dailyRewards);
}

function safeNumber(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ─── Positions history ────────────────────────────────────────────────────────
// GET /user/positions/history
// Each position: { id, market, side, size, openPrice, exitPrice, realisedPnl, createdTime, closedTime }
// Volume = size × openPrice (notional value when position was opened)
// Activity date = createdTime

export interface MappedPositionsHistory {
  totalVolume: number;
  dailyVolume: Array<{ date: string; volume: number }>;
}

export function mapPositionsHistory(raw: any): MappedPositionsHistory {
  const d: any = raw?.data ?? raw;
  const positions: any[] = Array.isArray(d) ? d : [];

  let totalVolume = 0;
  const volByDate: Record<string, number> = {};

  for (const p of positions) {
    const size = Number(p.size || p.maxPositionSize || 0);
    const openPrice = Number(p.openPrice || 0);
    const volume = size * openPrice;

    if (volume <= 0) continue;
    totalVolume += volume;

    // Date from createdTime (ms timestamp)
    if (p.createdTime) {
      try {
        const date = new Date(Number(p.createdTime)).toISOString().split("T")[0];
        volByDate[date] = (volByDate[date] ?? 0) + volume;
      } catch { /* skip */ }
    }
  }

  const dailyVolume = Object.entries(volByDate).map(([date, volume]) => ({ date, volume }));

  return { totalVolume, dailyVolume };
}
