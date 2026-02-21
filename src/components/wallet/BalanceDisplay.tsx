import React from "react";
import { useWalletBalance } from "../../hooks/useWalletBalance";
import { Loader } from "../ui/Loader";

type BalanceDisplayProps = {
  refreshKey?: string | number;
  refreshIntervalMs?: number;
  className?: string;
  label?: string;
};

const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  refreshKey,
  refreshIntervalMs,
  className,
  label = "Current Balance",
}) => {
  const { balance, loading, error } = useWalletBalance({
    refreshKey,
    refreshIntervalMs,
  });

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className={`rt-panel-strong rounded-2xl p-6 ${className || ""}`}>
      <h2 className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">{label}</h2>
      <p className="text-4xl font-semibold text-white rt-page-title">{formatCurrency(balance)}</p>
      <p className="mt-2 text-xs text-white/55">USD withdrawable balance</p>
    </div>
  );
};

export default BalanceDisplay;
