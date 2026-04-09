import {
  normalizePlayerName,
  mapApiPlayersToPoolPlayers,
  calculatePlayerEffectiveScore,
  calculateTeamScore,
  rankTeams,
  applyMissedCutRule,
  buildLeaderboard,
} from "../scoring";
import { ApiPlayer, PoolPlayer, Team } from "../types";

// ---------------------------------------------------------------------------
// normalizePlayerName
// ---------------------------------------------------------------------------

describe("normalizePlayerName", () => {
  it("lowercases and strips accents", () => {
    expect(normalizePlayerName("Ludvig Åberg")).toBe("ludvig aberg");
    expect(normalizePlayerName("Nicolai Højgaard")).toBe("nicolai hojgaard");
  });

  it("removes periods", () => {
    expect(normalizePlayerName("J.J. Spaun")).toBe("jj spaun");
    expect(normalizePlayerName("J. J. Spaun")).toBe("j j spaun");
  });

  it("collapses whitespace", () => {
    expect(normalizePlayerName("  Jon   Rahm  ")).toBe("jon rahm");
  });
});

// ---------------------------------------------------------------------------
// mapApiPlayersToPoolPlayers
// ---------------------------------------------------------------------------

describe("mapApiPlayersToPoolPlayers", () => {
  it("matches players by normalized name", () => {
    const apiPlayers: ApiPlayer[] = [
      makeApiPlayer({ name: "Ludvig Åberg" }),
      makeApiPlayer({ name: "Scottie Scheffler" }),
    ];
    const teams = [
      { name: "Team A", players: ["Ludvig Åberg", "Scottie Scheffler"] },
    ];

    const map = mapApiPlayersToPoolPlayers(apiPlayers, teams);
    expect(map.size).toBe(2);
    expect(map.get("ludvig aberg")?.name).toBe("Ludvig Åberg");
  });

  it("handles players not in API data gracefully", () => {
    const apiPlayers: ApiPlayer[] = [makeApiPlayer({ name: "Rory McIlroy" })];
    const teams = [{ name: "T", players: ["Rory McIlroy", "Unknown Player"] }];

    const map = mapApiPlayersToPoolPlayers(apiPlayers, teams);
    expect(map.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// applyMissedCutRule
// ---------------------------------------------------------------------------

describe("applyMissedCutRule", () => {
  it("returns fallback penalty when no R3/R4 data exists", () => {
    const players: ApiPlayer[] = [
      makeApiPlayer({ rounds: [70, 72], status: "active" }),
    ];
    const { worstR3, worstR4 } = applyMissedCutRule(players);
    expect(worstR3).toBe(5); // fallback
    expect(worstR4).toBe(5); // fallback
  });

  it("calculates worst R3 and R4 from active players", () => {
    const players: ApiPlayer[] = [
      makeApiPlayer({ rounds: [70, 68, 78, 80], status: "active" }), // R3=+6, R4=+8
      makeApiPlayer({ rounds: [72, 72, 73, 74], status: "active" }), // R3=+1, R4=+2
      makeApiPlayer({ rounds: [75, 76], status: "cut" }), // should be ignored
    ];
    const { worstR3, worstR4 } = applyMissedCutRule(players);
    expect(worstR3).toBe(6); // 78 - 72
    expect(worstR4).toBe(8); // 80 - 72
  });
});

// ---------------------------------------------------------------------------
// calculatePlayerEffectiveScore
// ---------------------------------------------------------------------------

describe("calculatePlayerEffectiveScore", () => {
  it("returns totalScore for active players", () => {
    const player = makeApiPlayer({ totalScore: -5, status: "active" });
    expect(calculatePlayerEffectiveScore(player, 6, 8)).toBe(-5);
  });

  it("adds worst R3 + R4 for cut players", () => {
    const player = makeApiPlayer({ totalScore: 3, status: "cut" });
    // effective = 3 + 6 + 8 = 17
    expect(calculatePlayerEffectiveScore(player, 6, 8)).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// calculateTeamScore
// ---------------------------------------------------------------------------

describe("calculateTeamScore", () => {
  it("sums the best 4 of 5 effective scores", () => {
    const players: PoolPlayer[] = [
      makePoolPlayer({ effectiveScore: -5 }),
      makePoolPlayer({ effectiveScore: -3 }),
      makePoolPlayer({ effectiveScore: 0 }),
      makePoolPlayer({ effectiveScore: 2 }),
      makePoolPlayer({ effectiveScore: 10 }), // worst — dropped
    ];

    const { teamScore, players: result } = calculateTeamScore(players);
    expect(teamScore).toBe(-6); // -5 + -3 + 0 + 2
    expect(result.filter((p) => p.isCounting).length).toBe(4);
    expect(result.find((p) => p.effectiveScore === 10)?.isCounting).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rankTeams
// ---------------------------------------------------------------------------

describe("rankTeams", () => {
  it("ranks teams by score, ties get same rank", () => {
    const teams: Team[] = [
      makeTeam({ name: "A", teamScore: -10 }),
      makeTeam({ name: "B", teamScore: -5 }),
      makeTeam({ name: "C", teamScore: -10 }),
      makeTeam({ name: "D", teamScore: 2 }),
    ];

    const ranked = rankTeams(teams);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1); // tied
    expect(ranked[2].rank).toBe(3);
    expect(ranked[3].rank).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApiPlayer(overrides: Partial<ApiPlayer> = {}): ApiPlayer {
  return {
    name: "Test Player",
    position: "T1",
    totalScore: 0,
    todayScore: null,
    thru: "F",
    rounds: [],
    status: "active",
    ...overrides,
  };
}

function makePoolPlayer(overrides: Partial<PoolPlayer> = {}): PoolPlayer {
  return {
    name: "Test Player",
    apiName: "Test Player",
    position: "T1",
    totalScore: 0,
    effectiveScore: 0,
    todayScore: null,
    thru: "F",
    rounds: [],
    status: "active",
    isCounting: false,
    ...overrides,
  };
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    name: "Test Team",
    players: [],
    teamScore: 0,
    rank: 0,
    ...overrides,
  };
}
