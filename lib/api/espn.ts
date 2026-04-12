import { ApiPlayer, LeaderboardProvider, PlayerStatus } from "../types";

/**
 * ESPN public API provider.
 * No API key required.
 *
 * Uses the site.web.api endpoint which returns the FULL field (96+ players)
 * including players who missed the cut. The simpler /scoreboard endpoint
 * only returns players who made the cut, which is insufficient for our pool.
 */
const ESPN_LEADERBOARD_URL =
  "https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&region=us&lang=en";

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
    const event = data.events?.[0];

    if (!event) {
      console.warn("No active ESPN event found");
      return {
        tournamentName: "The Masters",
        tournamentRound: "Not Started",
        players: [],
      };
    }

    const tournamentName: string = event.name ?? "The Masters";
    const competition = event.competitions?.[0];
    const competitors: any[] = competition?.competitors ?? [];

    // Determine current round from event status
    const period: number = event.status?.period ?? 1;
    const statusDetail: string = event.status?.type?.detail ?? "";
    const tournamentRound = statusDetail || `Round ${period}`;

    console.log(
      `ESPN: ${tournamentName}, ${tournamentRound}, ${competitors.length} players`
    );

    const players: ApiPlayer[] = competitors.map(parseCompetitor);
    return { tournamentName, tournamentRound, players };
  }
}

function parseCompetitor(c: any): ApiPlayer {
  // ── Name ────────────────────────────────────────────────────────────────
  const name: string =
    c.athlete?.displayName ?? c.athlete?.fullName ?? "Unknown";

  // ── Status ──────────────────────────────────────────────────────────────
  // status.type.name is one of: STATUS_IN_PROGRESS, STATUS_SCHEDULED,
  // STATUS_FINISHED, STATUS_CUT, STATUS_WITHDRAWN, STATUS_DISQUALIFIED
  const statusTypeName: string = c.status?.type?.name ?? "";
  const status = mapStatus(statusTypeName);

  // ── Position ────────────────────────────────────────────────────────────
  // For active players: status.position.displayName = "T3", "1", etc.
  // For cut players: "-"
  const position: string = c.status?.position?.displayName ?? "-";

  // ── Total score (relative to par) ───────────────────────────────────────
  // c.score is a number (total strokes), c.scoreDisplayValue is "+6" / "-5" / "E"
  const scoreDisplay: string =
    c.scoreDisplayValue ?? c.score?.displayValue ?? "E";
  const totalScore = parseScoreString(scoreDisplay);

  // ── Today's score ───────────────────────────────────────────────────────
  // status.todayDetail shows today's score like "-1(11)" or just the round score
  // status.detail shows "-1(11)" format
  const todayDetail: string = c.status?.todayDetail ?? "";
  // Extract just the score part before the parenthetical: "-1(11)" → "-1"
  const todayMatch = todayDetail.match(/^([+-]?\d+|E)/);
  const todayScore = todayMatch ? parseScoreString(todayMatch[1]) : null;

  // ── Thru ────────────────────────────────────────────────────────────────
  let thru = "-";
  if (status === "cut") {
    thru = "CUT";
  } else if (c.status?.type?.name === "STATUS_FINISHED") {
    thru = "F";
  } else if (c.status?.displayThru) {
    thru = String(c.status.displayThru);
  } else if (typeof c.status?.thru === "number") {
    thru = c.status.thru >= 18 ? "F" : String(c.status.thru);
  }

  // ── Round stroke totals ─────────────────────────────────────────────────
  // linescores[].value = strokes for that round (e.g. 68.0)
  // IMPORTANT: Only include COMPLETED rounds. Partial rounds (in-progress)
  // have low stroke totals (e.g. 43 through 11 holes) which would break
  // the missed-cut penalty calculation (43 - 72 = -29 looks like a great
  // score instead of an incomplete one). A completed round at Augusta is
  // always 60+ strokes, so we use that as a threshold.
  const MIN_COMPLETE_ROUND_STROKES = 60;
  const rounds: number[] = (c.linescores ?? [])
    .map((ls: any) => {
      const v = typeof ls.value === "number" ? ls.value : parseFloat(ls.value);
      return v;
    })
    .filter((n: number) => !isNaN(n) && n >= MIN_COMPLETE_ROUND_STROKES);

  return { name, position, totalScore, todayScore, thru, rounds, status };
}

function parseScoreString(s: string): number {
  if (!s) return 0;
  const t = s.trim();
  if (t === "E" || t === "Even" || t === "-" || t === "") return 0;
  const n = parseInt(t, 10);
  return isNaN(n) ? 0 : n;
}

function mapStatus(statusTypeName: string): PlayerStatus {
  switch (statusTypeName) {
    case "STATUS_CUT":
      return "cut";
    case "STATUS_WITHDRAWN":
      return "withdrawn";
    case "STATUS_DISQUALIFIED":
      return "disqualified";
    default:
      return "active";
  }
}
