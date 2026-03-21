// SERVER-SIDE ONLY — /api/extended/trades

import { NextRequest, NextResponse } from "next/server";
import { fetchTrades, ExtendedApiError } from "@/lib/extended-client";
import { mapTrades } from "@/lib/extended-mappers";

export async function POST(req: NextRequest) {
  let apiKey: string;
  let params: Record<string, string> | undefined;
  try {
    const body = await req.json();
    apiKey = body?.apiKey?.trim() ?? "";
    params = body?.params;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!apiKey) return NextResponse.json({ error: "invalid_key" }, { status: 400 });

  try {
    const raw = await fetchTrades(apiKey, params);
    return NextResponse.json({ trades: mapTrades(raw) });
  } catch (err) {
    if (err instanceof ExtendedApiError && (err.status === 401 || err.status === 403)) {
      return NextResponse.json({ error: "invalid_key" }, { status: 401 });
    }
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
