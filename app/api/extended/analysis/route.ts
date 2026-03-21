// SERVER-SIDE ONLY — /api/extended/analysis

import { NextRequest, NextResponse } from "next/server";
import {
  fetchAccountInfo,
  fetchLeaderboardStats,
  fetchRewardsEarned,
  fetchTrades,
  fetchAllPositionsHistory,
  ExtendedApiError,
} from "@/lib/extended-client";
import { EXTENDED_BASE_URL } from "@/lib/feature-flags";
import {
  mapAccountInfo,
  mapLeaderboardStats,
  mapRewardsEarned,
  mapTrades,
  mapPositionsHistory,
} from "@/lib/extended-mappers";
import { assembleAnalysis } from "@/lib/analysis";
import { generateMockAnalysis } from "@/lib/mock-data";
import { ENABLE_MOCK_MODE } from "@/lib/feature-flags";

async function fetchReferralStatus(apiKey: string): Promise<any> {
  try {
    const res = await fetch(`${EXTENDED_BASE_URL}/user/referrals/status`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let apiKey: string;
  try {
    const body = await req.json();
    apiKey = body?.apiKey?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "Missing request body" }, { status: 400 });
  }

  if (!apiKey) return NextResponse.json({ error: "invalid_key", message: "API key is required" }, { status: 400 });
  if (ENABLE_MOCK_MODE) return NextResponse.json({ ok: true, analysis: generateMockAnalysis(apiKey) });

  try {
    const [rawAccount, rawLeaderboard, rawRewards, rawTrades, rawReferral] = await Promise.all([
      fetchAccountInfo(apiKey),
      fetchLeaderboardStats(apiKey),
      fetchRewardsEarned(apiKey),
      fetchTrades(apiKey, { limit: "300" }),
      fetchReferralStatus(apiKey),
    ]);

    const account     = mapAccountInfo(rawAccount);
    const leaderboard = mapLeaderboardStats(rawLeaderboard);
    const rewards     = mapRewardsEarned(rawRewards);
    const trades      = mapTrades(rawTrades);

    // Extract total traded volume from referral status endpoint
    const referralData = rawReferral?.data ?? rawReferral;
    const totalVolumeFromReferral = Number(
      referralData?.tradedVolume ??
      referralData?.totalVolume ??
      referralData?.total_volume ??
      0
    );

    const positions = mapPositionsHistory({ data: [] });
    positions.totalVolume = totalVolumeFromReferral;

    const hasActivity = leaderboard.totalPoints > 0 || rewards.totalPoints > 0 || trades.length > 0;
    if (!hasActivity) {
      return NextResponse.json({ error: "no_activity", message: "No activity found." }, { status: 422 });
    }

    const analysis = assembleAnalysis({ account, leaderboard, rewards, trades, positions });
    return NextResponse.json({ ok: true, analysis });

  } catch (err) {
    if (err instanceof ExtendedApiError) {
      if (err.status === 401 || err.status === 403)
        return NextResponse.json({ error: "invalid_key", message: "Invalid or unauthorized API key" }, { status: 401 });
      if (err.status === 0 || err.status === 408)
        return NextResponse.json({ error: "api_unavailable", message: "Extended API is unreachable." }, { status: 503 });
    }
    console.error("[analysis] error:", err);
    return NextResponse.json({ error: "unknown", message: "An unexpected error occurred" }, { status: 500 });
  }
}

