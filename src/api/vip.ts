import client from './client';

interface VipCheckoutResponse {
  checkoutUrl: string;
}

export interface VipStatusResponse {
  vipStatus: string;
  vipExpiresAt?: string | null;
  vipSince?: string | null;
  isVip: boolean;
}

export const createVipCheckout = async (): Promise<string> => {
  const { data } = await client.post<VipCheckoutResponse>('/vip/checkout');
  return data.checkoutUrl;
};

export const getVipStatus = async (): Promise<VipStatusResponse> => {
  const { data } = await client.get<VipStatusResponse>('/vip/status');
  return data;
};

export const cancelVipSubscription = async (): Promise<VipStatusResponse> => {
  const { data } = await client.post<VipStatusResponse>('/vip/cancel');
  return data;
};
