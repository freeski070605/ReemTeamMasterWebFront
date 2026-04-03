import client from './client';
import { Table } from '../types/game';

export interface ManagedPrivateTable extends Table {
  inviteCode?: string | null;
  inviteUrl?: string | null;
  inviteExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const quickSeat = async (): Promise<Table> => {
  const { data } = await client.post<{ tableId: string; table: Table }>('/tables/quick-seat');
  return data.table;
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
