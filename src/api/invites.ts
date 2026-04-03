import client from './client';

export interface InviteResponse {
  code: string;
  inviteUrl: string;
}

export interface InviteResolveResponse {
  code: string;
  purpose: 'table' | 'lobby';
  tableId?: string;
  expiresAt?: string;
  maxUses?: number;
  uses?: number;
  table?: {
    tableId: string;
    name: string;
    mode: string;
    stake: number;
    currentPlayerCount: number;
    maxPlayers: number;
    isPrivate: boolean;
    status: 'waiting' | 'in-game';
    hostName: string;
    hostNote?: string | null;
  } | null;
}

export interface InviteAcceptResponse {
  tableId?: string;
  purpose: 'table' | 'lobby';
  table?: InviteResolveResponse['table'];
}

export const createInvite = async (payload: {
  tableId?: string;
  email?: string;
  expiresInHours?: number;
  maxUses?: number;
}): Promise<InviteResponse> => {
  const { data } = await client.post('/invites', payload);
  return data;
};

export const resolveInvite = async (code: string): Promise<InviteResolveResponse> => {
  const { data } = await client.get(`/invites/${code}`);
  return data;
};

export const acceptInvite = async (code: string): Promise<InviteAcceptResponse> => {
  const { data } = await client.post(`/invites/${code}/accept`);
  return data;
};
