import React, { useState } from "react";
import { toast } from "react-toastify";
import { requestWithdrawal } from "../../api/wallet";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const PayoutForm: React.FC = () => {
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"Cash App" | "Apple Pay" | "PayPal">("Cash App");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePayout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Enter a valid withdrawal amount.");
      return;
    }
    if (!address.trim()) {
      toast.error("Enter a payout address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestWithdrawal({
        amount: parsedAmount,
        payoutMethod,
        payoutAddress: address.trim(),
      });
      toast.success("Withdrawal request submitted.");
      setAmount("");
      setAddress("");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to request withdrawal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rt-panel-strong p-6 rounded-2xl">
      <h2 className="text-lg font-semibold text-white mb-2 rt-page-title">Request Payout</h2>
      <p className="text-xs text-white/55 mb-5">Withdrawals are reviewed manually for security.</p>
      <form onSubmit={handlePayout}>
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-[0.2em] text-white/60 mb-2">
            Payout Method
          </label>
          <select
            value={payoutMethod}
            onChange={(e) => setPayoutMethod(e.target.value as "Cash App" | "Apple Pay" | "PayPal")}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
          >
            <option value="Cash App">Cash App</option>
            <option value="Apple Pay">Apple Pay</option>
            <option value="PayPal">PayPal</option>
          </select>
        </div>
        <div className="mb-4">
          <Input
            label="Amount"
            type="number"
            value={amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            placeholder="Amount"
            required
          />
        </div>
        <div className="mb-6">
          <Input
            label="Payout Address"
            type="text"
            value={address}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
            placeholder="Payout Address"
            required
          />
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Request Withdrawal"}
        </Button>
      </form>
    </div>
  );
};

export default PayoutForm;
