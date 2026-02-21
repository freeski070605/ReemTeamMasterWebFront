import React from "react";
import { useWalletBalance } from "../../hooks/useWalletBalance";

const formatRtc = (amount: number | null) => {
  if (amount === null) return "0";
  return Math.max(0, Math.floor(amount)).toLocaleString("en-US");
};

const NavbarBalance: React.FC = () => {
  const { balance, loading, error } = useWalletBalance({
    refreshIntervalMs: 30000,
    currency: "rtc",
  });

  if (loading) {
    return (
      <div className="px-3 py-1 rounded-full border border-white/12 bg-white/5 text-xs text-white/60 animate-pulse">
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
    <div className="px-3 py-1 rounded-full border border-amber-300/35 bg-amber-300/12 text-xs text-amber-100 shadow-[0_0_0_1px_rgba(247,188,58,0.12)_inset]">
      RTC {formatRtc(balance)}
    </div>
  );
};

export default NavbarBalance;
