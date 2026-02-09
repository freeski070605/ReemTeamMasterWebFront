import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { toast } from 'react-toastify';

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

  const fetchWithdrawals = async () => {
    try {
      const response = await client.get('/wallet/admin/withdrawals');
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to load withdrawal requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleProcess = async (id: string, action: 'approve' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;

    try {
      await client.post(`/wallet/admin/withdrawals/${id}/process`, { action });
      toast.success(`Request ${action}ed successfully.`);
      fetchWithdrawals();
    } catch (error) {
      console.error('Error processing request:', error);
      toast.error('Failed to process request.');
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">Admin Dashboard</h1>

      <div className="bg-black/60 rounded-2xl p-6 border border-white/10 shadow-xl backdrop-blur">
        <h2 className="text-xl font-bold text-white mb-6">Pending Withdrawals</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/60 text-sm">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4">Requested</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-white/50">No pending withdrawals.</td>
                </tr>
              ) : (
                withdrawals.map((req) => (
                  <tr key={req._id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-4 px-4">
                      <div className="font-medium text-white">{req.userId.username}</div>
                      <div className="text-xs text-white/50">{req.userId.email}</div>
                    </td>
                    <td className="py-4 px-4 font-bold text-yellow-300">${req.amount.toFixed(2)}</td>
                    <td className="py-4 px-4 text-white/70">{req.payoutMethod}</td>
                    <td className="py-4 px-4 text-white/70 font-mono text-sm">{req.payoutAddress}</td>
                    <td className="py-4 px-4 text-white/50 text-sm">
                      {new Date(req.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <Button size="sm" variant="danger" onClick={() => handleProcess(req._id, 'reject')}>Reject</Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleProcess(req._id, 'approve')}>Pay & Approve</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Admin;
