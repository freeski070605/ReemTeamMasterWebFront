import client from './client';
import { Table } from '../types/game';

export interface ManagedPrivateTable extends Table {
  inviteCode?: string | null;
  inviteUrl?: string | null;
  inviteExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type QuickPlayReason =
  | 'ready_to_start'
  | 'instant_ai_start'
  | 'filling_fast'
  | 'live_open_seat';

export interface QuickSeatResult {
  tableId: string;
  table: Table;
  reason: QuickPlayReason;
  beginnerFriendly: boolean;
  availableOpenTables: number;
}

export const quickSeat = async (options?: {
  beginnerMode?: boolean;
}): Promise<QuickSeatResult> => {
  const { data } = await client.post<QuickSeatResult>('/tables/quick-seat', options ?? {});
  return data;
};

export const createPrivateTable = async (payload: {
  mode: 'FREE_RTC_TABLE' | 'PRIVATE_USD_TABLE';
  stake: number;
  maxPlayers?: number;
  hostNote?: string;
}): Promise<{ table: Table; inviteCode: string; inviteUrl: string }> => {
  const { data } = await client.post('/tables/private', payload);
  return data;
};

export const getMyPrivateTables = async (): Promise<ManagedPrivateTable[]> => {
  const { data } = await client.get<{ tables: ManagedPrivateTable[] }>('/tables/private/mine');
  return data.tables || [];
};
