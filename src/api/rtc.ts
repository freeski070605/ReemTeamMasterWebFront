import client from './client';

export interface RtcPurchaseBundle {
  id: string;
  usdPrice: number;
  rtcAmount: number;
}

interface RtcBundlesResponse {
  bundles: RtcPurchaseBundle[];
}

interface RtcPurchaseResponse {
  message: string;
  bundle: RtcPurchaseBundle;
  rtcBalance: number;
}

export const getRtcBundles = async (): Promise<RtcPurchaseBundle[]> => {
  const { data } = await client.get<RtcBundlesResponse>('/rtc/bundles');
  return Array.isArray(data?.bundles) ? data.bundles : [];
};

export const purchaseRtcBundle = async (
  bundleId: string,
  paymentReferenceId?: string
): Promise<RtcPurchaseResponse> => {
  const payload = paymentReferenceId ? { bundleId, paymentReferenceId } : { bundleId };
  const { data } = await client.post<RtcPurchaseResponse>('/rtc/purchase', payload);
  return data;
};
