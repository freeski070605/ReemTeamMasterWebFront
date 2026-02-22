import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { createCheckout } from "../api/wallet";
import BalanceDisplay from "../components/wallet/BalanceDisplay";
import PayoutForm from "../components/wallet/PayoutForm";
import TransactionHistory from "../components/wallet/TransactionHistory";
import { Button } from "../components/ui/Button";

const Wallet: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState<number>(Date.now());

  useEffect(() => {
    const paymentStatus = searchParams.get("paymentStatus");
    if (paymentStatus === "success") {
      toast.success("Deposit completed. Your balance will update shortly.");
      window.dispatchEvent(new Event("wallet-balance-refresh"));
      setRefreshKey(Date.now());
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("paymentStatus");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleDeposit = async (amount: number) => {
    try {
      const checkoutUrl = await createCheckout(amount);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      toast.error("Failed to start checkout.");
    } catch (error) {
      console.error('Deposit error:', error);
      const apiMessage =
        (error as any)?.response?.data?.errors?.[0]?.detail ||
        (error as any)?.response?.data?.message;
      toast.error(apiMessage || 'Failed to initiate deposit.');
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-white">Wallet</h1>
        <p className="text-white/60">Manage your funds and view your transaction history.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <TransactionHistory />
        </div>

        <div className="space-y-8">
          <BalanceDisplay refreshKey={refreshKey} />
          <div className="bg-black/60 p-6 rounded-2xl shadow-lg border border-white/10 backdrop-blur">
             <h2 className="text-2xl font-semibold text-white mb-4">Deposit Funds</h2>
             <div className="grid grid-cols-2 gap-4">
               {[25, 50, 100, 250].map((amount) => (
                <Button 
                  key={amount} 
                  variant="secondary" 
                  onClick={() => handleDeposit(amount)}
                  className="h-16 text-lg font-bold"
                >
                  ${amount}
                </Button>
              ))}
             </div>
          </div>
          <PayoutForm />
        </div>
      </div>
    </div>
  );
};

export default Wallet;
