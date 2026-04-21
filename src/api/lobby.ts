import client from './client';
import { QuickPlayReason } from './tables';
import { Table } from '../types/game';

export interface LobbySummary {
  onlinePlayers: number;
  activeTables: number;
  openSeats: number;
  rtcTables: number;
  usdTables: number;
  totalTables: number;
}

export const getLobbySummary = async (): Promise<LobbySummary> => {
  const { data } = await client.get<LobbySummary>('/lobby/summary');
  return data;
};

export interface LobbyActivationState {
  generatedAt: string;
  summary: LobbySummary;
  playerState: {
    matchesPlayed: number;
    hasPlayedGame: boolean;
    hasCompletedGame: boolean;
    lastStartedAt?: string | null;
    lastCompletedAt?: string | null;
  };
  quickPlay: {
    table: Table;
    reason: QuickPlayReason;
    beginnerFriendly: boolean;
  } | null;
  recommendedTables: Array<{
    table: Table;
    reason: QuickPlayReason;
    beginnerFriendly: boolean;
  }>;
}

export const getLobbyActivationState = async (): Promise<LobbyActivationState> => {
  const { data } = await client.get<LobbyActivationState>('/lobby/activation');
  return data;
};
