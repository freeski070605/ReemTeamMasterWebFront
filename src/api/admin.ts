import client from './client';
import { UserRole } from '../types/roles';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  role: UserRole;
  isBanned: boolean;
  isFrozen: boolean;
  adminNotes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminWallet {
  userId: string;
  usdBalance: number;
  rtcBalance: number;
  pendingWithdrawals: number;
  lifetimeDeposits: number;
  lifetimeWithdrawals: number;
  lastRtcRefill?: string;
  updatedAt?: string;
}

export interface AdminWithdrawal {
  id: string;
  userId: string;
  username?: string;
  email?: string;
  amount: number;
  payoutMethod: string;
  payoutAddressMasked: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  requestedAt: string;
  processedAt?: string;
  transactionId?: string;
}

export type AdminTableStatusFilter = 'all' | 'in-game' | 'waiting';

export interface AdminTable {
  tableId: string;
  name: string;
  mode: string;
  stake: number;
  status: 'waiting' | 'in-game';
  isPromo?: boolean;
  minPlayers: number;
  maxPlayers: number;
  currentPlayerCount: number;
  currentMatchId?: string | null;
  activeContestId?: string | null;
  playersSeated: Array<{
    userId: string;
    username: string;
    isAI: boolean;
  }>;
  currentPot?: number | null;
  turnState?: {
    status: string;
    turn: number;
    currentPlayerId?: string | null;
    currentPlayerUsername?: string | null;
    turnExpiresAt?: number | null;
    turnTimeRemainingMs?: number | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminWalletSearchResult {
  user: AdminUser;
  wallet: AdminWallet;
}

export interface AdminAuditRecord {
  _id: string;
  adminUserId: {
    _id: string;
    username: string;
    email: string;
    role: UserRole;
  };
  adminRole: UserRole;
  action: string;
  targetType: string;
  targetId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
  createdAt: string;
}

export type AdminTournamentStatus = 'draft' | 'open' | 'locked' | 'in-progress' | 'completed' | 'cancelled';
export type AdminTournamentEditableStatus = 'draft' | 'open' | 'locked' | 'cancelled';

export interface AdminTournamentPayoutRule {
  rank: number;
  amount: number;
  percentage?: number;
}

export interface AdminTournament {
  _id: string;
  contestId: string;
  mode: string;
  entryFee: number;
  playerCount: number;
  prizePool: number;
  platformFee: number;
  status: AdminTournamentStatus;
  payoutStructure: AdminTournamentPayoutRule[];
  participants: string[];
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTournamentRefundResult {
  message: string;
  contestId: string;
  deleted: boolean;
  refundedAmount: number;
  paidEntryCount: number;
  refundedEntryCount: number;
  restoredTicketCount: number;
  alreadyRefundedCount: number;
  contest: AdminTournament | null;
}

export interface AdminTournamentMutationInput {
  entryFee: number;
  playerCount: number;
  platformFee?: number;
  status: AdminTournamentEditableStatus;
  payoutStructure?: Array<{
    rank: number;
    amount?: number;
    percentage?: number;
  }>;
}

export interface AdminMetrics {
  generatedAt: string;
  users: {
    total: number;
    privileged: number;
    banned: number;
    frozen: number;
  };
  operations: {
    activeTables: number;
    activeMatches: number;
    openContests: number;
    pendingWithdrawals: number;
    matchesLast24h: number;
    auditsLast24h: number;
  };
  wallets: {
    totalWallets: number;
    totalUsdBalance: number;
    totalRtcBalance: number;
  };
  runtime: {
    uptimeSeconds: number;
    nodeVersion: string;
    redisConnected: boolean;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
}

export const adminApi = {
  searchUsers: async (q: string) => {
    const { data } = await client.get<{ users: AdminUser[] }>('/admin/users/search', { params: { q } });
    return data.users || [];
  },
  getUser: async (id: string) => {
    const { data } = await client.get<{ user: AdminUser; wallet: AdminWallet; transactions: any[] }>(`/admin/users/${id}`);
    return data;
  },
  setBanState: async (id: string, isBanned: boolean, note?: string) => {
    const { data } = await client.patch<AdminUser>(`/admin/users/${id}/ban`, { isBanned, note });
    return data;
  },
  setFreezeState: async (id: string, isFrozen: boolean, note?: string) => {
    const { data } = await client.patch<AdminUser>(`/admin/users/${id}/freeze`, { isFrozen, note });
    return data;
  },
  setUserRole: async (id: string, role: UserRole, note?: string) => {
    const { data } = await client.patch<AdminUser>(`/admin/users/${id}/role`, { role, note });
    return data;
  },
  getWallet: async (userId: string) => {
    const { data } = await client.get<{ user: AdminUser; wallet: AdminWallet; transactions: any[] }>(`/admin/wallets/${userId}`);
    return data;
  },
  searchWallets: async (q: string) => {
    const { data } = await client.get<{ results: AdminWalletSearchResult[] }>('/admin/wallets/search', { params: { q } });
    return data.results || [];
  },
  adjustWallet: async (payload: { userId: string; amount: number; reason: string; currency: 'USD' | 'RTC' }) => {
    const { data } = await client.post('/admin/wallets/adjust', payload);
    return data;
  },
  getWithdrawals: async (status: string = 'pending') => {
    const { data } = await client.get<{ withdrawals: AdminWithdrawal[] }>('/admin/withdrawals', { params: { status } });
    return data.withdrawals || [];
  },
  approveWithdrawal: async (id: string) => {
    const { data } = await client.patch(`/admin/withdrawals/${id}/approve`);
    return data;
  },
  rejectWithdrawal: async (id: string) => {
    const { data } = await client.patch(`/admin/withdrawals/${id}/reject`);
    return data;
  },
  getTables: async (status: AdminTableStatusFilter = 'all') => {
    const { data } = await client.get<{ tables: AdminTable[] }>('/admin/tables', { params: { status } });
    return data.tables || [];
  },
  getLiveTables: async () => {
    const { data } = await client.get<{ tables: AdminTable[] }>('/admin/tables/live');
    return data.tables || [];
  },
  getPromoTable: async () => {
    const { data } = await client.get<{ table: AdminTable | null }>('/admin/tables/promo');
    return data.table;
  },
  ensurePromoTable: async (reset: boolean = false) => {
    const { data } = await client.post<{ table: AdminTable }>('/admin/tables/promo/ensure', { reset });
    return data.table;
  },
  resetTable: async (tableId: string) => {
    const { data } = await client.post(`/admin/tables/${tableId}/reset`, { keepContestBinding: false });
    return data;
  },
  getMatch: async (id: string) => {
    const { data } = await client.get(`/admin/matches/${id}`);
    return data;
  },
  getSystemMetrics: async () => {
    const { data } = await client.get<AdminMetrics>('/admin/system/metrics');
    return data;
  },
  getAudits: async (params: { page?: number; limit?: number; action?: string; adminUserId?: string; targetType?: string }) => {
    const { data } = await client.get<{ records: AdminAuditRecord[]; total: number; page: number; limit: number }>(
      '/admin/audits',
      { params }
    );
    return data;
  },
  getTournaments: async (status?: string) => {
    const { data } = await client.get<{ tournaments: AdminTournament[] }>('/admin/tournaments', { params: { status } });
    return data.tournaments || [];
  },
  createTournament: async (payload: AdminTournamentMutationInput) => {
    const { data } = await client.post<{ tournament: AdminTournament }>('/admin/tournaments', payload);
    return data.tournament;
  },
  updateTournament: async (contestId: string, payload: AdminTournamentMutationInput) => {
    const { data } = await client.put<{ tournament: AdminTournament }>(`/admin/tournaments/${contestId}`, payload);
    return data.tournament;
  },
  deleteTournament: async (contestId: string) => {
    const { data } = await client.delete<{ success: boolean; contestId: string }>(`/admin/tournaments/${contestId}`);
    return data;
  },
  refundTournament: async (contestId: string, payload?: { deleteAfterRefund?: boolean; reason?: string }) => {
    const { data } = await client.post<AdminTournamentRefundResult>(`/admin/tournaments/${contestId}/refund`, payload);
    return data;
  },
};
