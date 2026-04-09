/** Raw player data returned by a leaderboard provider */
export interface ApiPlayer {
  name: string;
  position: string; // e.g. "T3", "1", "CUT"
  totalScore: number; // aggregate score relative to par (e.g. -5)
  todayScore: number | null; // today's round score relative to par, null if not started
  thru: string; // e.g. "F", "12", "-" (not started)
  rounds: number[]; // strokes per round, e.g. [68, 72, ...]
  status: PlayerStatus;
}

export type PlayerStatus = "active" | "cut" | "withdrawn" | "disqualified";

/** A player mapped into our pool with effective scoring applied */
export interface PoolPlayer {
  name: string; // display name from our team definitions
  apiName: string; // name as it came from the API
  position: string;
  totalScore: number; // raw total relative to par
  effectiveScore: number; // after missed-cut penalty applied
  todayScore: number | null;
  thru: string;
  rounds: number[];
  status: PlayerStatus;
  isCounting: boolean; // true if this player is one of the best 4
}

export interface Team {
  name: string;
  players: PoolPlayer[];
  teamScore: number; // sum of best 4 effective scores
  rank: number;
}

export interface PoolLeaderboard {
  tournamentName: string;
  tournamentRound: string; // e.g. "Round 2", "Final"
  teams: Team[];
  lastUpdated: string; // ISO timestamp
}

/** Provider interface — implement this to swap data sources */
export interface LeaderboardProvider {
  fetchLeaderboard(): Promise<{
    tournamentName: string;
    tournamentRound: string;
    players: ApiPlayer[];
  }>;
}
