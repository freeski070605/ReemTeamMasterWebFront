import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Shield, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import client from '../api/client';
import { Table } from '../types/game';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { Modal } from '../components/ui/Modal';
import { SOCKET_URL } from '../api/socket';
import { useAuthStore } from '../store/authStore';
import { trackEvent } from '../api/analytics';
import { getLobbySummary } from '../api/lobby';
import { quickSeat, createPrivateTable } from '../api/tables';
import { createInvite } from '../api/invites';
import { getRecentPlayers, RecentPlayer } from '../api/users';
import PlayerAvatar from '../components/game/PlayerAvatar';
import { Input } from '../components/ui/Input';
import { createVipCheckout } from '../api/vip';
import { adminApi, AdminTable } from '../api/admin';
import { roleAtLeast } from '../types/roles';
import {
  getModeBadge,
  getModeDescription,
  getStakeDisplay,
  getStakeTierHeading,
  getTableDisplayName,
} from '../branding/modeCopy';

const TableSelect: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [lobbyPresence, setLobbyPresence] = useState({ onlinePlayers: 0, lobbyConnections: 0 });
  const [lobbyFeed, setLobbyFeed] = useState<Array<{ message: string; timestamp: number }>>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [quickSeatLoading, setQuickSeatLoading] = useState(false);
  const [privateModalOpen, setPrivateModalOpen] = useState(false);
  const [privateStake, setPrivateStake] = useState<number>(1);
  const [privateMaxPlayers, setPrivateMaxPlayers] = useState<number>(4);
  const [privateCreating, setPrivateCreating] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [vipCheckoutLoading, setVipCheckoutLoading] = useState(false);
  const [recentPlayers, setRecentPlayers] = useState<RecentPlayer[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'cribs' | 'promo'>('cribs');
  const [promoTable, setPromoTable] = useState<AdminTable | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoLaunching, setPromoLaunching] = useState(false);
  const navigate = useNavigate();
  const { user, refreshVipStatus } = useAuthStore();
  const isVip = !!user?.isVip;
  const isAdmin = !!user?.role && roleAtLeast(user.role, 'admin');

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await client.get<Table[]>('/tables');
      const sortedTables = [...response.data].sort((a, b) => {
        if (a.stake !== b.stake) return a.stake - b.stake;
        if (a.mode === 'USD_CONTEST' && b.mode !== 'USD_CONTEST') return 1;
        if (a.mode !== 'USD_CONTEST' && b.mode === 'USD_CONTEST') return -1;
        return a._id.localeCompare(b._id);
      });
      setTables(sortedTables);
      setError('');
      trackEvent('table_list_impression', { count: sortedTables.length });
    } catch (err) {
      setError('Could not load crib tables right now. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const summary = await getLobbySummary();
      setLobbyPresence((prev) => ({
        ...prev,
        onlinePlayers: summary.onlinePlayers ?? prev.onlinePlayers,
      }));
    } catch (err) {
      console.error('Failed to load lobby summary', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleQuickSeat = async () => {
    setQuickSeatLoading(true);
    try {
      const table = await quickSeat();
      trackEvent('quick_seat_clicked', { tableId: table._id });
      navigate(`/game/${table._id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No open seats available right now.');
    } finally {
      setQuickSeatLoading(false);
    }
  };

  const handleCreateInvite = async (table: Table) => {
    try {
      const invite = await createInvite({ tableId: table._id });
      const inviteUrl = `${window.location.origin}/invite/${invite.code}`;
      const copied = await copyToClipboard(inviteUrl);
      trackEvent('invite_created', { tableId: table._id });
      toast.success(copied ? 'Invite link copied.' : 'Invite created.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create invite.');
    }
  };

  const handleCreatePrivate = async () => {
    if (!Number.isFinite(privateStake) || privateStake <= 0) {
      toast.error('Select a valid stake for the private table.');
      return;
    }
    setPrivateCreating(true);
    try {
      const result = await createPrivateTable({ stake: privateStake, maxPlayers: privateMaxPlayers });
      const inviteUrl = `${window.location.origin}/invite/${result.inviteCode}`;
      const copied = await copyToClipboard(inviteUrl);
      trackEvent('private_table_created', { tableId: result.table._id });
      toast.success(copied ? 'Private table created. Invite link copied.' : 'Private table created.');
      setPrivateModalOpen(false);
      navigate(`/game/${result.table._id}?inviteCode=${encodeURIComponent(result.inviteCode)}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create private table.');
    } finally {
      setPrivateCreating(false);
    }
  };

  const handleVipCheckout = async () => {
    if (isVip) {
      toast.info('VIP is already active on your account.');
      setVipModalOpen(false);
      return;
    }
    setVipCheckoutLoading(true);
    try {
      const checkoutUrl = await createVipCheckout();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      toast.error('Failed to start VIP checkout.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not start VIP checkout.');
    } finally {
      setVipCheckoutLoading(false);
    }
  };

  const handlePrivateEntry = async () => {
    if (!user?.isVip) {
      await refreshVipStatus(true);
      const latestVip = useAuthStore.getState().user?.isVip;
      if (!latestVip) {
        setVipModalOpen(true);
        return;
      }
    }
    setPrivateModalOpen(true);
  };

  const handleRejoinLast = () => {
    const lastTableId = localStorage.getItem('last_table_id');
    if (!lastTableId) {
      return;
    }
    const lastInviteCode = localStorage.getItem('last_table_invite_code');
    const query = lastInviteCode ? `?inviteCode=${encodeURIComponent(lastInviteCode)}` : '';
    navigate(`/game/${lastTableId}${query}`);
  };

  const loadPromoTable = useCallback(async () => {
    if (!isAdmin) {
      setPromoTable(null);
      return;
    }

    setPromoLoading(true);
    try {
      const table = await adminApi.getPromoTable();
      setPromoTable(table);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not load the promo table.');
    } finally {
      setPromoLoading(false);
    }
  }, [isAdmin]);

  const handleOpenPromoTable = async (reset: boolean = false) => {
    setPromoLaunching(true);
    try {
      const table = await adminApi.ensurePromoTable(reset);
      setPromoTable(table);
      navigate(`/game/${table.tableId}?spectator=1&promo=1`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not open the promo table.');
    } finally {
      setPromoLaunching(false);
    }
  };

  useEffect(() => {
    trackEvent('lobby_view', { source: 'tables' });
    void fetchTables();
    void fetchSummary();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadPromoTable();
      return;
    }
    setActiveView('cribs');
    setPromoTable(null);
  }, [isAdmin, loadPromoTable]);

  useEffect(() => {
    if (!user?._id) {
      return;
    }

    setRecentLoading(true);
    setRecentError(null);
    getRecentPlayers(10)
      .then(setRecentPlayers)
      .catch((error: any) => {
        setRecentError(error?.response?.data?.message || 'Could not load recent players.');
        setRecentPlayers([]);
      })
      .finally(() => setRecentLoading(false));
  }, [user?._id]);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.emit('joinLobby', { userId: user?._id, username: user?.username });

    socket.on('lobbyPresence', (payload: { onlinePlayers?: number; lobbyConnections?: number }) => {
      setLobbyPresence((prev) => ({
        onlinePlayers: payload.onlinePlayers ?? prev.onlinePlayers,
        lobbyConnections: payload.lobbyConnections ?? prev.lobbyConnections,
      }));
    });

    socket.on('lobbyEvent', (payload: { message: string; timestamp: number }) => {
      setLobbyFeed((prev) => [payload, ...prev].slice(0, 8));
    });

    const heartbeat = setInterval(() => {
      socket.emit('presenceHeartbeat', { userId: user?._id });
    }, 20000);

    return () => {
      clearInterval(heartbeat);
      socket.emit('leaveLobby');
      socket.disconnect();
    };
  }, [user?._id, user?.username]);

  const rtcTables = useMemo(
    () => tables.filter((table) => table.mode !== 'USD_CONTEST'),
    [tables]
  );

  const cashCrownTables = useMemo(
    () => tables.filter((table) => table.mode === 'USD_CONTEST'),
    [tables]
  );

  const groupedByStake = useMemo(() => {
    const byStake = new Map<number, Table[]>();
    for (const table of rtcTables) {
      const list = byStake.get(table.stake) ?? [];
      list.push(table);
      byStake.set(table.stake, list);
    }
    return Array.from(byStake.entries()).sort(([a], [b]) => a - b);
  }, [rtcTables]);

  useEffect(() => {
    if (rtcTables.length === 0) {
      return;
    }
    const stakes = Array.from(new Set(rtcTables.map((table) => table.stake))).sort((a, b) => a - b);
    if (!stakes.includes(privateStake)) {
      setPrivateStake(stakes[0]);
    }
  }, [rtcTables, privateStake]);

  const metrics = useMemo(() => {
    const active = rtcTables.filter((table) => table.status === 'in-game').length;
    const usd = cashCrownTables.length;
    const rtc = rtcTables.length;
    return { active, usd, rtc };
  }, [cashCrownTables.length, rtcTables]);

  const openSeats = useMemo(() => {
    return tables.reduce((sum, table) => sum + Math.max(0, table.maxPlayers - table.currentPlayerCount), 0);
  }, [tables]);

  const handleJoinClick = (table: Table) => {
    if (table.mode === 'USD_CONTEST') {
      navigate(`/contests?stake=${encodeURIComponent(String(table.stake))}`);
      return;
    }

    setSelectedTable(table);
    setIsModalOpen(true);
  };

  const handleConfirmJoin = () => {
    if (!selectedTable) return;
    trackEvent('table_join_clicked', { tableId: selectedTable._id });
    navigate(`/game/${selectedTable._id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return <div className="rt-panel-strong rounded-2xl p-8 text-center text-red-300">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <section className="rt-glass rounded-2xl p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-left transition ${
                activeView === 'cribs'
                  ? 'bg-white/12 text-white'
                  : 'bg-transparent text-white/65 hover:bg-white/5 hover:text-white'
              }`}
              onClick={() => setActiveView('cribs')}
            >
              <div className="text-xs uppercase tracking-[0.18em] text-white/45">Standard</div>
              <div className="mt-1 text-lg rt-page-title">Cribs</div>
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-3 text-left transition ${
                activeView === 'promo'
                  ? 'bg-amber-300/12 text-white ring-1 ring-amber-300/30'
                  : 'bg-transparent text-white/65 hover:bg-white/5 hover:text-white'
              }`}
              onClick={() => setActiveView('promo')}
            >
              <div className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Admin Only</div>
              <div className="mt-1 flex items-center gap-2 text-lg rt-page-title">
                <Shield className="h-4 w-4 text-amber-300" />
                Promo Table
              </div>
            </button>
          </div>
        </section>
      )}

      {activeView === 'promo' ? (
        <section className="space-y-5">
          <header className="rt-panel-strong rounded-3xl p-7">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Admin Promo Capture</div>
            <h1 className="mt-2 text-4xl rt-page-title font-semibold">AI Content Table</h1>
            <p className="mt-2 max-w-3xl text-white/65">
              This hidden table is reserved for capture sessions. It runs 4 AI players and opens in spectator mode so
              you can record gameplay footage for RGE without occupying a seat.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => void handleOpenPromoTable(false)} disabled={promoLaunching}>
                {promoLaunching ? 'Opening Promo Table...' : promoTable ? 'Open Promo Table' : 'Create Promo Table'}
              </Button>
              <Button variant="secondary" onClick={() => void handleOpenPromoTable(true)} disabled={promoLaunching}>
                Start Fresh AI Match
              </Button>
              <Button variant="secondary" onClick={() => void loadPromoTable()} disabled={promoLoading}>
                {promoLoading ? 'Refreshing...' : 'Refresh Status'}
              </Button>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">Promo Status</div>
              <div className="mt-2 text-3xl rt-page-title">
                {promoLoading ? '--' : promoTable?.status === 'in-game' ? 'Live' : promoTable ? 'Ready' : 'Missing'}
              </div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">AI Seats</div>
              <div className="mt-2 text-3xl rt-page-title">{promoTable?.currentPlayerCount ?? 0}/4</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">Stake</div>
              <div className="mt-2 text-3xl rt-page-title">{promoTable ? `${promoTable.stake} RTC` : '--'}</div>
            </div>
          </section>

          <section className="rt-panel-strong rounded-2xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Current Room</div>
                <h2 className="mt-2 text-2xl rt-page-title">
                  {promoTable?.name || 'Promo Content Table'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-white/65">
                  Open the room to boot or rejoin the AI match. The spectator viewer stays out of gameplay while the bots keep cycling rounds.
                </p>
              </div>
              {promoTable && (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                  Table ID: {promoTable.tableId}
                </div>
              )}
            </div>

            {promoTable ? (
              <>
                <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/50">AI Lineup</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {promoTable.playersSeated.map((player) => (
                        <div key={player.userId} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-sm font-semibold text-white">{player.username}</div>
                          <div className="mt-1 text-xs text-white/55">{player.isAI ? 'AI seat' : 'Human seat'}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/50">Live State</div>
                    <div className="mt-4 space-y-2 text-sm text-white/70">
                      <div>Mode: {promoTable.mode}</div>
                      <div>Turn: {promoTable.turnState?.turn ?? '--'}</div>
                      <div>Current actor: {promoTable.turnState?.currentPlayerUsername || '--'}</div>
                      <div>
                        Time remaining:{' '}
                        {typeof promoTable.turnState?.turnTimeRemainingMs === 'number'
                          ? `${Math.ceil(promoTable.turnState.turnTimeRemainingMs / 1000)}s`
                          : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-black/15 p-6 text-sm text-white/60">
                No promo table has been provisioned yet. Use Create Promo Table to generate the hidden AI capture room.
              </div>
            )}
          </section>
        </section>
      ) : (
        <>
      <header className="rt-panel-strong rounded-3xl p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">Crib Lobby (Recommended Start)</div>
        <h1 className="mt-2 text-4xl rt-page-title font-semibold">Play Reem Team Cash Cribs</h1>
        <p className="mt-2 text-white/65">
          Cribs run on Reem Team Cash and are the main experience right now. Cash Crowns are real-cash tournaments
          and open through the Cash Crown Tournament Lobby.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => void fetchTables()}>Reload Cribs</Button>
          <Button onClick={handleQuickSeat} disabled={quickSeatLoading}>
            {quickSeatLoading ? 'Finding Seat...' : 'Quick Seat'}
          </Button>
          <Button variant="secondary" onClick={handlePrivateEntry}>
            {isVip ? 'Create Private Table' : 'Create Private Table (VIP)'}
          </Button>
          {localStorage.getItem('last_table_id') && (
            <Button variant="secondary" onClick={handleRejoinLast}>
              Rejoin Last Table
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/contests')}>
            View Cash Crown Tournaments
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Players Online</div>
          <div className="mt-2 text-3xl rt-page-title">
            {summaryLoading ? '--' : lobbyPresence.onlinePlayers}
          </div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Open Seats</div>
          <div className="mt-2 text-3xl rt-page-title">{openSeats}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Live Cribs</div>
          <div className="mt-2 text-3xl rt-page-title">{metrics.rtc}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Hands Live</div>
          <div className="mt-2 text-3xl rt-page-title">{metrics.active}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Cash Crown Tournaments Live</div>
          <div className="mt-2 text-3xl rt-page-title">{metrics.usd}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rt-panel-strong rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Recent Players</div>
          {recentLoading && <div className="mt-3 text-sm text-white/60">Loading recent players...</div>}
          {!recentLoading && recentError && (
            <div className="mt-3 text-sm text-red-300">{recentError}</div>
          )}
          {!recentLoading && !recentError && recentPlayers.length === 0 && (
            <div className="mt-3 text-sm text-white/60">Play a few hands to see recent players.</div>
          )}
          {!recentLoading && recentPlayers.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4">
              {recentPlayers.map((player) => (
                <div key={player._id} className="flex flex-col items-center gap-2">
                  <PlayerAvatar
                    player={{ name: player.recentUsername, avatarUrl: player.recentAvatarUrl ?? undefined }}
                    size="sm"
                    showName
                  />
                  <div className="text-[11px] text-white/60">
                    Last played {new Date(player.lastPlayedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rt-panel-strong rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Lobby Pulse</div>
          {lobbyFeed.length === 0 && (
            <div className="mt-3 text-sm text-white/60">Lobby updates will appear here.</div>
          )}
          <div className="mt-4 space-y-2">
            {lobbyFeed.map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/75">
                <div>{entry.message}</div>
                <div className="text-[11px] text-white/45">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-8">
        {groupedByStake.map(([stake, stakeTables]) => (
          <div key={stake}>
            <div className="flex items-center gap-3 mb-4">
              <Coins className="w-5 h-5 text-amber-300" />
              <h2 className="text-2xl rt-page-title">{getStakeTierHeading(stake, 'FREE_RTC_TABLE')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {stakeTables.map((table) => {
                const isDisabled = table.currentPlayerCount >= table.maxPlayers;
                const tableName = getTableDisplayName(table);
                const stakeDisplay = getStakeDisplay(table.stake, table.mode);

                return (
                  <article key={table._id} className="rt-panel-strong rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl rt-page-title">{tableName}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          table.status === 'in-game'
                            ? 'bg-amber-500/20 text-amber-100'
                            : 'bg-emerald-500/20 text-emerald-200'
                        }`}
                      >
                        {table.status === 'in-game' ? 'Hand Live' : 'Waiting'}
                      </span>
                    </div>

                    <div className="mt-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                      {getModeBadge(table.mode)}
                    </div>

                    <div className="mt-4 flex items-baseline text-amber-300">
                      <Coins className="w-5 h-5 mr-1" />
                      <span className="text-3xl rt-page-title">{stakeDisplay.amount}</span>
                      <span className="ml-2 text-sm text-white/60">{stakeDisplay.unit}</span>
                    </div>

                    <div className="mt-2 text-sm text-white/60">{getModeDescription(table.mode)}</div>

                    <div className="mt-4 flex items-center text-white/65 text-sm">
                      <Users className="w-4 h-4 mr-2" />
                      {table.currentPlayerCount}/{table.maxPlayers} seats
                    </div>

                    <Button
                      className="mt-5 w-full"
                      disabled={isDisabled}
                      variant={isDisabled ? 'secondary' : 'primary'}
                      onClick={() => handleJoinClick(table)}
                    >
                      {table.currentPlayerCount >= table.maxPlayers ? 'Crib Full' : 'Enter Crib'}
                    </Button>
                    <Button
                      className="mt-2 w-full"
                      variant="secondary"
                      onClick={() => handleCreateInvite(table)}
                    >
                      Invite Friends
                    </Button>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {rtcTables.length === 0 && !loading && (
        <div className="rt-panel-strong rounded-2xl p-8 text-center text-white/55">
          No cribs are live right now.
        </div>
      )}

      {selectedTable && selectedTable.mode !== 'USD_CONTEST' && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmJoin}
          title={`Pull up to ${getTableDisplayName(selectedTable)}?`}
        >
          <p>Start a Reem Team Cash crib at {getStakeTierHeading(selectedTable.stake, selectedTable.mode)}.</p>
        </Modal>
      )}

      <Modal
        isOpen={privateModalOpen}
        onClose={() => setPrivateModalOpen(false)}
        onConfirm={handleCreatePrivate}
        title="Create Private Table"
      >
        <div className="space-y-4">
          <Input
            label="Stake Tier"
            type="number"
            min={1}
            value={privateStake}
            onChange={(event) => setPrivateStake(Number(event.target.value))}
          />
          <Input
            label="Max Players (2-4)"
            type="number"
            min={2}
            max={4}
            value={privateMaxPlayers}
            onChange={(event) => setPrivateMaxPlayers(Number(event.target.value))}
          />
          <p className="text-xs text-white/60">
            We&apos;ll copy the invite link and seat you instantly.
          </p>
          {privateCreating && <p className="text-xs text-white/70">Creating private table...</p>}
        </div>
      </Modal>

      <Modal
        isOpen={vipModalOpen}
        onClose={() => setVipModalOpen(false)}
        onConfirm={handleVipCheckout}
        title="VIP Subscription Required"
      >
        <div className="space-y-3">
          <p>Private tables are reserved for VIP members.</p>
          <ul className="list-disc pl-5 text-sm text-white/70 space-y-1">
            <li>Launch private cribs with custom stakes</li>
            <li>Private invite links for your table</li>
            <li>Priority seat access when you host</li>
          </ul>
          <p className="text-sm text-white/70">$4.99/mo. Cancel anytime.</p>
          {vipCheckoutLoading && <p className="text-xs text-white/70">Starting VIP checkout...</p>}
        </div>
      </Modal>
        </>
      )}
    </div>
  );
};

export default TableSelect;
