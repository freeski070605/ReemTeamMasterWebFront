import client from './client';

export interface RtcPurchaseBundle {
  id: string;
  usdPrice: number;
  rtcAmount: number;
}

interface RtcBundlesResponse {
  bundles: RtcPurchaseBundle[];
}

interface RtcCheckoutResponse {
  checkoutUrl: string;
}

export const getRtcBundles = async (): Promise<RtcPurchaseBundle[]> => {
  const { data } = await client.get<RtcBundlesResponse>('/rtc/bundles');
  return Array.isArray(data?.bundles) ? data.bundles : [];
};

export const createRtcCheckout = async (bundleId: string): Promise<string> => {
  const { data } = await client.post<RtcCheckoutResponse>('/payment/create-rtc-checkout', { bundleId });
  return data.checkoutUrl;
};

export interface RtcRefillResponse {
  rtcBalance: number;
  refilled: boolean;
  refillAmount: number;
  nextEligibleAt: string;
  lastRtcRefill: string;
}

export const requestRtcRefill = async (): Promise<RtcRefillResponse> => {
  const { data } = await client.post<RtcRefillResponse>('/rtc/refill');
  return data;
};
