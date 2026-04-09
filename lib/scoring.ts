import {
  ApiPlayer,
  PoolPlayer,
  Team,
  PlayerStatus,
} from "./types";
import { TeamDefinition } from "./teams";

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a player name for fuzzy matching:
 * - lowercase
 * - strip accents / diacritics
 * - collapse whitespace
 * - remove periods (handles "J.J." vs "J J" vs "JJ")
 */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/\./g, "")             // remove periods
    .replace(/\s+/g, " ")           // collapse whitespace
    .trim();
}

// ---------------------------------------------------------------------------
// Player mapping
// ---------------------------------------------------------------------------

/**
 * Match API players to pool players by normalized name.
 * Returns a map from normalized pool-player name → ApiPlayer.
 */
export function mapApiPlayersToPoolPlayers(
  apiPlayers: ApiPlayer[],
  teams: TeamDefinition[]
): Map<string, ApiPlayer> {
  const apiByNorm = new Map<string, ApiPlayer>();
  for (const p of apiPlayers) {
    apiByNorm.set(normalizePlayerName(p.name), p);
  }

  const result = new Map<string, ApiPlayer>();
  for (const team of teams) {
    for (const playerName of team.players) {
      const norm = normalizePlayerName(playerName);
      const match = apiByNorm.get(norm);
      if (match) {
        result.set(norm, match);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Missed-cut rule
// ---------------------------------------------------------------------------

/**
 * MISSED-CUT RULE
 *
 * When a player misses the cut:
 *   1. We keep their actual score through 36 holes (rounds 1 + 2).
 *   2. We find the worst (highest) round-3 score and worst round-4 score
 *      among ALL players who made the cut and have completed those rounds.
 *   3. The missed-cut player's effective total = their 36-hole score
 *      + worst-R3-strokes-over-par + worst-R4-strokes-over-par.
 *
 * If round 3/4 data isn't available yet (tournament still in early rounds),
 * we use a fallback penalty of +5 per missing round. This ensures
 * missed-cut players always score worse than active players.
 *
 * Returns { worstR3: number, worstR4: number } as strokes RELATIVE TO PAR
 * for the worst rounds among players who made the cut.
 */
export function applyMissedCutRule(allApiPlayers: ApiPlayer[]): {
  worstR3: number;
  worstR4: number;
} {
  const FALLBACK_PENALTY = 5; // +5 per round if no data available
  let worstR3 = FALLBACK_PENALTY;
  let worstR4 = FALLBACK_PENALTY;

  // Augusta National par is 72
  const PAR = 72;

  const activePlayers = allApiPlayers.filter((p) => p.status === "active");

  // Find worst round-3 score (relative to par) among active players
  const r3Scores = activePlayers
    .filter((p) => p.rounds.length >= 3)
    .map((p) => p.rounds[2] - PAR);
  if (r3Scores.length > 0) {
    worstR3 = Math.max(...r3Scores);
  }

  // Find worst round-4 score (relative to par) among active players
  const r4Scores = activePlayers
    .filter((p) => p.rounds.length >= 4)
    .map((p) => p.rounds[3] - PAR);
  if (r4Scores.length > 0) {
    worstR4 = Math.max(...r4Scores);
  }

  return { worstR3, worstR4 };
}

/**
 * Calculate a player's effective score relative to par.
 *
 * - Active players: use their live totalScore as-is.
 * - Missed-cut players: their 36-hole total + worst R3 + worst R4 among the field.
 */
export function calculatePlayerEffectiveScore(
  player: ApiPlayer,
  worstR3: number,
  worstR4: number
): number {
  if (player.status !== "cut") {
    return player.totalScore;
  }

  // For missed-cut players:
  // totalScore already reflects their 36-hole score relative to par.
  // Add the worst R3 and R4 scores (also relative to par) as penalty.
  return player.totalScore + worstR3 + worstR4;
}

// ---------------------------------------------------------------------------
// Team scoring
// ---------------------------------------------------------------------------

/**
 * Calculate team score: sum of the best (lowest) 4 out of 5 effective scores.
 * Returns the team score and marks which players are counting.
 */
export function calculateTeamScore(players: PoolPlayer[]): {
  teamScore: number;
  players: PoolPlayer[];
} {
  // Sort by effective score ascending (best first)
  const sorted = [...players].sort(
    (a, b) => a.effectiveScore - b.effectiveScore
  );

  // Best 4 count
  const counting = Math.min(4, sorted.length);
  let teamScore = 0;

  const result = sorted.map((p, i) => {
    const isCounting = i < counting;
    if (isCounting) teamScore += p.effectiveScore;
    return { ...p, isCounting };
  });

  return { teamScore, players: result };
}

/**
 * Rank teams by score (lower is better). Ties get the same rank.
 */
export function rankTeams(teams: Team[]): Team[] {
  const sorted = [...teams].sort((a, b) => a.teamScore - b.teamScore);

  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].teamScore > sorted[i - 1].teamScore) {
      currentRank = i + 1;
    }
    sorted[i] = { ...sorted[i], rank: currentRank };
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Full pipeline: API players + team definitions → ranked leaderboard
// ---------------------------------------------------------------------------

export function buildLeaderboard(
  apiPlayers: ApiPlayer[],
  teamDefs: TeamDefinition[]
): Team[] {
  const playerMap = mapApiPlayersToPoolPlayers(apiPlayers, teamDefs);
  const { worstR3, worstR4 } = applyMissedCutRule(apiPlayers);

  const teams: Team[] = teamDefs.map((def) => {
    const poolPlayers: PoolPlayer[] = def.players.map((name) => {
      const norm = normalizePlayerName(name);
      const api = playerMap.get(norm);

      if (!api) {
        // Player not found in API data — show as not started with 0 score
        return {
          name,
          apiName: name,
          position: "-",
          totalScore: 0,
          effectiveScore: 0,
          todayScore: null,
          thru: "-",
          rounds: [],
          status: "active" as PlayerStatus,
          isCounting: false,
        };
      }

      const effectiveScore = calculatePlayerEffectiveScore(
        api,
        worstR3,
        worstR4
      );

      return {
        name,
        apiName: api.name,
        position: api.position,
        totalScore: api.totalScore,
        effectiveScore,
        todayScore: api.todayScore,
        thru: api.thru,
        rounds: api.rounds,
        status: api.status,
        isCounting: false, // will be set by calculateTeamScore
      };
    });

    const { teamScore, players } = calculateTeamScore(poolPlayers);

    return {
      name: def.name,
      players,
      teamScore,
      rank: 0, // will be set by rankTeams
    };
  });

  return rankTeams(teams);
}
