import { NextResponse } from "next/server";
import { createProvider } from "@/lib/api/provider";
import { buildLeaderboard } from "@/lib/scoring";
import { TEAMS } from "@/lib/teams";
import { PoolLeaderboard } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const provider = createProvider();
    const { tournamentName, tournamentRound, players } =
      await provider.fetchLeaderboard();

    console.log(`Fetched ${players.length} players from provider`);

    const teams = buildLeaderboard(players, TEAMS);

    const leaderboard: PoolLeaderboard = {
      tournamentName,
      tournamentRound,
      teams,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(leaderboard);
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("Leaderboard fetch failed:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
