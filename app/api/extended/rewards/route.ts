// SERVER-SIDE ONLY — /api/extended/rewards

import { NextRequest, NextResponse } from "next/server";
import { fetchLeaderboardStats, fetchRewardsEarned, ExtendedApiError } from "@/lib/extended-client";
import { mapLeaderboardStats, mapRewardsEarned } from "@/lib/extended-mappers";

export async function POST(req: NextRequest) {
  let apiKey: string;
  try {
    const body = await req.json();
    apiKey = body?.apiKey?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!apiKey) return NextResponse.json({ error: "invalid_key" }, { status: 400 });

  try {
    const [rawLeaderboard, rawRewards] = await Promise.all([
      fetchLeaderboardStats(apiKey),
      fetchRewardsEarned(apiKey),
    ]);
    return NextResponse.json({
      leaderboard: mapLeaderboardStats(rawLeaderboard),
      rewards: mapRewardsEarned(rawRewards),
    });
  } catch (err) {
    if (err instanceof ExtendedApiError && (err.status === 401 || err.status === 403)) {
      return NextResponse.json({ error: "invalid_key" }, { status: 401 });
    }
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
