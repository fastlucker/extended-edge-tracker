// SERVER-SIDE ONLY. Never import this in browser/client components.

import { EXTENDED_BASE_URL, EXTENDED_TIMEOUT_MS } from "./feature-flags";

export class ExtendedApiError extends Error {
  constructor(public status: number, message: string, public endpoint: string) {
    super(message);
    this.name = "ExtendedApiError";
  }
}

async function extendedFetch<T>(
  apiKey: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${EXTENDED_BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTENDED_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") throw new ExtendedApiError(408, "Request timed out", path);
    throw new ExtendedApiError(0, "Network error — Extended API unreachable", path);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403)
      throw new ExtendedApiError(response.status, "Invalid or unauthorized API key", path);
    throw new ExtendedApiError(response.status, `Extended API error ${response.status}: ${body.slice(0, 200)}`, path);
  }

  let json: unknown;
  try { json = await response.json(); }
  catch { throw new ExtendedApiError(response.status, "Invalid JSON response", path); }
  return json as T;
}

import type { RawAccountInfo, RawLeaderboardStats, RawRewardsEarned, RawTradesResponse } from "./types";

export async function fetchAccountInfo(apiKey: string): Promise<RawAccountInfo> {
  return extendedFetch<RawAccountInfo>(apiKey, "/user/account/info");
}

export async function fetchLeaderboardStats(apiKey: string): Promise<RawLeaderboardStats> {
  return extendedFetch<RawLeaderboardStats>(apiKey, "/user/rewards/leaderboard/stats");
}

export async function fetchRewardsEarned(apiKey: string): Promise<RawRewardsEarned> {
  return extendedFetch<RawRewardsEarned>(apiKey, "/user/rewards/earned");
}

export async function fetchTrades(
  apiKey: string,
  params?: Record<string, string>
): Promise<RawTradesResponse> {
  return extendedFetch<RawTradesResponse>(apiKey, "/user/trades", params);
}

/**
 * Fetch full positions history with cursor pagination.
 * Volume is computed as sum of (size × openPrice) per position.
 */
export async function fetchAllPositionsHistory(apiKey: string): Promise<any> {
  const MAX_PAGES = 200;
  const allPositions: any[] = [];
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  let page = 0;

  while (page < MAX_PAGES) {
    const params: Record<string, string> = { limit: "1000" };
    if (cursor) params.cursor = cursor;

    const raw: any = await extendedFetch<any>(apiKey, "/user/positions/history", params);
    const data: any[] = Array.isArray(raw?.data) ? raw.data : [];
    const paginationCursor = raw?.pagination?.cursor ?? null;
    const count = raw?.pagination?.count ?? data.length;

    if (data.length === 0) break;

    let newCount = 0;
    for (const p of data) {
      const id = String(p.id);
      if (!seenIds.has(id)) { seenIds.add(id); allPositions.push(p); newCount++; }
    }

    if (newCount === 0 || !paginationCursor || String(paginationCursor) === cursor || count < 1000) break;
    cursor = String(paginationCursor);
    page++;
  }

  return { data: allPositions };
}
