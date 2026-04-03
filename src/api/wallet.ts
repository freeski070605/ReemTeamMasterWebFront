import { Transaction } from "../types/transaction";
import client from "./client";

export type WalletCurrency = "usd" | "rtc";
export interface AccountStats {
  matchesPlayed: number;
  totalWins: number;
  totalReems: number;
  winRate: number;
  usdEarned: number;
  rtcEarned: number;
  usdNet: number;
  rtcNet: number;
  biggestUsdPayout: number;
  biggestRtcPayout: number;
}

export const getTransactionHistory = async (currency?: WalletCurrency): Promise<Transaction[]> => {
  const { data } = await client.get<Transaction[]>("/wallet/transactions", {
    params: { currency },
  });
  return data;
};

export const getWalletBalance = async (currency: WalletCurrency = "usd"): Promise<number> => {
  const { data } = await client.get<{ balance: number; currency: "USD" | "RTC" }>("/wallet/balance", {
    params: { currency },
  });
  return data.balance;
};

export const getAccountStats = async (): Promise<AccountStats> => {
  const { data } = await client.get<AccountStats>("/wallet/account-stats");
  return data;
};

export const requestWithdrawal = async (params: {
  amount: number;
  payoutMethod: "Cash App" | "Apple Pay" | "PayPal";
  payoutAddress: string;
}) => {
  const { data } = await client.post("/wallet/request-withdrawal", params);
  return data;
};

export async function createCheckout(amount: number): Promise<string> {
  const { data } = await client.post<{ checkoutUrl: string }>(
    "/payment/create-checkout",
    { amount }
  );
  return data.checkoutUrl;
}
