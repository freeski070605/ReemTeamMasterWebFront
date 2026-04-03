import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { acceptInvite, resolveInvite, InviteResolveResponse } from '../api/invites';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { trackEvent } from '../api/analytics';
import { getModeLabel, getStakeDisplay } from '../branding/modeCopy';
import { useAuthStore } from '../store/authStore';

const Invite: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const [invite, setInvite] = useState<InviteResolveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const inviteTable = invite?.table ?? null;
  const stakeDisplay = useMemo(() => {
    if (!inviteTable) {
      return null;
    }
    return getStakeDisplay(inviteTable.stake, inviteTable.mode as any);
  }, [inviteTable]);
  const roomStatusLabel = inviteTable?.status === 'in-game' ? 'Hand Live' : 'Waiting For Players';

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
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }
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
    <div className="rt-panel-strong rounded-3xl p-8 space-y-6">
      <div className="text-xs uppercase tracking-[0.2em] text-white/55">Invite Ready</div>
      <div className="space-y-2">
        <h1 className="text-3xl rt-page-title">
          {inviteTable?.isPrivate ? 'Join Private Table' : 'Join Table'}
        </h1>
        <p className="max-w-2xl text-white/70">
          {inviteTable?.isPrivate
            ? `Hosted by ${inviteTable.hostName}. Review the room details below and join when you're ready.`
            : "You're one tap away from a live Reem Team table."}
        </p>
      </div>

      {inviteTable && stakeDisplay && (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Room Details</div>
            <div className="mt-3 text-2xl rt-page-title text-white">{inviteTable.name}</div>
            <div className="mt-2 text-sm text-white/70">{getModeLabel(inviteTable.mode as any)}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Stake</div>
                <div className="mt-1 text-lg rt-page-title text-white">
                  {stakeDisplay.amount} <span className="text-sm text-white/60">{stakeDisplay.unit}</span>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Seats</div>
                <div className="mt-1 text-lg rt-page-title text-white">
                  {inviteTable.currentPlayerCount}/{inviteTable.maxPlayers}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Host</div>
                <div className="mt-1 text-sm text-white/88">{inviteTable.hostName}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Status</div>
                <div className="mt-1 text-sm text-white/88">{roomStatusLabel}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">What To Expect</div>
            <div className="mt-3 space-y-3 text-sm text-white/72">
              <div>{inviteTable.isPrivate ? 'Invite-only VIP table' : 'Table invite link is ready'}</div>
              <div>{inviteTable.mode === 'PRIVATE_USD_TABLE' ? 'Players need enough USD balance to sit.' : 'Players need enough RTC balance to sit.'}</div>
              <div>{inviteTable.isPrivate ? 'Private tables are human-only and do not auto-fill with AI.' : 'This link takes you straight to the room.'}</div>
              {inviteTable.hostNote && (
                <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-amber-100/90">
                  Host note: {inviteTable.hostNote}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleAccept} disabled={accepting}>
          {accepting ? 'Joining...' : isAuthenticated ? 'Join Table' : 'Sign In To Join'}
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
