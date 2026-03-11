import client from './client';

export interface RecentPlayer {
  _id: string;
  userId: string;
  recentUserId: string;
  recentUsername: string;
  recentAvatarUrl?: string | null;
  lastPlayedAt: string;
}

export const getRecentPlayers = async (limit = 10): Promise<RecentPlayer[]> => {
  const { data } = await client.get<RecentPlayer[]>(`/users/recent-players?limit=${limit}`);
  return Array.isArray(data) ? data : [];
};
