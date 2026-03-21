// ─── Feature flags ────────────────────────────────────────────────────────────
// Toggle ENABLE_MOCK_MODE to true to bypass the real Extended API entirely.
// In production, this should always be false.
// Can also be overridden at runtime via the ?mock=true query param in dev.

export const ENABLE_MOCK_MODE =
  process.env.NEXT_PUBLIC_MOCK_MODE === "true" || false;

// Extended API base URL — all server-side proxied requests use this.
export const EXTENDED_BASE_URL =
  process.env.EXTENDED_BASE_URL ||
  "https://api.starknet.extended.exchange/api/v1";

// Request timeout in ms for Extended API calls.
export const EXTENDED_TIMEOUT_MS = 10_000;
