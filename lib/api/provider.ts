import { LeaderboardProvider } from "../types";
import { EspnProvider } from "./espn";

/**
 * Factory for leaderboard providers.
 * Swap implementations here when changing data sources.
 */
export function createProvider(): LeaderboardProvider {
  return new EspnProvider();
}
