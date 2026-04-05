import client from "./client";
import { Contest, Table } from "../types/game";

export type LeaderboardRanking = {
  rank: number;
  playerId: string;
  username: string;
  value: number;
  secondaryValue?: number;
};

export type HomeLeaderboard = {
  metric: string;
  window: string;
  title: string;
  description: string;
  rankings: LeaderboardRanking[];
};

export type HomeOverview = {
  generatedAt: string;
  tableSummary: {
    totalTables: number;
    activeTables: number;
    rtcTables: number;
    cashTables: number;
    privateTables: number;
  };
  contestSummary: {
    totalContests: number;
    openContests: number;
    liveContests: number;
    seatsFilled: number;
    totalSeats: number;
    totalPrizePool: number;
  };
  featuredTable: Table | null;
  featuredContest: Contest | null;
  leaderboards: {
    topEarners: HomeLeaderboard | null;
    mostReems: HomeLeaderboard | null;
    bestWinRate: HomeLeaderboard | null;
    longestStreak: HomeLeaderboard | null;
  };
};

export const getHomeOverview = async (): Promise<HomeOverview> => {
  const { data } = await client.get<HomeOverview>("/home/overview");
  return data;
};
