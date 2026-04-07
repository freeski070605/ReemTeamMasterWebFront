import React, { useState, useEffect } from "react";
import { Transaction } from "../../types/transaction";
import { getTransactionHistory } from "../../api/wallet";
import { Loader } from "../ui/Loader";
import { formatRTCCompactAmount } from "../../utils/rtcCurrency";

type TransactionHistoryProps = {
  embedded?: boolean;
  showTitle?: boolean;
  pageSize?: number;
};

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  embedded = false,
  showTitle = true,
  pageSize,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

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

  useEffect(() => {
    if (!pageSize) {
      return;
    }

    const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, pageSize, transactions.length]);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  const formatAmount = (amount: number, currency: "USD" | "RTC") => {
    const sign = amount > 0 ? "+" : "-";
    const absoluteAmount = Math.abs(amount);

    if (currency === "USD") {
      return `${sign}$${absoluteAmount.toFixed(2)}`;
    }
    return `${sign}${formatRTCCompactAmount(absoluteAmount)} RTC`;
  };

  const totalPages = pageSize ? Math.max(1, Math.ceil(transactions.length / pageSize)) : 1;
  const startIndex = pageSize ? (currentPage - 1) * pageSize : 0;
  const visibleTransactions = pageSize
    ? transactions.slice(startIndex, startIndex + pageSize)
    : transactions;
  const endIndex = pageSize ? Math.min(startIndex + pageSize, transactions.length) : transactions.length;

  const content = (
    <>
      {showTitle && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white rt-page-title">Transaction History</h2>
          {pageSize && transactions.length > 0 && (
            <div className="text-xs uppercase tracking-[0.16em] text-white/45">
              Showing {startIndex + 1}-{endIndex} of {transactions.length}
            </div>
          )}
        </div>
      )}
      {transactions.length === 0 ? (
        <div className="text-white/50 rounded-xl border border-white/10 bg-white/5 p-4">No transactions yet.</div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {visibleTransactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white/80">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-white/80">{tx.type}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right ${tx.amount > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {formatAmount(tx.amount, tx.currency)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          tx.status === "Completed" ? "bg-emerald-500/20 text-emerald-200" : tx.status === "Pending" ? "bg-amber-500/20 text-amber-100" : "bg-red-500/20 text-red-200"
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

          {pageSize && totalPages > 1 && (
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/65">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:border-white/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div className="rt-panel-strong p-6 rounded-2xl">
      {content}
    </div>
  );
};

export default TransactionHistory;
