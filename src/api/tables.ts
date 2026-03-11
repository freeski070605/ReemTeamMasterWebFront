import client from './client';
import { Table } from '../types/game';

export const quickSeat = async (): Promise<Table> => {
  const { data } = await client.post<{ tableId: string; table: Table }>('/tables/quick-seat');
  return data.table;
};

export const createPrivateTable = async (payload: {
  stake: number;
  maxPlayers?: number;
}): Promise<{ table: Table; inviteCode: string; inviteUrl: string }> => {
  const { data } = await client.post('/tables/private', payload);
  return data;
};
