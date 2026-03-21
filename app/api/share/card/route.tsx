// /api/share/card?score=74&tier=Strong&pct=5
// Génère une image PNG 1200×630 — runtime Edge pour @vercel/og

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const TIER_COLORS: Record<string, { bg: string; accent: string; label: string }> = {
  Underfarming: { bg: "#1a1025", accent: "#a855f7", label: "#d8b4fe" },
  Average:      { bg: "#0f1e2e", accent: "#3b82f6", label: "#93c5fd" },
  Strong:       { bg: "#0a1f18", accent: "#10b981", label: "#6ee7b7" },
  Elite:        { bg: "#1a1200", accent: "#f59e0b", label: "#fde68a" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const score = Number(searchParams.get("score") ?? 0);
  const tier  = (searchParams.get("tier") ?? "Average") as keyof typeof TIER_COLORS;
  const pct   = Number(searchParams.get("pct") ?? 50);
  const tc    = TIER_COLORS[tier] ?? TIER_COLORS.Average;

  const r = 80, cx = 100, cy = 100, sw = 12;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, background: "#020817", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", position: "relative" }}>

        {/* Grid background */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#0ea5e908 1px, transparent 1px), linear-gradient(90deg, #0ea5e908 1px, transparent 1px)", backgroundSize: "60px 60px", display: "flex" }} />

        {/* Top accent bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, transparent, #0ea5e9, #06b6d4, #0ea5e9, transparent)", display: "flex" }} />

        {/* Logo */}
        <div style={{ position: "absolute", top: 44, left: 64, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0ea5e9" }} />
          <span style={{ color: "#475569", fontSize: 15, letterSpacing: "0.12em" }}>EXTENDED EDGE TRACKER</span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", alignItems: "center", gap: 100 }}>

          {/* Score ring */}
          <svg width={200} height={200} viewBox="0 0 200 200">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={sw} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={tc.accent} strokeWidth={sw}
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`} />
            <text x={cx} y={cy - 6} textAnchor="middle" fill="#f8fafc" fontSize="50" fontWeight="700">{score}</text>
            <text x={cx} y={cy + 24} textAnchor="middle" fill="#64748b" fontSize="13" letterSpacing="2">EDGE SCORE</text>
          </svg>

          {/* Divider */}
          <div style={{ width: 1, height: 220, background: "#1e293b", display: "flex" }} />

          {/* Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* Tier */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#475569", letterSpacing: "0.1em", width: 80 }}>TIER</span>
              <span style={{ background: tc.bg, border: `2px solid ${tc.accent}`, color: tc.label, padding: "8px 24px", borderRadius: 8, fontSize: 22, fontWeight: 700, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: tc.accent }} />
                {tier.toUpperCase()}
              </span>
            </div>

            {/* Position */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#475569", letterSpacing: "0.1em", width: 80 }}>POSITION</span>
              <span style={{ fontSize: 56, fontWeight: 700, color: "#0ea5e9", lineHeight: 1 }}>Top {pct}%</span>
            </div>

            {/* Tagline */}
            <span style={{ fontSize: 15, color: "#334155", marginTop: 4 }}>Know if you&apos;re ahead, or already late.</span>
          </div>
        </div>

        {/* Bottom URL */}
        <div style={{ position: "absolute", bottom: 40, right: 64 }}>
          <span style={{ color: "#1e3a5f", fontSize: 13 }}>extended-edge-tracker.vercel.app</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
