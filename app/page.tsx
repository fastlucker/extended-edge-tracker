"use client";

import { useState, useCallback, useMemo } from "react";
import type { WalletAnalysis, ProjectionMode, ErrorKind } from "@/lib/types";
import { computeProjections } from "@/lib/projections";
import { fmtVolume, fmtPoints, fmtAddr } from "@/lib/utils";

// ─── Design tokens ────────────────────────────────────────────────────────────

const TIER_STYLES = {
  Underfarming: { bg: "#1a1025", border: "#6b21a8", text: "#d8b4fe", dot: "#a855f7" },
  Average:      { bg: "#0f1e2e", border: "#1d4ed8", text: "#93c5fd", dot: "#3b82f6" },
  Strong:       { bg: "#0a1f18", border: "#065f46", text: "#6ee7b7", dot: "#10b981" },
  Elite:        { bg: "#1a1200", border: "#854d0e", text: "#fde68a", dot: "#f59e0b" },
} as const;

const SEVERITY_STYLES = {
  info:     { bg: "#0c1a2e", border: "#1d4ed8", icon: "◈", color: "#93c5fd" },
  warning:  { bg: "#1a1000", border: "#92400e", icon: "⚠", color: "#fbbf24" },
  positive: { bg: "#0a1f18", border: "#065f46", icon: "✦", color: "#6ee7b7" },
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px", ...style }}>{children}</div>;
}

function Label({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4, fontWeight: 600, ...style }}>{children}</div>;
}

function TierBadge({ tier }: { tier: keyof typeof TIER_STYLES }) {
  const s = TIER_STYLES[tier];
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />{tier}
    </span>
  );
}

function KpiCard({ label, value, sub, accent = "#06b6d4" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.07em", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PBar({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{label}</span>
          {hint && <span style={{ fontSize: 10, color: "#334155", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 4, padding: "1px 5px" }}>{hint}</span>}
        </div>
        <span style={{ fontSize: 12, color, fontWeight: 600 }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: 4, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, value)}%`, background: color, borderRadius: 99, transition: "width 0.8s cubic-bezier(.16,1,.3,1)" }} />
      </div>
    </div>
  );
}

function ScoreRing({ score, tier }: { score: number; tier: keyof typeof TIER_STYLES }) {
  const r = 52, cx = 60, cy = 60, sw = 8, circ = 2 * Math.PI * r;
  const color = { Elite: "#f59e0b", Strong: "#10b981", Average: "#3b82f6", Underfarming: "#a855f7" }[tier];
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${circ * (score / 100)} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#f8fafc" fontSize="22" fontWeight="700">{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize="9" letterSpacing="1">EDGE SCORE</text>
    </svg>
  );
}

function BarChart({ data, h = 88 }: { data: Array<{ volume: number; active: boolean }>; h?: number }) {
  const max = Math.max(...data.map(d => d.volume), 1);
  return (
    <svg viewBox={`0 0 300 ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h }}>
      {data.map((d, i) => {
        const bh = (d.volume / max) * (h - 2);
        return <rect key={i} x={(i / data.length) * 300} y={h - bh} width={(300 / data.length) - 1.5} height={bh} fill={d.active ? "#0ea5e9" : "#1e293b"} rx="1" />;
      })}
    </svg>
  );
}

