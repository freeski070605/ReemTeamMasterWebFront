import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import client from '../api/client';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';

interface WithdrawalRequest {
  _id: string;
  userId: { username: string; email: string };
  amount: number;
  payoutMethod: string;
  payoutAddress: string;
  status: string;
  requestedAt: string;
}

const Admin: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchWithdrawals = async () => {
    try {
      const response = await client.get('/wallet/admin/withdrawals');
      setWithdrawals(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to load withdrawal requests.');
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWithdrawals();
  }, []);

  const handleProcess = async (id: string, action: 'approve' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;

    try {
      setProcessingId(id);
      await client.post(`/wallet/admin/withdrawals/${id}/process`, { action });
      toast.success(`Request ${action}ed successfully.`);
      await fetchWithdrawals();
    } catch (error) {
      console.error('Error processing request:', error);
      toast.error('Failed to process request.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <Loader />;

  const pendingCount = withdrawals.filter((item) => item.status?.toLowerCase() === 'pending').length;
  const totalAmount = withdrawals.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <header className="rt-panel-strong rounded-3xl p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">Admin Console</div>
        <h1 className="mt-2 text-4xl rt-page-title font-semibold">Withdrawal Operations</h1>
        <p className="mt-2 text-white/65">Review payout requests and approve or reject safely.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Requests</div>
          <div className="mt-2 text-3xl rt-page-title">{withdrawals.length}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Pending</div>
          <div className="mt-2 text-3xl rt-page-title">{pendingCount}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Requested Value</div>
          <div className="mt-2 text-3xl rt-page-title">${totalAmount.toFixed(2)}</div>
        </div>
      </section>

      <section className="rt-panel-strong rounded-2xl p-4 sm:p-6">
        <h2 className="text-2xl rt-page-title mb-4">Pending Withdrawals</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-white/60 text-xs uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4">Requested</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-white/55">
                    No pending withdrawals.
                  </td>
                </tr>
              ) : (
                withdrawals.map((req) => {
                  const processing = processingId === req._id;
                  return (
                    <tr key={req._id} className="hover:bg-white/[0.03]">
                      <td className="py-4 px-4">
                        <div className="font-medium text-white">{req.userId.username}</div>
                        <div className="text-xs text-white/50">{req.userId.email}</div>
                      </td>
                      <td className="py-4 px-4 font-semibold text-amber-200">${req.amount.toFixed(2)}</td>
                      <td className="py-4 px-4 text-white/75">{req.payoutMethod}</td>
                      <td className="py-4 px-4 text-white/75 font-mono text-xs">{req.payoutAddress}</td>
                      <td className="py-4 px-4 text-white/55 text-sm">
                        {new Date(req.requestedAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={processing}
                            onClick={() => void handleProcess(req._id, 'reject')}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={processing}
                            onClick={() => void handleProcess(req._id, 'approve')}
                          >
                            Approve
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Admin;
