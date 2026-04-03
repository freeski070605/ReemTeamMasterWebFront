import client from './client';
import { Table } from '../types/game';

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
