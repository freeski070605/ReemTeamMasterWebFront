import React, { useState, useEffect } from "react";
import { Transaction } from "../../types/transaction";
import { getTransactionHistory } from "../../api/wallet";
import { Loader } from "../ui/Loader";

type TransactionHistoryProps = {
  embedded?: boolean;
};

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ embedded = false }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const data = await getTransactionHistory();
        setTransactions(data);
      } catch (err) {
        setError("Failed to fetch transaction history.");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  const content = (
    <>
      <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
      {transactions.length === 0 ? (
        <div className="text-white/50">No transactions yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white/5 rounded-lg">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-white/60 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {transactions.map((tx) => (
                <tr key={tx._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">{tx.type}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                    {tx.amount > 0 ? `+$${tx.amount}` : `-$${Math.abs(tx.amount)}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.status === "Completed" ? "bg-green-500/20 text-green-200" : tx.status === "Pending" ? "bg-yellow-500/20 text-yellow-200" : "bg-red-500/20 text-red-200"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div className="bg-white/5 p-6 rounded-2xl shadow-sm border border-white/10">
      {content}
    </div>
  );
};

export default TransactionHistory;
