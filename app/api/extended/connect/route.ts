// SERVER-SIDE ONLY — /api/extended/connect
// Validates the user's API key by calling /user/account/info.
// Returns account info on success, structured error on failure.

import { NextRequest, NextResponse } from "next/server";
import { fetchAccountInfo } from "@/lib/extended-client";
import { mapAccountInfo } from "@/lib/extended-mappers";
import { ExtendedApiError } from "@/lib/extended-client";

export async function POST(req: NextRequest) {
  let apiKey: string;
  try {
    const body = await req.json();
    apiKey = body?.apiKey?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "Missing request body" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "invalid_key", message: "API key is required" }, { status: 400 });
  }

  try {
    const raw = await fetchAccountInfo(apiKey);
    const account = mapAccountInfo(raw);
    return NextResponse.json({ ok: true, account });
  } catch (err) {
    if (err instanceof ExtendedApiError) {
      if (err.status === 401 || err.status === 403) {
        return NextResponse.json({ error: "invalid_key", message: "Invalid or unauthorized API key" }, { status: 401 });
      }
      if (err.status === 0 || err.status === 408) {
        return NextResponse.json({ error: "api_unavailable", message: "Extended API is unreachable" }, { status: 503 });
      }
    }
    return NextResponse.json({ error: "unknown", message: "Unexpected error during connection" }, { status: 500 });
  }
}
