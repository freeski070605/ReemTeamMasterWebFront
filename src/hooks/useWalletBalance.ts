import { useCallback, useEffect, useState } from "react";
import { getWalletBalance } from "../api/wallet";

export type UseWalletBalanceOptions = {
  refreshIntervalMs?: number;
  refreshKey?: string | number;
};

export type UseWalletBalanceResult = {
  balance: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export const useWalletBalance = (
  options: UseWalletBalanceOptions = {}
): UseWalletBalanceResult => {
  const { refreshIntervalMs, refreshKey } = options;
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextBalance = await getWalletBalance();
      setBalance(nextBalance);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to fetch balance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, refreshKey]);

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const intervalId = setInterval(() => {
      fetchBalance();
    }, refreshIntervalMs);
    return () => clearInterval(intervalId);
  }, [fetchBalance, refreshIntervalMs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => {
      fetchBalance();
    };
    window.addEventListener("wallet-balance-refresh", handleRefresh);
    return () => window.removeEventListener("wallet-balance-refresh", handleRefresh);
  }, [fetchBalance]);

  return { balance, loading, error, refresh: fetchBalance };
};
