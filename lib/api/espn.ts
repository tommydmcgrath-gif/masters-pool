import { ApiPlayer, LeaderboardProvider, PlayerStatus } from "../types";

/**
 * ESPN public API provider.
 * No API key required. Uses the free ESPN site API that powers espn.com.
 *
 * IMPORTANT: The correct endpoint is /scoreboard, not /leaderboard.
 * The response has NO status field on competitors — we derive
 * position from the `order` field and "thru" from counting hole entries.
 */
const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

export class EspnProvider implements LeaderboardProvider {
  async fetchLeaderboard(): Promise<{
    tournamentName: string;
    tournamentRound: string;
    players: ApiPlayer[];
  }> {
    const res = await fetch(ESPN_SCOREBOARD_URL, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`ESPN API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const event = data.events?.[0];

    if (!event) {
      console.warn("No active ESPN event found");
      return { tournamentName: "The Masters", tournamentRound: "Not Started", players: [] };
    }

    const tournamentName: string = event.name ?? "The Masters";
    const competition = event.competitions?.[0];
    const competitors: any[] = competition?.competitors ?? [];

    // Determine which round the tournament is in based on the data
    const currentRound = detectCurrentRound(competitors);
    const tournamentRound = `Round ${currentRound}`;

    console.log(`ESPN: ${tournamentName}, ${tournamentRound}, ${competitors.length} players`);

    // Build position strings with proper tie handling
    const sorted = [...competitors].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const positionMap = buildPositionMap(sorted);

    const players: ApiPlayer[] = sorted.map((c) =>
      parseCompetitor(c, currentRound, positionMap)
    );

    return { tournamentName, tournamentRound, players };
  }
}

/**
 * Figure out which round we're in by looking at how many round-level
 * linescores the top competitors have.
 */
function detectCurrentRound(competitors: any[]): number {
  let maxRounds = 1;
  for (const c of competitors.slice(0, 10)) {
    const rounds = (c.linescores ?? []).length;
    if (rounds > maxRounds) maxRounds = rounds;
  }
  return maxRounds;
}

/**
 * Build a position map that handles ties:
 *  "-5" → "T1" if multiple players share it, or "1" if solo
 */
function buildPositionMap(sorted: any[]): Map<string, string> {
  const map = new Map<string, string>();

  // Count how many players share each score
  const scoreCounts = new Map<string, number>();
  for (const c of sorted) {
    const s = c.score ?? "0";
    scoreCounts.set(s, (scoreCounts.get(s) ?? 0) + 1);
  }

  let pos = 1;
  let i = 0;
  while (i < sorted.length) {
    const score = sorted[i].score ?? "0";
    const count = scoreCounts.get(score) ?? 1;
    const prefix = count > 1 ? "T" : "";
    for (let j = i; j < i + count && j < sorted.length; j++) {
      map.set(sorted[j].id, `${prefix}${pos}`);
    }
    pos += count;
    i += count;
  }

  return map;
}

function parseCompetitor(
  c: any,
  currentRound: number,
  positionMap: Map<string, string>
): ApiPlayer {
  const athlete = c.athlete ?? {};
  const name: string = athlete.displayName ?? athlete.fullName ?? "Unknown";

  // Position from our tie-aware map
  const position: string = positionMap.get(c.id) ?? String(c.order ?? "-");

  // Total score relative to par — ESPN gives a string like "-5" or "E"
  const totalScore = parseScoreString(String(c.score ?? "0"));

  // Parse round-level linescores
  const roundLinescores: any[] = c.linescores ?? [];
  const rounds: number[] = [];
  let thru = "-";
  let todayScore: number | null = null;

  for (const rs of roundLinescores) {
    const holeEntries: any[] = rs.linescores ?? [];
    const roundNum: number = rs.period ?? 0;
    const strokeTotal: number = typeof rs.value === "number" ? rs.value : 0;

    if (holeEntries.length > 0 && strokeTotal > 0) {
      if (roundNum === currentRound) {
        // This is the current round
        if (holeEntries.length >= 18) {
          thru = "F";
        } else {
          thru = String(holeEntries.length);
        }
        // Today's score relative to par — use displayValue if available
        if (rs.displayValue) {
          todayScore = parseScoreString(rs.displayValue);
        }
      }
      rounds.push(strokeTotal);
    }
  }

  // If player hasn't started the current round
  if (thru === "-" && rounds.length < currentRound) {
    thru = "-";
    todayScore = null;
  }

  // Status: for now during rounds 1-2, everyone is active.
  // After the cut (round 3+), players with no round 3 data are "cut".
  let status: PlayerStatus = "active";
  if (currentRound >= 3 && rounds.length <= 2) {
    status = "cut";
  }

  return { name, position, totalScore, todayScore, thru, rounds, status };
}

function parseScoreString(s: string): number {
  if (!s) return 0;
  const t = s.trim();
  if (t === "E" || t === "Even" || t === "-" || t === "") return 0;
  const n = parseInt(t, 10);
  return isNaN(n) ? 0 : n;
}
