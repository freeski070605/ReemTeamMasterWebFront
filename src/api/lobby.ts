import client from './client';

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
