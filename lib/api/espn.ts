import { ApiPlayer, LeaderboardProvider, PlayerStatus } from "../types";

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
    const res = await fetch(ESPN_LEADERBOARD_URL, {
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      throw new Error(`ESPN API returned ${res.status}`);
    }

    const data = await res.json();
    const event = data.events?.[0];
    if (!event) {
      throw new Error("No active event found on ESPN");
    }

    const tournamentName = event.name ?? "The Masters";
    const competition = event.competitions?.[0];
    const statusDetail = event.status?.type?.detail ?? "";
    const tournamentRound = statusDetail || "In Progress";

    const competitors = competition?.competitors ?? [];
    const players: ApiPlayer[] = competitors.map((c: any) =>
      parseCompetitor(c)
    );

    return { tournamentName, tournamentRound, players };
  }
}

function parseCompetitor(c: any): ApiPlayer {
  const athlete = c.athlete ?? {};
  const name: string = athlete.displayName ?? "Unknown";

  // Position — ESPN stores it as a string like "T3" or "1"
  const position: string = c.sortOrder
    ? String(c.status?.position?.displayName ?? c.sortOrder)
    : "-";

  // Total score relative to par — ESPN gives this as a display string like "-5" or "E"
  const scoreStr: string = c.score?.displayValue ?? c.score ?? "0";
  const totalScore = parseScoreString(scoreStr);

  // Today's round score
  const todayStr: string =
    c.status?.displayValue ??
    c.linescores?.[c.linescores.length - 1]?.displayValue ??
    "";
  const todayScore = todayStr ? parseScoreString(todayStr) : null;

  // Thru — how many holes completed today
  const period = c.status?.period ?? 0;
  const thruValue = c.status?.thru ?? c.status?.displayValue ?? "-";
  const thru = String(thruValue);

  // Round scores (strokes, not relative to par)
  const rounds: number[] = (c.linescores ?? [])
    .map((ls: any) => {
      const val = ls.value ?? ls.displayValue;
      return typeof val === "number" ? val : parseInt(val, 10);
    })
    .filter((n: number) => !isNaN(n));

  // Status — detect cut, withdrawn, DQ
  const statusType: string =
    c.status?.type?.name ?? c.status?.type?.description ?? "";
  const status = mapStatus(statusType, position);

  return { name, position, totalScore, todayScore, thru, rounds, status };
}

function parseScoreString(s: string): number {
  if (!s || s === "E" || s === "Even" || s === "-") return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function mapStatus(statusType: string, position: string): PlayerStatus {
  const lower = statusType.toLowerCase();
  if (lower.includes("cut")) return "cut";
  if (lower.includes("wd") || lower.includes("withdraw")) return "withdrawn";
  if (lower.includes("dq") || lower.includes("disqual")) return "disqualified";

  // Some ESPN feeds put "CUT" in the position field
  if (position.toUpperCase() === "CUT") return "cut";

  return "active";
}
