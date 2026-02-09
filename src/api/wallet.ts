import { Transaction } from "../types/transaction";
import client from "./client";

export const getTransactionHistory = async (): Promise<Transaction[]> => {
  const { data } = await client.get<Transaction[]>("/wallet/transactions");
  return data;
};

export const getWalletBalance = async (): Promise<number> => {
  const { data } = await client.get<{ balance: number }>("/wallet/balance");
  return data.balance;
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
