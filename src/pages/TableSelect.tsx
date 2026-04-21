import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Shield, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import client from '../api/client';
import { adminApi, AdminTable } from '../api/admin';
import { ANALYTICS_EVENTS } from '../analytics/events';
import { trackEvent } from '../api/analytics';
import { createInvite } from '../api/invites';
import { getLobbyActivationState, LobbyActivationState } from '../api/lobby';
import { createPrivateTable, getMyPrivateTables, ManagedPrivateTable, quickSeat } from '../api/tables';
import { createVipCheckout } from '../api/vip';
import { getStakeDisplay, getTableDisplayName } from '../branding/modeCopy';
import { CribTableCard } from '../components/activation/CribTableCard';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { Modal } from '../components/ui/Modal';
import { useAuthStore } from '../store/authStore';
import { Table } from '../types/game';
import { roleAtLeast } from '../types/roles';
import { buildGamePath } from '../utils/gamePath';

type PrivateTableMode = 'FREE_RTC_TABLE' | 'PRIVATE_USD_TABLE';

const RTC_STAKES = [1, 5, 10, 25, 50];
const USD_STAKES = [5, 10, 20, 50, 100];

const TableSelect: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshVipStatus } = useAuthStore();
  const isAdmin = !!user?.role && roleAtLeast(user.role, 'admin');

  const [tables, setTables] = useState<Table[]>([]);
  const [launchpad, setLaunchpad] = useState<LobbyActivationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quickSeatLoading, setQuickSeatLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [vipLoading, setVipLoading] = useState(false);
  const [privateOpen, setPrivateOpen] = useState(false);
  const [privateMode, setPrivateMode] = useState<PrivateTableMode>('FREE_RTC_TABLE');
  const [privateStake, setPrivateStake] = useState(1);
  const [privateMaxPlayers, setPrivateMaxPlayers] = useState(4);
  const [privateHostNote, setPrivateHostNote] = useState('');
  const [privateLoading, setPrivateLoading] = useState(false);
  const [myPrivateTables, setMyPrivateTables] = useState<ManagedPrivateTable[]>([]);
  const [privateManagerOpen, setPrivateManagerOpen] = useState(false);
  const [privateManagerLoading, setPrivateManagerLoading] = useState(false);
  const [promoTable, setPromoTable] = useState<AdminTable | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const fetchTables = useCallback(async () => {
    try {
      const response = await client.get<Table[]>('/tables');
      setTables(
        [...response.data].sort((a, b) => {
          if (a.stake !== b.stake) return a.stake - b.stake;
          return b.currentPlayerCount - a.currentPlayerCount;
        })
      );
      setError('');
    } catch (err) {
      console.error(err);
      setError('Could not load crib tables right now. Try again.');
    }
  }, []);

  const fetchLaunchpad = useCallback(async () => {
    try {
      setLaunchpad(await getLobbyActivationState());
    } catch (err) {
      console.error(err);
      setLaunchpad(null);
    }
  }, []);

  const fetchPrivateTables = useCallback(async () => {
    if (!user?._id) {
      setMyPrivateTables([]);
      return;
    }
    setPrivateManagerLoading(true);
    try {
      setMyPrivateTables(await getMyPrivateTables());
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not load your private tables.');
    } finally {
      setPrivateManagerLoading(false);
    }
  }, [user?._id]);

  const fetchPromoTable = useCallback(async () => {
    if (!isAdmin) {
      setPromoTable(null);
      return;
    }
    try {
      setPromoTable(await adminApi.getPromoTable());
    } catch {
      setPromoTable(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTables(), fetchLaunchpad(), fetchPromoTable()]);
      setLoading(false);
    };
    void load();
    void trackEvent('lobby_view', { source: 'tables' });
  }, [fetchLaunchpad, fetchPromoTable, fetchTables]);

  useEffect(() => {
    if (user?._id) {
      void fetchPrivateTables();
    }
  }, [fetchPrivateTables, user?._id]);

  const rtcTables = useMemo(() => tables.filter((table) => table.mode !== 'USD_CONTEST'), [tables]);
  const groupedByStake = useMemo(() => {
    const groups = new Map<number, Table[]>();
    rtcTables.forEach((table) => {
      const list = groups.get(table.stake) ?? [];
      list.push(table);
      groups.set(table.stake, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [rtcTables]);

  const recommendedTableId = launchpad?.quickPlay?.table._id ?? null;
  const waitingTables = rtcTables.filter((table) => table.status === 'waiting').length;
  const liveTables = rtcTables.filter((table) => table.status === 'in-game').length;
  const openSeats = rtcTables.reduce((sum, table) => sum + Math.max(0, table.maxPlayers - table.currentPlayerCount), 0);
  const activePrivateStakeOptions = privateMode === 'PRIVATE_USD_TABLE' ? USD_STAKES : RTC_STAKES;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleQuickSeat = async () => {
    const firstTimeUser = !launchpad?.playerState.hasPlayedGame;
    setQuickSeatLoading(true);
    void trackEvent(ANALYTICS_EVENTS.quickPlayClick, { source: 'browse-cribs', firstTimeUser });
    void trackEvent(ANALYTICS_EVENTS.joinTableAttempt, { source: 'browse-cribs-quick-play' });
    try {
      const result = await quickSeat({ beginnerMode: firstTimeUser });
      navigate(buildGamePath(result.tableId, { entry: 'browse-cribs-quick-play', quickPlayReason: result.reason }));
    } catch (err: any) {
      void trackEvent(ANALYTICS_EVENTS.joinTableFail, { source: 'browse-cribs-quick-play', reason: err?.response?.data?.message || 'quick_play_failed' });
      toast.error(err?.response?.data?.message || 'No open seats available right now.');
    } finally {
      setQuickSeatLoading(false);
    }
  };

  const handleEnterTable = (table: Table, source: string) => {
    void trackEvent(ANALYTICS_EVENTS.tableCardClick, { source, tableId: table._id });
    void trackEvent(ANALYTICS_EVENTS.joinTableAttempt, { source, tableId: table._id });
    navigate(buildGamePath(table._id, { entry: source }));
  };

  const handleCreateInvite = async (table: Table) => {
    try {
      const invite = await createInvite({ tableId: table._id });
      const copied = await copyText(invite.inviteUrl);
      setInviteLink(invite.inviteUrl);
      setInviteOpen(true);
      toast.success(copied ? 'Invite link copied.' : 'Invite link ready.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create invite.');
    }
  };

  const handlePrivateEntry = useCallback(async () => {
    if (!user?.isVip) {
      await refreshVipStatus(true);
      if (!useAuthStore.getState().user?.isVip) {
        setVipOpen(true);
        return;
      }
    }
    setPrivateOpen(true);
  }, [refreshVipStatus, user?.isVip]);

  useEffect(() => {
    const panel = searchParams.get('panel');
    if (!panel) return;
    if (panel === 'private') {
      void handlePrivateEntry();
    }
    if (panel === 'manage-private') {
      setPrivateManagerOpen(true);
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('panel');
      return next;
    }, { replace: true });
  }, [handlePrivateEntry, searchParams, setSearchParams]);

  const handleCreatePrivate = async () => {
    setPrivateLoading(true);
    try {
      const result = await createPrivateTable({ mode: privateMode, stake: privateStake, maxPlayers: privateMaxPlayers, hostNote: privateHostNote.trim() || undefined });
      const copied = await copyText(result.inviteUrl);
      setInviteLink(result.inviteUrl);
      setInviteOpen(true);
      toast.success(copied ? 'Private table created. Invite copied.' : 'Private table created.');
      setPrivateOpen(false);
      navigate(buildGamePath(result.table._id, { inviteCode: result.inviteCode, entry: 'private-table-host' }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create private table.');
    } finally {
      setPrivateLoading(false);
    }
  };

  const handleVipCheckout = async () => {
    setVipLoading(true);
    try {
      const checkoutUrl = await createVipCheckout();
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not start VIP checkout.');
    } finally {
      setVipLoading(false);
    }
  };

  const handleOpenPromoTable = async () => {
    setPromoLoading(true);
    try {
      const table = await adminApi.ensurePromoTable(false);
      setPromoTable(table);
      navigate(buildGamePath(table.tableId, { entry: 'admin-promo' }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not open the promo table.');
    } finally {
      setPromoLoading(false);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader /></div>;
  if (error) return <div className="rt-panel-strong rounded-2xl p-8 text-center text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <section className="landing-hero rt-panel-strong relative overflow-hidden rounded-[32px] border border-white/12 p-6 md:p-8">
        <div className="landing-hero__mesh pointer-events-none absolute inset-0 opacity-90" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70">Browse Cribs</div>
            <h1 className="mt-5 text-4xl leading-[0.98] rt-page-title sm:text-5xl">Play first. Browse second.</h1>
            <p className="mt-4 max-w-2xl text-base text-white/76 sm:text-lg">Quick Play stays on top. The full room list is here when you want to pick the exact seat and stakes yourself.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={handleQuickSeat} isLoading={quickSeatLoading}><Sparkles className="mr-2 h-4 w-4" />Pull Up to a Crib</Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/how-to-play')}>How to Play</Button>
              <Button size="lg" variant="ghost" onClick={handlePrivateEntry}>Invite Friends</Button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="landing-stat-card rounded-2xl p-4"><div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Open Seats</div><div className="mt-2 text-3xl rt-page-title text-white">{openSeats}</div></div>
              <div className="landing-stat-card rounded-2xl p-4"><div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Waiting</div><div className="mt-2 text-3xl rt-page-title text-white">{waitingTables}</div></div>
              <div className="landing-stat-card rounded-2xl p-4"><div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Hand Live</div><div className="mt-2 text-3xl rt-page-title text-white">{liveTables}</div></div>
            </div>
          </div>
          <aside className="landing-spotlight rounded-[28px] p-5 md:p-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">Recommended Seat</div>
            <div className="mt-2 text-2xl rt-page-title text-white">{launchpad?.quickPlay ? getTableDisplayName(launchpad.quickPlay.table) : 'Browse manually'}</div>
            <p className="mt-3 text-sm text-white/68">{launchpad?.quickPlay ? 'This crib is the best next entry based on speed, friction, and open seats.' : 'Quick Play could not find an instant seat. Use the crib list below.'}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {launchpad?.quickPlay ? <Button onClick={() => handleEnterTable(launchpad.quickPlay!.table, 'browse-recommended')}>Enter Recommended Crib</Button> : null}
              <Button variant="secondary" onClick={() => { void fetchTables(); void fetchLaunchpad(); }}>Refresh Lobby</Button>
            </div>
          </aside>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Live Cribs</div><h2 className="mt-2 text-3xl rt-page-title">Pick your seat.</h2></div>
          <Link to="/contests"><Button variant="ghost">Open Cash Crown</Button></Link>
        </div>
        {groupedByStake.map(([stake, stakeTables]) => (
          <div key={stake} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">{getStakeDisplay(stake, 'FREE_RTC_TABLE').amount}</div>
              <div className="text-sm text-white/58">{stakeTables.length} crib{stakeTables.length === 1 ? '' : 's'} live at this stake.</div>
            </div>
            <div className="grid gap-4 xl:grid-cols-3 md:grid-cols-2">
              {stakeTables.map((table) => (
                <CribTableCard
                  key={table._id}
                  table={table}
                  emphasized={table._id === recommendedTableId}
                  beginnerFriendly={table.stake <= 5}
                  highlightLabel={table._id === recommendedTableId ? 'Recommended' : undefined}
                  onEnter={(nextTable) => handleEnterTable(nextTable, 'browse-table-card')}
                  onInvite={handleCreateInvite}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50"><Lock className="h-4 w-4" />Private Rooms</div>
          <h2 className="mt-3 text-3xl rt-page-title">Advanced options stay secondary.</h2>
          <p className="mt-2 text-sm text-white/68">Hosted invite-only tables are still here, but they no longer compete with the main play action.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={handlePrivateEntry}>Create Private Crib</Button>
            <Button variant="secondary" onClick={() => setPrivateManagerOpen(true)}>Manage Private Tables</Button>
          </div>
        </article>
        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50"><Shield className="h-4 w-4" />Secondary Destinations</div>
          <h2 className="mt-3 text-3xl rt-page-title">Everything else lives elsewhere.</h2>
          <p className="mt-2 text-sm text-white/68">Wallet, profile, rules, and admin stay available without crowding the path into gameplay.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/account"><Button variant="secondary">Open Account</Button></Link>
            {isAdmin ? <Button onClick={handleOpenPromoTable} isLoading={promoLoading}>{promoTable ? 'Open Promo Table' : 'Create Promo Table'}</Button> : null}
          </div>
        </article>
      </section>

      <Modal isOpen={privateOpen} onClose={() => setPrivateOpen(false)} onConfirm={handleCreatePrivate} title="Create Private Table" confirmLabel={privateLoading ? 'Creating...' : 'Create Table'}>
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {(['FREE_RTC_TABLE', 'PRIVATE_USD_TABLE'] as PrivateTableMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => setPrivateMode(mode)} className={`rounded-2xl border px-4 py-3 text-left ${privateMode === mode ? 'border-amber-300/55 bg-amber-300/10 text-white' : 'border-white/12 bg-white/[0.03] text-white/78'}`}>
                <div className="text-sm font-semibold">{mode === 'PRIVATE_USD_TABLE' ? 'USD Private Table' : 'RTC Private Table'}</div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {activePrivateStakeOptions.map((stake) => (
              <button key={`${privateMode}-${stake}`} type="button" onClick={() => setPrivateStake(stake)} className={`rounded-full border px-4 py-2 text-sm ${privateStake === stake ? 'border-amber-300/55 bg-amber-300/12 text-amber-100' : 'border-white/15 bg-white/[0.04] text-white/75'}`}>
                {getStakeDisplay(stake, privateMode).amount}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[2, 3, 4].map((seatCount) => (
              <button key={seatCount} type="button" onClick={() => setPrivateMaxPlayers(seatCount)} className={`rounded-full border px-4 py-2 text-sm ${privateMaxPlayers === seatCount ? 'border-amber-300/55 bg-amber-300/12 text-amber-100' : 'border-white/15 bg-white/[0.04] text-white/75'}`}>
                {seatCount} Players
              </button>
            ))}
          </div>
          <textarea value={privateHostNote} onChange={(event) => setPrivateHostNote(event.target.value.slice(0, 160))} rows={3} placeholder="Host note (optional)" className="w-full rounded-2xl border border-white/14 bg-black/35 px-3 py-3 text-sm text-white placeholder:text-white/40" />
        </div>
      </Modal>

      <Modal isOpen={privateManagerOpen} onClose={() => setPrivateManagerOpen(false)} onConfirm={() => setPrivateManagerOpen(false)} title="Manage Private Tables" confirmLabel="Done">
        <div className="space-y-3">
          {privateManagerLoading ? <p className="text-sm text-white/60">Loading your private tables...</p> : null}
          {!privateManagerLoading && myPrivateTables.length === 0 ? <div className="rounded-2xl border border-dashed border-white/12 bg-black/15 p-4 text-sm text-white/60">You haven&apos;t created any private tables yet.</div> : null}
          {myPrivateTables.map((table) => (
            <article key={table._id} className="rounded-2xl border border-white/12 bg-black/20 p-4">
              <div className="text-base font-semibold text-white">{table.name || 'Private Table'}</div>
              <div className="mt-1 text-xs text-white/55">{getStakeDisplay(table.stake, table.mode).amount} | {table.currentPlayerCount}/{table.maxPlayers} seats</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(buildGamePath(table._id, { entry: 'managed-private-table' }))}>Open Table</Button>
                <Button size="sm" variant="secondary" onClick={() => void handleCreateInvite(table as Table)}>Copy Invite</Button>
              </div>
            </article>
          ))}
        </div>
      </Modal>

      <Modal isOpen={vipOpen} onClose={() => setVipOpen(false)} onConfirm={handleVipCheckout} title="VIP Subscription Required" confirmLabel={vipLoading ? 'Starting VIP...' : 'Start VIP'}>
        <div className="space-y-3"><p>Private tables are reserved for VIP members.</p><p className="text-sm text-white/70">$4.99/mo. Cancel anytime.</p></div>
      </Modal>

      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} onConfirm={() => { if (inviteLink) void copyText(inviteLink); }} title="Invite Link Ready" confirmLabel="Copy Link">
        <div className="space-y-4">
          <input readOnly value={inviteLink} className="h-11 w-full rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white" />
          <p className="text-xs text-white/55">The link opens the invite page first, then takes the player into the table.</p>
        </div>
      </Modal>
    </div>
  );
};

export default TableSelect;