function LineChart({ data, h = 88 }: { data: number[]; h?: number }) {
  const max = Math.max(...data, 1);
  if (data.length < 2) return null;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${h - (v / max) * h * 0.9}`).join(" ");
  return (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h }}>
      <polyline points={`0,${h} ${pts} 100,${h}`} fill="#10b98122" stroke="none" />
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Heatmap({ activity }: { activity: Array<{ volume: number; active: boolean; date: string }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3 }}>
      {activity.map((d, i) => (
        <div key={i} title={`${d.date}: ${d.active ? fmtVolume(d.volume) : "inactive"}`} style={{
          height: 14, borderRadius: 2, border: "1px solid #1e293b",
          background: !d.active ? "#0f172a" : d.volume > 200_000 ? "#06b6d4" : d.volume > 80_000 ? "#0891b2" : "#164e63",
        }} />
      ))}
    </div>
  );
}

function Skeleton({ h = 20, r = 6 }: { h?: number; r?: number }) {
  return <div style={{ height: h, borderRadius: r, background: "#1e293b", animation: "pulse 1.5s ease-in-out infinite" }} />;
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ kind, message, onRetry }: { kind: ErrorKind; message: string; onRetry: () => void }) {
  const cfgs: Record<ErrorKind, { icon: string; title: string; color: string }> = {
    invalid_key:     { icon: "⊗", title: "Invalid API key",      color: "#f87171" },
    no_activity:     { icon: "◯", title: "No activity found",    color: "#f59e0b" },
    api_unavailable: { icon: "⚡", title: "Extended unreachable", color: "#f59e0b" },
    unknown:         { icon: "⊘", title: "Something went wrong", color: "#94a3b8" },
  };
  const c = cfgs[kind];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 14, textAlign: "center", padding: "40px 24px" }}>
      <div style={{ fontSize: 44, color: c.color }}>{c.icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>{c.title}</div>
      <div style={{ fontSize: 13, color: "#64748b", maxWidth: 360, lineHeight: 1.65 }}>{message}</div>
      <button onClick={onRetry} style={{ marginTop: 8, background: "transparent", border: "1px solid #1e293b", color: "#94a3b8", fontFamily: "inherit", fontSize: 12, cursor: "pointer", borderRadius: 8, padding: "8px 20px" }}>
        ← Try again
      </button>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onConnect }: { onConnect: (k: string) => void }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const k = key.trim();
    if (k.length < 8 || loading) return;
    setLoading(true);
    await onConnect(k);
    setLoading(false);
  }

  const valid = key.trim().length >= 8 && !loading;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px 48px", animation: "fadeUp .6s ease" }}>
      <div style={{ textAlign: "center", maxWidth: 560, marginBottom: 40 }}>
        <div style={{ fontSize: 11, color: "#0ea5e9", letterSpacing: "0.15em", textTransform: "uppercase" as const, marginBottom: 16, fontWeight: 600 }}>◈ Extended Farming Analytics</div>
        <h1 style={{ fontSize: "clamp(26px,5vw,48px)", fontWeight: 700, color: "#f8fafc", margin: "0 0 14px", lineHeight: 1.15 }}>
          Are you ahead,<br /><span style={{ color: "#0ea5e9" }}>or already late?</span>
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.75, margin: 0 }}>
          Connect your Extended API key and see your real edge — points, volume, consistency, rank, and 30-day projection.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "22px" }}>
          <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, marginBottom: 4 }}>Connect your Extended API Key</div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 16, lineHeight: 1.6 }}>
            Read-only analytics only. This is your <strong style={{ color: "#94a3b8" }}>API Key</strong> — not your Stark key or private key.
          </div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="Paste your API Key here"
              style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "#f8fafc", fontSize: 13, padding: "13px 54px 13px 14px", borderRadius: 8, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
            />
            <button onClick={() => setShow(!show)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
              {show ? "hide" : "show"}
            </button>
          </div>
          <button disabled={!valid} onClick={handleSubmit} style={{ width: "100%", border: "none", fontWeight: 700, borderRadius: 8, padding: "13px", fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase" as const, fontFamily: "inherit", background: valid ? "linear-gradient(135deg,#0ea5e9,#06b6d4)" : "#1e293b", color: valid ? "#000" : "#475569", cursor: valid ? "pointer" : "not-allowed" }}>
            {loading ? "Connecting..." : "Connect Extended ↗"}
          </button>
          <div style={{ marginTop: 14, background: "#020817", border: "1px solid #1e293b", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 600, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>How to get your API Key</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {[
                ["1", "Go to Extended →", <a href="https://app.extended.exchange/api-management" target="_blank" rel="noopener noreferrer" style={{ color: "#0ea5e9", textDecoration: "none" }}>More → API</a>],
                ["2", "Click", <span style={{ color: "#f8fafc" }}>Generate API Key</span>],
                ["3", "Click", <span style={{ color: "#f8fafc" }}>Show API details</span>],
                ["4", "Copy the value of", <span style={{ color: "#f8fafc" }}>API Key</span>],
              ].map(([n, pre, em], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#1e293b", color: "#0ea5e9", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
                  <span>{pre} {em}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: "#334155", lineHeight: 1.5 }}>
              ⚠ Do not use your Stark private key or public key — use only the <strong style={{ color: "#475569" }}>API Key</strong> field.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 32, flexWrap: "wrap" as const, justifyContent: "center" }}>
        {["Real points & volume", "Consistency tracking", "Rank estimate", "30-day projection"].map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 12 }}>
            <span style={{ color: "#0ea5e9" }}>◈</span> {v}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ analysis }: { analysis: WalletAnalysis }) {
  const [projMode, setProjMode] = useState<ProjectionMode>("current");

  const proj = useMemo(() =>
    computeProjections(projMode, analysis.volume7d, analysis.totalPoints, analysis.totalVolume, analysis.activeDays30d, analysis.activity30d),
    [projMode, analysis]
  );

  const cumPts = useMemo(() =>
    analysis.activity30d.map((_, i) => analysis.activity30d.slice(0, i + 1).reduce((s, d) => s + d.points, 0)),
    [analysis]
  );

  const { tier, scoreBreakdown: sb, estimatedPercentile, account, rank } = analysis;
  const tc = TIER_STYLES[tier];
  const cLabel = analysis.consistencyScore >= 80 ? "Elite" : analysis.consistencyScore >= 60 ? "Strong" : analysis.consistencyScore >= 35 ? "Decent" : "Weak";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeUp .4s ease" }}>

      {/* Main card */}
      <div style={{ background: "#0f172a", border: `1px solid ${tc.border}33`, borderRadius: 14, padding: "24px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" as const }}>
        <ScoreRing score={sb.finalScore} tier={tier} />
        <div style={{ flex: "1 1 180px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" as const }}>
            {account.username && <span style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600 }}>{account.username}</span>}
            {account.walletAddress && <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{fmtAddr(account.walletAddress)}</span>}
            <TierBadge tier={tier} />
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 3 }}>
            {rank
              ? <><span style={{ color: "#94a3b8" }}>Rank </span><span style={{ color: "#0ea5e9", fontWeight: 700 }}>#{rank}</span><span style={{ color: "#475569" }}> · Top {estimatedPercentile}%</span></>
              : <><span style={{ color: "#94a3b8" }}>Position </span><span style={{ color: "#0ea5e9", fontWeight: 700 }}>Top {estimatedPercentile}%</span><span style={{ color: "#475569" }}> (heuristic)</span></>
            }
          </div>
          <div style={{ fontSize: 10, color: "#1e3a5f", marginTop: 4 }}>
            Edge Score: {sb.finalScore}/100 · {rank ? "Rank from Extended leaderboard." : "Percentile estimated from Edge Score."}
          </div>
        </div>
        <div style={{ flex: "1 1 180px" }}>
          <PBar label="Rank (50%)"             value={sb.rankScore}           color={sb.rankScore >= 70 ? "#10b981" : sb.rankScore >= 40 ? "#0ea5e9" : "#a855f7"} hint={rank ? `#${rank} / ~50k` : "no rank"} />
          <PBar label="Volume (20%)"           value={sb.totalVolumeScore}    color={sb.totalVolumeScore >= 70 ? "#10b981" : sb.totalVolumeScore >= 40 ? "#0ea5e9" : "#a855f7"} hint="ref: $20M" />
          <PBar label="Consistency (15%)"      value={sb.consistencyScore}    color={sb.consistencyScore >= 70 ? "#10b981" : "#0ea5e9"} hint="ref: 28 days/mo" />
          <PBar label="Recent activity (10%)"  value={sb.recentActivityScore} color={sb.recentActivityScore >= 70 ? "#10b981" : "#f59e0b"} hint="vs your avg" />
          <PBar label="Growth trend (5%)"      value={sb.growthScore}         color="#06b6d4" hint="7d vs prev 7d" />
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: 10 }}>
        <KpiCard label="Total Points"    value={fmtPoints(analysis.totalPoints)}    accent="#0ea5e9" />
        <KpiCard label="Total Volume"    value={fmtVolume(analysis.totalVolume)}    accent="#06b6d4" />
        <KpiCard label="7D Volume"       value={fmtVolume(analysis.volume7d)}       accent="#22d3ee" />
        <KpiCard label="Avg Daily Vol"   value={fmtVolume(analysis.avgDailyVolume)} accent="#67e8f9" />
        <KpiCard label="Active Days" value={`${analysis.activeDays30d}d (30d)`}     accent={analysis.activeDays30d >= 20 ? "#10b981" : "#f59e0b"} />
        <KpiCard label="Current Streak"  value={`${analysis.currentStreak}d`}       sub={`Best: ${analysis.longestStreak}d`} accent={analysis.currentStreak >= 7 ? "#10b981" : "#0ea5e9"} />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <Label>Daily Volume · full history</Label>
          <BarChart data={analysis.activity30d} />
          <div style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>Each bar = 1 day · Dark = inactive day</div>
        </Card>
        <Card>
          <Label>Points Growth · cumulative</Label>
          <LineChart data={cumPts} />
          <div style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>Total: {fmtPoints(analysis.totalPoints)} pts</div>
        </Card>
      </div>

      {/* Percentile + Gap */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          {/* Block 1: Official rank from Extended leaderboard */}
          <Label>Official Rank</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            {rank
              ? <><span style={{ fontSize: 32, fontWeight: 700, color: "#0ea5e9" }}>#{rank}</span><span style={{ fontSize: 13, color: "#64748b" }}>on Extended</span></>
              : <span style={{ fontSize: 20, fontWeight: 700, color: "#475569" }}>No rank yet</span>
            }
          </div>
          {rank && (
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              Top {estimatedPercentile}% of ~50,000 active farmers
            </div>
          )}
          <div style={{ height: 1, background: "#1e293b", margin: "14px 0" }} />
          {/* Block 2: Edge Score thresholds */}
          <Label style={{ marginBottom: 8 }}>Edge Score Position</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: "#0ea5e9" }}>{sb.finalScore}</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>/ 100</span>
          </div>
          {([["Top 1%", 94], ["Top 5%", 88], ["Top 10%", 82], ["Top 25%", 72]] as [string, number][]).map(([label, threshold]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 60, fontSize: 11, color: sb.finalScore >= threshold ? "#0ea5e9" : "#334155" }}>{label}</div>
              <div style={{ height: 3, flex: 1, background: "#1e293b", borderRadius: 99 }}>
                <div style={{ height: "100%", width: `${Math.min(100, (sb.finalScore / threshold) * 100)}%`, background: sb.finalScore >= threshold ? "#10b981" : "#0ea5e960", borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 11, color: sb.finalScore >= threshold ? "#10b981" : "#475569", width: 65, textAlign: "right" as const }}>
                {sb.finalScore >= threshold ? "✓ reached" : `score ${threshold}`}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: "#334155", marginTop: 8 }}>Edge Score thresholds are heuristic, not official ranking.</div>
        </Card>

        <Card style={{ borderLeft: `3px solid ${tc.border}` }}>
          <Label>Farming Gap</Label>
          <div style={{ fontSize: 13, fontWeight: 600, color: tier === "Elite" ? "#f59e0b" : tier === "Strong" ? "#10b981" : "#f87171", marginBottom: 10 }}>
            {tier === "Elite" ? "✦ You are in the Elite tier." : tier === "Strong" ? "You are in a strong position." : tier === "Average" ? "You are below top 15% pace." : "You are significantly behind average."}
          </div>
          {([
            sb.consistencyScore < 50 && "Consistency is your biggest weakness.",
            sb.recentActivityScore < 40 && "Recent momentum is slowing down.",
            sb.totalVolumeScore < 40 && `~$${Math.round((2_000_000 - analysis.totalVolume) / 1000)}k more volume needed.`,
            analysis.currentStreak === 0 && "No active streak — start today.",
          ] as (string | false)[]).filter(Boolean).slice(0, 3).map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
              <span style={{ color: "#f59e0b", flexShrink: 0, fontSize: 12 }}>→</span>
              <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{msg}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Consistency */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap" as const, gap: 8 }}>
          <div>
            <Label>Consistency</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: analysis.consistencyScore >= 60 ? "#10b981" : "#f59e0b" }}>{analysis.consistencyScore}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>/ 100 · {cLabel}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {([[analysis.activeDays30d, "active 30d", "#0ea5e9"], [`${analysis.currentStreak}d`, "streak", analysis.currentStreak >= 5 ? "#10b981" : "#f59e0b"], [`${analysis.longestStreak}d`, "best", "#06b6d4"]] as [string | number, string, string][]).map(([v, l, c], i) => (
              <div key={i} style={{ textAlign: "center" as const }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: "#475569" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <Label style={{ marginBottom: 6 }}>Full history activity</Label>
        <Heatmap activity={analysis.activity30d} />
        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" as const }}>
          {([["#164e63", "Low"], ["#0891b2", "Med"], ["#06b6d4", "High"], ["#0f172a", "Inactive"]] as [string, string][]).map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#475569" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c, border: "1px solid #1e293b" }} /> {l}
            </div>
          ))}
        </div>
      </Card>

      {/* Projections */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" as const, gap: 8 }}>
          <Label style={{ marginBottom: 0 }}>Projection</Label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["conservative", "current", "aggressive"] as ProjectionMode[]).map(m => (
              <button key={m} onClick={() => setProjMode(m)} style={{ background: projMode === m ? "#0f172a" : "transparent", border: `1px solid ${projMode === m ? "#0ea5e9" : "#1e293b"}`, color: projMode === m ? "#0ea5e9" : "#64748b", fontFamily: "inherit", fontSize: 10, cursor: "pointer", borderRadius: 6, padding: "5px 10px", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{m}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {([{ label: "7-Day", ...proj.sevenDay, color: "#0ea5e9" }, { label: "30-Day", ...proj.thirtyDay, color: "#10b981" }]).map(({ label, volume, points, score, tier: pt, color }) => (
            <div key={label} style={{ background: "#020817", borderRadius: 10, padding: "16px 18px", border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>{label} Projection</div>
              <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>+{fmtVolume(volume)}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>+{fmtPoints(points)} pts</div>
              <div style={{ fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                Score: <span style={{ color: "#f8fafc", fontWeight: 600 }}>{score}</span>
                <TierBadge tier={pt} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#1e3a5f", marginTop: 10 }}>
          {projMode === "conservative" ? "↓ 65% of current pace" : projMode === "aggressive" ? "↑ 145% of current pace" : "Based on your last 7-day average pace."}
        </div>
      </Card>

      {/* Recommendations */}
      <Card>
        <Label>Recommendations</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {analysis.recommendations.map((rec, i) => {
            const s = SEVERITY_STYLES[rec.severity];
            return (
              <div key={i} style={{ display: "flex", gap: 12, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: "12px 14px" }}>
                <span style={{ color: s.color, fontWeight: 700, fontSize: 14, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600, marginBottom: 3 }}>{rec.title}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{rec.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type AppState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; analysis: WalletAnalysis }
  | { status: "error"; kind: ErrorKind; message: string };

export default function Home() {
  const [state, setState] = useState<AppState>({ status: "idle" });

  const handleConnect = useCallback(async (apiKey: string) => {
    setState({ status: "connecting" });
    try {
      const res = await fetch("/api/extended/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setState({ status: "error", kind: data.error as ErrorKind ?? "unknown", message: data.message ?? "An unexpected error occurred." });
        return;
      }
      setState({ status: "connected", analysis: data.analysis });
    } catch {
      setState({ status: "error", kind: "api_unavailable", message: "Could not reach the server. Check your connection." });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return (
    <div style={{ minHeight: "100vh", background: "#020817", color: "#f8fafc", fontFamily: "'IBM Plex Mono', 'Fira Code', ui-monospace, monospace", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{ padding: "14px 32px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={reset}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", boxShadow: "0 0 8px #0ea5e9" }} />
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.06em" }}>EXTENDED EDGE TRACKER</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {state.status === "connected" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#10b981" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} /> Connected
              </div>
              <button onClick={reset} style={{ background: "transparent", border: "1px solid #1e293b", color: "#475569", fontFamily: "inherit", fontSize: 11, cursor: "pointer", borderRadius: 6, padding: "5px 10px" }}>
                Disconnect
              </button>
            </>
          )}
          <span style={{ color: "#334155", fontSize: 11, letterSpacing: "0.1em" }}>V1</span>
        </div>
      </nav>

      {/* Content */}
      {state.status === "idle" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Hero onConnect={handleConnect} />
        </div>
      )}

      {state.status === "connecting" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px", width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 24, display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", background: "#1e293b", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton h={14} /><Skeleton h={24} /><Skeleton h={18} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i} h={72} r={10} />)}
          </div>
          <div style={{ textAlign: "center", color: "#334155", fontSize: 12, marginTop: 4 }}>◈ Fetching your Extended data...</div>
        </div>
      )}

      {state.status === "error" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <ErrorState kind={state.kind} message={state.message} onRetry={reset} />
        </div>
      )}

      {state.status === "connected" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 60px", width: "100%" }}>
          <Dashboard analysis={state.analysis} />
        </div>
      )}
    </div>
  );
}
