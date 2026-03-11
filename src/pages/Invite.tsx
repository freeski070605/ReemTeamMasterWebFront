import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { acceptInvite, resolveInvite, InviteResolveResponse } from '../api/invites';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { trackEvent } from '../api/analytics';

const Invite: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteResolveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    resolveInvite(code)
      .then((data) => {
        setInvite(data);
        setError('');
        trackEvent('invite_opened', { code });
      })
      .catch((err: any) => {
        setInvite(null);
        setError(err?.response?.data?.message || 'Invite not found.');
      })
      .finally(() => setLoading(false));
  }, [code]);

  const handleAccept = async () => {
    if (!code) return;
    setAccepting(true);
    try {
      const accept = await acceptInvite(code);
      trackEvent('invite_accepted', { code });
      const tableId = accept.tableId || invite?.tableId;
      if (tableId) {
        navigate(`/game/${tableId}?inviteCode=${encodeURIComponent(code)}`);
      } else {
        navigate('/tables');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invite could not be accepted.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rt-panel-strong rounded-2xl p-8 text-center text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="rt-panel-strong rounded-3xl p-8 text-center space-y-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/55">Invite Ready</div>
      <h1 className="text-3xl rt-page-title">Join the Table</h1>
      <p className="text-white/70">
        You&apos;re one tap away from a live Reem Team table.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={handleAccept} disabled={accepting}>
          {accepting ? 'Joining...' : 'Join Now'}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/tables')}>
          Back to Lobby
        </Button>
      </div>
      {invite?.expiresAt && (
        <div className="text-xs text-white/50">
          Expires {new Date(invite.expiresAt).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default Invite;
