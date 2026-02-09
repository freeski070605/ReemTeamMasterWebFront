import React from "react";
import { useWalletBalance } from "../../hooks/useWalletBalance";

const formatCurrency = (amount: number | null) => {
  if (amount === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const NavbarBalance: React.FC = () => {
  const { balance, loading, error } = useWalletBalance({
    refreshIntervalMs: 30000,
  });

  if (loading) {
    return (
      <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 animate-pulse">
        Balance...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-1 rounded-full border border-red-400/30 bg-red-500/10 text-xs text-red-200">
        Balance unavailable
      </div>
    );
  }

  return (
    <div className="px-3 py-1 rounded-full border border-yellow-400/30 bg-yellow-400/10 text-xs text-yellow-200">
      Balance {formatCurrency(balance)}
    </div>
  );
};

export default NavbarBalance;
