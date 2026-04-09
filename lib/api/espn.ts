import { ApiPlayer, LeaderboardProvider, PlayerStatus } from "../types";

// Primary ESPN leaderboard endpoint
const ESPN_LEADERBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard";

/**
 * ESPN public API provider.
 * No API key required. Uses the free ESPN site API that powers espn.com.
 */
export class EspnProvider implements LeaderboardProvider {
  async fetchLeaderboard(): Promise<{
    tournamentName: string;
    tournamentRound: string;
    players: ApiPlayer[];
  }> {
    const res = await fetch(ESPN_LEADERBOARD_URL, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`ESPN API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    // Log the top-level keys so we can debug in Vercel function logs
    console.log("ESPN response keys:", Object.keys(data));

    const event = data.events?.[0];
    if (!event) {
      // Return an empty leaderboard rather than crashing so the page still loads
      console.warn("No active event found on ESPN — returning empty leaderboard");
      return {
        tournamentName: "The Masters",
        tournamentRound: "Not Started",
        players: [],
      };
    }

    console.log("Event name:", event.name, "| Status:", event.status?.type?.name);

    const tournamentName: string = event.name ?? "The Masters";
    const competition = event.competitions?.[0];

    // Build round label
    const period: number = event.status?.period ?? 0;
    const statusName: string = event.status?.type?.name ?? "";
    const statusDetail: string = event.status?.type?.detail ?? "";
    let tournamentRound = "In Progress";
    if (statusDetail) tournamentRound = statusDetail;
    else if (period > 0) tournamentRound = `Round ${period}`;

    const competitors: any[] = competition?.competitors ?? [];
    console.log(`Parsing ${competitors.length} competitors`);

    const players: ApiPlayer[] = competitors.map((c: any) => parseCompetitor(c));

    return { tournamentName, tournamentRound, players };
  }
}

function parseCompetitor(c: any): ApiPlayer {
  // ── Name ──────────────────────────────────────────────────────────────────
  const athlete = c.athlete ?? {};
  const name: string = athlete.displayName ?? athlete.fullName ?? "Unknown";

  // ── Position ──────────────────────────────────────────────────────────────
  // ESPN may store position as c.status.position.displayName or just sortOrder
  const posDisplay: string =
    c.status?.position?.displayName ??
    c.status?.position?.id ??
    "";
  const position: string = posDisplay || (c.sortOrder ? `${c.sortOrder}` : "-");

  // ── Total score (relative to par) ─────────────────────────────────────────
  // c.score can be a string like "-5", "E", or an object { displayValue: "-5" }
  const rawScore = c.score;
  const scoreStr: string =
    typeof rawScore === "object" && rawScore !== null
      ? (rawScore.displayValue ?? rawScore.value ?? "0")
      : String(rawScore ?? "0");
  const totalScore = parseScoreString(scoreStr);

  // ── Today's score ─────────────────────────────────────────────────────────
  // ESPN uses linescores[] for per-round stroke totals
  // The last entry is the current / most recent round
  const linescores: any[] = c.linescores ?? [];
  const lastLine = linescores[linescores.length - 1];
  const todayRawStr: string =
    lastLine?.displayValue ?? lastLine?.value ?? "";
  // "today" score is relative to par — ESPN may give strokes; we'll convert later
  // For simplicity just store it as-is and mark null if empty
  const todayScore: number | null = todayRawStr ? parseScoreString(String(todayRawStr)) : null;

  // ── Thru ──────────────────────────────────────────────────────────────────
  const thruRaw = c.status?.thru ?? lastLine?.displayValue ?? "-";
  const thru: string = String(thruRaw);

  // ── Round stroke totals ───────────────────────────────────────────────────
  const rounds: number[] = linescores
    .map((ls: any) => {
      const v = ls.value ?? ls.displayValue;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return n;
    })
    .filter((n: number) => !isNaN(n) && n > 0);

  // ── Status ────────────────────────────────────────────────────────────────
  const statusTypeName: string =
    c.status?.type?.name ?? c.status?.type?.description ?? "";
  const status = mapStatus(statusTypeName, position);

  return { name, position, totalScore, todayScore, thru, rounds, status };
}

function parseScoreString(s: string): number {
  if (!s) return 0;
  const trimmed = s.trim();
  if (trimmed === "E" || trimmed === "Even" || trimmed === "-" || trimmed === "") return 0;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? 0 : n;
}

function mapStatus(statusType: string, position: string): PlayerStatus {
  const lower = statusType.toLowerCase();
  if (lower.includes("cut")) return "cut";
  if (lower.includes("wd") || lower.includes("withdraw")) return "withdrawn";
  if (lower.includes("dq") || lower.includes("disqual")) return "disqualified";
  if (position.toUpperCase() === "CUT") return "cut";
  return "active";
}
