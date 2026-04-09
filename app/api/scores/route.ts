import { NextResponse } from "next/server";
import { createProvider } from "@/lib/api/provider";
import { buildLeaderboard } from "@/lib/scoring";
import { TEAMS } from "@/lib/teams";
import { PoolLeaderboard } from "@/lib/types";

export const dynamic = "force-dynamic"; // never cache this route

export async function GET() {
  try {
    const provider = createProvider();
    const { tournamentName, tournamentRound, players } =
      await provider.fetchLeaderboard();

    const teams = buildLeaderboard(players, TEAMS);

    const leaderboard: PoolLeaderboard = {
      tournamentName,
      tournamentRound,
      teams,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(leaderboard);
  } catch (err: any) {
    console.error("Failed to fetch leaderboard:", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
