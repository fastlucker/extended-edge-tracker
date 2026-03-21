// ─── Core domain types ────────────────────────────────────────────────────────

export type UserTier = "Underfarming" | "Average" | "Strong" | "Elite";
export type ProjectionMode = "conservative" | "current" | "aggressive";
export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";
export type ErrorKind = "invalid_key" | "no_activity" | "api_unavailable" | "unknown";

export interface DailyActivity {
  date: string;       // ISO "YYYY-MM-DD"
  volume: number;     // USD notional
  points: number;     // rewards points earned that day
  active: boolean;
}

export interface ScoreBreakdown {
  rankScore: number;           // 0–100, weighted 50%
  totalVolumeScore: number;    // 0–100, weighted 20%
  consistencyScore: number;    // 0–100, weighted 15%
  recentActivityScore: number; // 0–100, weighted 10%
  growthScore: number;         // 0–100, weighted 5%
  finalScore: number;          // weighted sum, 0–100
}

export interface Recommendation {
  title: string;
  description: string;
  severity: "info" | "warning" | "positive";
}

export interface ExtendedAccountInfo {
  accountId?: string;
  walletAddress?: string;
  username?: string;
}

export interface ProjectionResult {
  volume: number;
  points: number;
  score: number;
  tier: UserTier;
}

export interface Projections {
  sevenDay: ProjectionResult;
  thirtyDay: ProjectionResult;
}

export interface WalletAnalysis {
  account: ExtendedAccountInfo;
  totalPoints: number;
  rank: number | null;
  estimatedPercentile: number;
  totalVolume: number;
  volume7d: number;
  avgDailyVolume: number;
  activeDays30d: number;
  activeDaysTotal?: number;
  totalDays?: number;
  currentStreak: number;
  longestStreak: number;
  consistencyScore: number;
  tier: UserTier;
  scoreBreakdown: ScoreBreakdown;
  activity30d: DailyActivity[];
  recommendations: Recommendation[];
  projections: Projections;
  dataSource: "real" | "mock";
}

export interface AppError {
  kind: ErrorKind;
  message: string;
}

// ─── Raw Extended API response shapes ────────────────────────────────────────
// These are best-effort typings based on the documented endpoints.
// Fields marked with ? are treated as optional for defensive parsing.

export interface RawAccountInfo {
  account_id?: string;
  wallet_address?: string;
  username?: string;
  [key: string]: unknown;
}

export interface RawLeaderboardStats {
  rank?: number | null;
  total_points?: number;
  total_volume?: number;
  percentile?: number;
  [key: string]: unknown;
}

export interface RawRewardsEarned {
  total_points?: number;
  points?: number;
  rewards?: Array<{
    date?: string;
    points?: number;
    amount?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface RawTrade {
  created_at?: string;
  timestamp?: string;
  date?: string;
  size?: number;
  notional?: number;
  volume?: number;
  amount?: number;
  fee?: number;
  points?: number;
  side?: string;
  market?: string;
  [key: string]: unknown;
}

export interface RawTradesResponse {
  trades?: RawTrade[];
  data?: RawTrade[];
  results?: RawTrade[];
  [key: string]: unknown;
}
