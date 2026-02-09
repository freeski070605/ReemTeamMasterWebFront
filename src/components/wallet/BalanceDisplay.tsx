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
    <div className={`bg-white/5 p-6 rounded-2xl text-center border border-white/10 shadow-sm ${className || ""}`}>
      <h2 className="text-sm uppercase tracking-[0.2em] text-white/50 mb-2">{label}</h2>
      <p className="text-4xl font-semibold text-white">{formatCurrency(balance)}</p>
    </div>
  );
};

export default BalanceDisplay;
