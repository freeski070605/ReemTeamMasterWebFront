import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Coins, Crown, Flame, Shield, Sparkles, Trophy, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import client from '../api/client';
import { getHomeOverview, HomeOverview } from '../api/home';
import { Table } from '../types/game';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { Modal } from '../components/ui/Modal';
import { SOCKET_URL } from '../api/socket';
import { useAuthStore } from '../store/authStore';
import { trackEvent } from '../api/analytics';
import { getLobbySummary } from '../api/lobby';
import { quickSeat, createPrivateTable, getMyPrivateTables, ManagedPrivateTable } from '../api/tables';
import { createInvite } from '../api/invites';
import { getRecentPlayers, RecentPlayer } from '../api/users';
import { AccountStats, getAccountStats } from '../api/wallet';
import PlayerAvatar from '../components/game/PlayerAvatar';
import { createVipCheckout } from '../api/vip';
import { adminApi, AdminTable } from '../api/admin';
import { experienceFlags } from '../config/experienceFlags';
import { roleAtLeast } from '../types/roles';
import {
  buildLobbyActivityItems,
  getRecommendedTable,
  getTableMomentumMeta,
  LobbyActivityItem,
  LobbyActivityTone,
  LobbyRealtimeEvent,
} from '../utils/lobbyExperience';
import {
  getModeBadge,
  getModeDescription,
  getStakeDisplay,
  getStakeTierHeading,
  getTableDisplayName,
} from '../branding/modeCopy';

type PrivateTableMode = 'FREE_RTC_TABLE' | 'PRIVATE_USD_TABLE';

const DEFAULT_PRIVATE_RTC_STAKES = [1, 5, 10, 25, 50];
const PRIVATE_USD_STAKES = [5, 10, 20, 50, 100];

const toneClasses: Record<LobbyActivityTone, string> = {
  amber: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
  emerald: 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100',
  sky: 'border-sky-300/35 bg-sky-300/10 text-sky-100',
  rose: 'border-rose-300/35 bg-rose-300/10 text-rose-100',
  slate: 'border-white/15 bg-white/[0.05] text-white/78',
};

const TableSelect: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [lobbyPresence, setLobbyPresence] = useState({ onlinePlayers: 0, lobbyConnections: 0 });
  const [lobbyFeed, setLobbyFeed] = useState<LobbyRealtimeEvent[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [experienceLoading, setExperienceLoading] = useState(false);
  const [quickSeatLoading, setQuickSeatLoading] = useState(false);
  const [privateModalOpen, setPrivateModalOpen] = useState(false);
  const [privateMode, setPrivateMode] = useState<PrivateTableMode>('FREE_RTC_TABLE');
  const [privateStake, setPrivateStake] = useState<number>(1);
  const [privateMaxPlayers, setPrivateMaxPlayers] = useState<number>(4);
  const [privateHostNote, setPrivateHostNote] = useState('');
  const [privateCreating, setPrivateCreating] = useState(false);
  const [myPrivateTables, setMyPrivateTables] = useState<ManagedPrivateTable[]>([]);
  const [privateTablesLoading, setPrivateTablesLoading] = useState(false);
  const [privateManagerOpen, setPrivateManagerOpen] = useState(false);
  const [privateInviteBusyId, setPrivateInviteBusyId] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalLink, setInviteModalLink] = useState('');
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [vipCheckoutLoading, setVipCheckoutLoading] = useState(false);
  const [recentPlayers, setRecentPlayers] = useState<RecentPlayer[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'cribs' | 'promo'>('cribs');
  const [promoTable, setPromoTable] = useState<AdminTable | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoLaunching, setPromoLaunching] = useState(false);
  const [homeOverview, setHomeOverview] = useState<HomeOverview | null>(null);
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);
  const navigate = useNavigate();
  const { user, refreshVipStatus } = useAuthStore();
  const isVip = !!user?.isVip;
  const isAdmin = !!user?.role && roleAtLeast(user.role, 'admin');

  const loadMyPrivateTables = useCallback(async () => {
    if (!user?._id) {
      setMyPrivateTables([]);
      return;
    }

    setPrivateTablesLoading(true);
    try {
      const tables = await getMyPrivateTables();
      setMyPrivateTables(tables);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not load your private tables.');
    } finally {
      setPrivateTablesLoading(false);
    }
  }, [user?._id]);

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

  const fetchExperienceData = useCallback(async () => {
    setExperienceLoading(true);
    try {
      const [overviewResult, accountStatsResult] = await Promise.allSettled([
        getHomeOverview(),
        getAccountStats(),
      ]);

      if (overviewResult.status === 'fulfilled') {
        setHomeOverview(overviewResult.value);
      }

      if (accountStatsResult.status === 'fulfilled') {
        setAccountStats(accountStatsResult.value);
      }
    } catch (error) {
      console.error('Failed to load lobby experience data', error);
    } finally {
      setExperienceLoading(false);
    }
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      return false;
    }
  };

  const openInviteLinkModal = (url: string) => {
    setInviteModalLink(url);
    setInviteModalOpen(true);
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
      const copied = await copyToClipboard(invite.inviteUrl);
      openInviteLinkModal(invite.inviteUrl);
      trackEvent('invite_created', { tableId: table._id });
      toast.success(copied ? 'Invite link copied.' : 'Invite link ready.');
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
      const result = await createPrivateTable({
        mode: privateMode,
        stake: privateStake,
        maxPlayers: privateMaxPlayers,
        hostNote: privateHostNote.trim() || undefined,
      });
      const copied = await copyToClipboard(result.inviteUrl);
      openInviteLinkModal(result.inviteUrl);
      trackEvent('private_table_created', { tableId: result.table._id, mode: privateMode, stake: privateStake });
      toast.success(copied ? 'Private table created. Invite link copied.' : 'Private table created.');
      setPrivateModalOpen(false);
      void loadMyPrivateTables();
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

  const handleOpenPrivateManager = async () => {
    setPrivateManagerOpen(true);
    if (myPrivateTables.length === 0) {
      await loadMyPrivateTables();
    }
  };

  const handleOpenManagedPrivateTable = (table: ManagedPrivateTable) => {
    setPrivateManagerOpen(false);
    navigate(`/game/${table._id}`);
  };

  const handleRefreshManagedInvite = async (table: ManagedPrivateTable) => {
    setPrivateInviteBusyId(table._id);
    try {
      const invite = await createInvite({ tableId: table._id });
      const copied = await copyToClipboard(invite.inviteUrl);
      setMyPrivateTables((current) =>
        current.map((item) =>
          item._id === table._id
            ? {
                ...item,
                inviteCode: invite.code,
                inviteUrl: invite.inviteUrl,
              }
            : item
        )
      );
      if (!copied) {
        openInviteLinkModal(invite.inviteUrl);
      }
      toast.success(copied ? 'Fresh invite copied.' : 'Fresh invite ready.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create invite.');
    } finally {
      setPrivateInviteBusyId(null);
    }
  };

  const handleCopyManagedInvite = async (table: ManagedPrivateTable) => {
    if (table.inviteUrl) {
      const copied = await copyToClipboard(table.inviteUrl);
      if (!copied) {
        openInviteLinkModal(table.inviteUrl);
      }
      toast.success(copied ? 'Invite link copied.' : 'Invite link ready.');
      return;
    }

    await handleRefreshManagedInvite(table);
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
    void fetchExperienceData();
  }, [fetchExperienceData]);

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
      setMyPrivateTables([]);
      return;
    }

    void loadMyPrivateTables();
  }, [loadMyPrivateTables, user?._id]);

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

    socket.on('lobbyEvent', (payload: LobbyRealtimeEvent) => {
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
    const nextOptions = privateMode === 'PRIVATE_USD_TABLE'
      ? PRIVATE_USD_STAKES
      : Array.from(new Set(rtcTables.map((table) => table.stake))).sort((a, b) => a - b);
    const safeOptions = nextOptions.length > 0 ? nextOptions : DEFAULT_PRIVATE_RTC_STAKES;
    if (!safeOptions.includes(privateStake)) {
      setPrivateStake(safeOptions[0]);
    }
  }, [privateMode, privateStake, rtcTables]);

  const privateRtcStakeOptions = useMemo(() => {
    const options = Array.from(new Set(rtcTables.map((table) => table.stake))).sort((a, b) => a - b);
    return options.length > 0 ? options : DEFAULT_PRIVATE_RTC_STAKES;
  }, [rtcTables]);

  const activePrivateStakeOptions = privateMode === 'PRIVATE_USD_TABLE'
    ? PRIVATE_USD_STAKES
    : privateRtcStakeOptions;

  const privateStakeDisplay = useMemo(
    () => getStakeDisplay(privateStake, privateMode),
    [privateMode, privateStake]
  );

  const metrics = useMemo(() => {
    const active = rtcTables.filter((table) => table.status === 'in-game').length;
    const usd = cashCrownTables.length;
    const rtc = rtcTables.length;
    return { active, usd, rtc };
  }, [cashCrownTables.length, rtcTables]);

  const openSeats = useMemo(() => {
    return tables.reduce((sum, table) => sum + Math.max(0, table.maxPlayers - table.currentPlayerCount), 0);
  }, [tables]);

  const recommendedTable = useMemo(() => getRecommendedTable(rtcTables), [rtcTables]);

  const activityItems = useMemo(
    () =>
      experienceFlags.lobbyActivityStrip
        ? buildLobbyActivityItems({
            tables: rtcTables,
            lobbyFeed,
            overview: homeOverview,
            accountStats,
          })
        : [],
    [accountStats, homeOverview, lobbyFeed, rtcTables]
  );

  const activityLoop = useMemo(
    () => (activityItems.length > 1 ? [...activityItems, ...activityItems] : activityItems),
    [activityItems]
  );

  const recommendedTableMomentum = recommendedTable ? getTableMomentumMeta(recommendedTable) : null;
  const recommendedStakeDisplay = recommendedTable
    ? getStakeDisplay(recommendedTable.stake, recommendedTable.mode)
    : null;
  const streakLeader = homeOverview?.leaderboards.longestStreak?.rankings?.[0] ?? null;
  const reemLeader = homeOverview?.leaderboards.mostReems?.rankings?.[0] ?? null;
  const topEarner = homeOverview?.leaderboards.topEarners?.rankings?.[0] ?? null;

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

  const handleActivityClick = (item: LobbyActivityItem) => {
    if (item.tableId) {
      navigate(`/game/${item.tableId}`);
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
    return <div className="rt-panel-strong rounded-2xl p-8 text-center text-red-300">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <section className="rt-landscape-compact-card rt-glass rounded-2xl p-2">
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
          <header className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-7">
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

          <section className="rt-landscape-compact-card rt-panel-strong rounded-2xl p-5">
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
          <section className="rt-landscape-compact-card relative overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(135deg,rgba(10,14,18,0.98),rgba(18,22,28,0.95)_48%,rgba(35,24,13,0.92))] p-6 md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(680px_320px_at_8%_10%,rgba(247,188,58,0.2),transparent_72%),radial-gradient(620px_340px_at_92%_14%,rgba(56,189,248,0.14),transparent_74%),linear-gradient(120deg,rgba(255,255,255,0.04),transparent_38%,rgba(255,255,255,0.02))]" />
            <div className="relative z-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/72">
                  <Activity className="h-3.5 w-3.5 text-amber-200" />
                  Crib Board
                </div>
                <h1 className="mt-5 max-w-3xl text-4xl leading-[0.96] rt-page-title sm:text-5xl">
                  Live cribs with pressure already on them.
                </h1>
                <p className="mt-4 max-w-2xl text-base text-white/74 sm:text-lg">
                  The board should tell you where the action is in seconds. Seats are live, streaks matter, and the next move stays obvious.
                </p>
                <p className="mt-3 text-sm text-white/60">
                  {summaryLoading
                    ? 'Syncing the room...'
                    : `${lobbyPresence.onlinePlayers} players online, ${lobbyPresence.lobbyConnections} people watching the board, ${openSeats} open seats across the crib floor.`}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={handleQuickSeat} disabled={quickSeatLoading}>
                    {quickSeatLoading ? 'Finding Seat...' : 'Quick Seat'}
                  </Button>
                  {recommendedTable ? (
                    <Button variant="secondary" onClick={() => handleJoinClick(recommendedTable)}>
                      Enter Recommended Crib
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => void fetchTables()}>
                    Reload Cribs
                  </Button>
                  <Button variant="secondary" onClick={handlePrivateEntry}>
                    {isVip ? 'Create Private Table' : 'Create Private Table (VIP)'}
                  </Button>
                  {myPrivateTables.length > 0 && (
                    <Button variant="secondary" onClick={() => void handleOpenPrivateManager()} isLoading={privateTablesLoading}>
                      Manage Private Tables
                    </Button>
                  )}
                  {localStorage.getItem('last_table_id') && (
                    <Button variant="ghost" onClick={handleRejoinLast}>
                      Rejoin Last Table
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => navigate('/contests')}>
                    View Cash Crown
                  </Button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Players Online', value: summaryLoading ? '--' : String(lobbyPresence.onlinePlayers) },
                    { label: 'Hands Live', value: String(metrics.active) },
                    { label: 'Open Seats', value: String(openSeats) },
                    { label: 'Cash Crowns', value: String(metrics.usd) },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">{metric.label}</div>
                      <div className="mt-2 text-3xl rt-page-title text-white">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="grid gap-4">
                <div className="rounded-[28px] border border-amber-300/18 bg-[linear-gradient(145deg,rgba(18,22,29,0.95),rgba(12,14,18,0.9))] p-5 shadow-[0_24px_48px_rgba(0,0,0,0.3)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/84">Best Next Move</div>
                      <h2 className="mt-2 text-2xl rt-page-title text-white">
                        {recommendedTable ? getTableDisplayName(recommendedTable) : 'Open crib floor'}
                      </h2>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      recommendedTableMomentum ? toneClasses[recommendedTableMomentum.tone] : toneClasses.slate
                    }`}>
                      {recommendedTableMomentum?.badge ?? 'Browse tables'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/70">
                    {recommendedTableMomentum?.detail ?? 'Refresh the crib list, grab an open seat, or start a private room with your own lineup.'}
                  </p>

                  {recommendedTable && recommendedStakeDisplay ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Stake</div>
                        <div className="mt-2 text-lg rt-page-title text-white">
                          {recommendedStakeDisplay.amount} {recommendedStakeDisplay.unit}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Seats</div>
                        <div className="mt-2 text-lg rt-page-title text-white">
                          {recommendedTable.currentPlayerCount}/{recommendedTable.maxPlayers}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Lane</div>
                        <div className="mt-2 text-lg rt-page-title text-white">{getModeBadge(recommendedTable.mode)}</div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {recommendedTable ? (
                      <Button onClick={() => handleJoinClick(recommendedTable)}>
                        Take This Seat
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button onClick={handleQuickSeat} disabled={quickSeatLoading}>
                        {quickSeatLoading ? 'Finding Seat...' : 'Find Me A Seat'}
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => navigate('/contests')}>
                      Cash Crown Lobby
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[24px] border border-white/10 bg-black/24 p-5">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/48">
                      <Flame className="h-3.5 w-3.5 text-amber-200" />
                      Your Line
                    </div>
                    {experienceFlags.lobbyIdentityPanel && accountStats ? (
                      <>
                        <div className="mt-3 text-3xl rt-page-title text-white">{accountStats.winRate.toFixed(1)}%</div>
                        <div className="text-sm text-white/62">Win rate across {accountStats.matchesPlayed.toLocaleString('en-US')} recorded hands.</div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">Reems</div>
                            <div className="mt-2 text-lg rt-page-title text-white">{accountStats.totalReems.toLocaleString('en-US')}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">Wins</div>
                            <div className="mt-2 text-lg rt-page-title text-white">{accountStats.totalWins.toLocaleString('en-US')}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">Best RTC</div>
                            <div className="mt-2 text-lg rt-page-title text-white">{Math.round(accountStats.biggestRtcPayout).toLocaleString('en-US')}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 text-sm text-white/62">
                        {experienceLoading ? 'Syncing your account line...' : 'Play a few hands and your board starts to matter here.'}
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-black/24 p-5">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/48">
                      <Sparkles className="h-3.5 w-3.5 text-sky-200" />
                      Board Pressure
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">Streak Leader</div>
                        <div className="mt-1 text-base font-semibold text-white">{streakLeader?.username ?? 'Waiting on data'}</div>
                        <div className="text-sm text-white/62">
                          {streakLeader ? `${Math.round(streakLeader.value)} wins in the current run.` : 'The hottest player will show here.'}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">Most Reems</div>
                        <div className="mt-1 text-base font-semibold text-white">{reemLeader?.username ?? 'Waiting on data'}</div>
                        <div className="text-sm text-white/62">
                          {reemLeader ? `${Math.round(reemLeader.value)} reems in the current leaderboard window.` : 'Reem leaders will show here.'}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/46">Top Earner</div>
                        <div className="mt-1 text-base font-semibold text-white">{topEarner?.username ?? 'Waiting on data'}</div>
                        <div className="text-sm text-white/62">
                          {topEarner ? `${Math.round(topEarner.value).toLocaleString('en-US')} on the board right now.` : 'The strongest payout line will show here.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {activityItems.length > 0 ? (
            <section className="rt-glass overflow-hidden rounded-[24px] border border-white/10 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Live Activity</div>
                  <div className="mt-1 text-sm text-white/64">Real lobby motion, hot seats, and current pressure from the board.</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/58">
                  Updated live
                </div>
              </div>

              <div className="mt-4 overflow-hidden">
                <div className={`flex gap-3 ${activityItems.length > 1 ? 'rt-live-marquee' : 'flex-wrap'}`}>
                  {activityLoop.map((item, index) => (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      onClick={() => handleActivityClick(item)}
                      disabled={!item.tableId}
                      className={`rt-live-pill group flex min-w-[260px] max-w-[320px] items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        toneClasses[item.tone]
                      } ${item.tableId ? 'cursor-pointer hover:border-white/30 hover:text-white' : 'cursor-default'}`}
                    >
                      <div className="mt-0.5 rounded-full border border-white/12 bg-black/20 p-2 text-white/80">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-white/55">{item.eyebrow}</div>
                        <div className="mt-1 text-sm font-semibold leading-tight text-white">{item.message}</div>
                        {item.detail ? <div className="mt-1 text-xs text-white/64">{item.detail}</div> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="rt-landscape-compact-card rt-panel-strong rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Recent Lineup</div>
                  <div className="mt-1 text-2xl rt-page-title">Players you already know</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                  Faster re-entry
                </div>
              </div>

              {recentLoading && <div className="mt-4 text-sm text-white/60">Loading recent players...</div>}
              {!recentLoading && recentError && <div className="mt-4 text-sm text-red-300">{recentError}</div>}
              {!recentLoading && !recentError && recentPlayers.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-white/12 bg-black/15 p-4 text-sm text-white/60">
                  Play a few hands and familiar opponents will show up here.
                </div>
              )}
              {!recentLoading && recentPlayers.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {recentPlayers.map((player) => (
                    <div key={player._id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar
                          player={{ name: player.recentUsername, avatarUrl: player.recentAvatarUrl ?? undefined }}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{player.recentUsername}</div>
                          <div className="text-xs text-white/56">
                            Last played {new Date(player.lastPlayedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rt-landscape-compact-card rt-panel-strong rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Competitive Pulse</div>
                  <div className="mt-1 text-2xl rt-page-title">What the room feels like</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                  Live board
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  {
                    icon: Flame,
                    label: 'Longest streak',
                    title: streakLeader?.username ?? 'No leader yet',
                    body: streakLeader ? `${Math.round(streakLeader.value)} wins on the best run.` : 'Current streak heat appears here.',
                  },
                  {
                    icon: Trophy,
                    label: 'Most reems',
                    title: reemLeader?.username ?? 'No leader yet',
                    body: reemLeader ? `${Math.round(reemLeader.value)} reems in the active window.` : 'Reem pressure appears here.',
                  },
                  {
                    icon: Crown,
                    label: 'Top earner',
                    title: topEarner?.username ?? 'No leader yet',
                    body: topEarner ? `${Math.round(topEarner.value).toLocaleString('en-US')} on the current board.` : 'Top payout pressure appears here.',
                  },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/48">
                      <card.icon className="h-3.5 w-3.5 text-amber-200" />
                      {card.label}
                    </div>
                    <div className="mt-3 text-base font-semibold text-white">{card.title}</div>
                    <div className="mt-1 text-sm text-white/62">{card.body}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {lobbyFeed.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-black/15 p-4 text-sm text-white/60">
                    Lobby updates will appear here as players move through the room.
                  </div>
                ) : (
                  lobbyFeed.map((entry, index) => (
                    <div key={`${entry.timestamp}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-sm font-medium text-white/82">{entry.message}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/46">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="space-y-8">
            {groupedByStake.map(([stake, stakeTables]) => (
              <div key={stake}>
                <div className="mb-4 flex items-center gap-3">
                  <Coins className="h-5 w-5 text-amber-300" />
                  <h2 className="text-2xl rt-page-title">{getStakeTierHeading(stake, 'FREE_RTC_TABLE')}</h2>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {stakeTables.map((table, index) => {
                    const isDisabled = table.currentPlayerCount >= table.maxPlayers;
                    const tableName = getTableDisplayName(table);
                    const stakeDisplay = getStakeDisplay(table.stake, table.mode);
                    const momentum = getTableMomentumMeta(table);
                    const isRecommended = table._id === recommendedTable?._id;
                    const aiSeats = (table.players ?? []).filter((player) => player.isAI).length;
                    const humanSeats = Math.max(0, table.currentPlayerCount - aiSeats);

                    return (
                      <motion.article
                        key={table._id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: index * 0.04 }}
                        whileHover={{ y: -4, scale: 1.01 }}
                        className={`rt-landscape-compact-card group relative overflow-hidden rounded-[26px] border p-5 ${
                          isRecommended
                            ? 'border-amber-300/34 bg-[linear-gradient(145deg,rgba(22,22,26,0.96),rgba(33,24,12,0.92))] shadow-[0_24px_48px_rgba(120,71,7,0.18)]'
                            : 'border-white/10 bg-[linear-gradient(145deg,rgba(15,18,23,0.94),rgba(10,12,16,0.94))] shadow-[0_22px_44px_rgba(0,0,0,0.24)]'
                        }`}
                      >
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent_34%,rgba(255,255,255,0.015))]" />
                        <div className="relative z-10">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                                  {getModeBadge(table.mode)}
                                </span>
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClasses[momentum.tone]}`}>
                                  {momentum.badge}
                                </span>
                                {isRecommended ? (
                                  <span className="rounded-full border border-amber-300/35 bg-amber-300/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                                    Recommended
                                  </span>
                                ) : null}
                              </div>
                              <h3 className="mt-3 text-2xl rt-page-title">{tableName}</h3>
                            </div>
                            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              table.status === 'in-game'
                                ? 'bg-amber-500/20 text-amber-100'
                                : 'bg-emerald-500/20 text-emerald-200'
                            }`}>
                              {table.status === 'in-game' ? 'Hand Live' : 'Waiting'}
                            </div>
                          </div>

                          <div className="mt-4 flex items-baseline text-amber-300">
                            <Coins className="mr-1 h-5 w-5" />
                            <span className="text-3xl rt-page-title">{stakeDisplay.amount}</span>
                            <span className="ml-2 text-sm text-white/60">{stakeDisplay.unit}</span>
                          </div>

                          <p className="mt-2 text-sm leading-6 text-white/66">{getModeDescription(table.mode)}</p>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between gap-3 text-sm text-white/70">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-white/55" />
                                {table.currentPlayerCount}/{table.maxPlayers} seats
                              </div>
                              <div>{momentum.seatLabel}</div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              {Array.from({ length: table.maxPlayers }).map((_, seatIndex) => (
                                <span
                                  key={`${table._id}-seat-${seatIndex}`}
                                  className={`h-2.5 flex-1 rounded-full ${
                                    seatIndex < table.currentPlayerCount
                                      ? 'rt-live-pulse bg-gradient-to-r from-amber-300 to-orange-300 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                                      : 'bg-white/10'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="mt-3 text-xs text-white/56">
                              {table.currentPlayerCount === 1 && !table.isPrivate
                                ? 'Heads-up public tables can auto-fill with one AI opponent to keep motion on the board.'
                                : `${humanSeats} human seat${humanSeats === 1 ? '' : 's'}${aiSeats > 0 ? `, ${aiSeats} AI` : ''}. ${momentum.detail}`}
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <Button
                              className="flex-1 min-w-[150px]"
                              disabled={isDisabled}
                              variant={isDisabled ? 'secondary' : 'primary'}
                              onClick={() => handleJoinClick(table)}
                            >
                              {isDisabled ? 'Crib Full' : isRecommended ? 'Take This Seat' : table.status === 'in-game' ? 'Jump In' : 'Enter Crib'}
                            </Button>
                            <Button
                              className="flex-1 min-w-[150px]"
                              variant="secondary"
                              onClick={() => handleCreateInvite(table)}
                            >
                              Invite Friends
                            </Button>
                          </div>
                        </div>
                      </motion.article>
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
          confirmLabel="Join Table"
        >
          <p>Start a Reem Team Cash crib at {getStakeTierHeading(selectedTable.stake, selectedTable.mode)}.</p>
        </Modal>
      )}

      <Modal
        isOpen={privateModalOpen}
        onClose={() => setPrivateModalOpen(false)}
        onConfirm={handleCreatePrivate}
        title="Create Private Table"
        confirmLabel={privateCreating ? 'Creating...' : 'Create Table'}
      >
        <div className="space-y-4 sm:space-y-5">
          <p className="text-sm leading-6 text-white/70">
            Build a private room in a few quick steps. Everything below is scrollable on mobile.
          </p>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">1. Choose Currency</div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              {([
                {
                  id: 'FREE_RTC_TABLE' as PrivateTableMode,
                  title: 'RTC Private Table',
                  body: 'Invite-only crib using Reem Team Cash. Same stake ladder as the main crib lobby.',
                },
                {
                  id: 'PRIVATE_USD_TABLE' as PrivateTableMode,
                  title: 'USD Private Table',
                  body: 'Invite-only cash table in USD with fixed stakes of $5, $10, $20, $50, or $100.',
                },
              ]).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPrivateMode(option.id)}
                  className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                    privateMode === option.id
                      ? 'border-amber-300/55 bg-amber-300/10 text-white'
                      : 'border-white/12 bg-white/[0.03] text-white/78 hover:border-white/28 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="text-sm font-semibold">{option.title}</div>
                  <div className="mt-1 text-xs text-white/62">{option.body}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">2. Choose Stake</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activePrivateStakeOptions.map((stake) => {
                const display = getStakeDisplay(stake, privateMode);
                const isSelected = privateStake === stake;
                return (
                  <button
                    key={`${privateMode}-${stake}`}
                    type="button"
                    onClick={() => setPrivateStake(stake)}
                    className={`min-h-10 rounded-full border px-4 py-2 text-sm transition ${
                      isSelected
                        ? 'border-amber-300/55 bg-amber-300/12 text-amber-100'
                        : 'border-white/15 bg-white/[0.04] text-white/75 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {display.amount}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">3. Choose Seats</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[2, 3, 4].map((seatCount) => (
                <button
                  key={seatCount}
                  type="button"
                  onClick={() => setPrivateMaxPlayers(seatCount)}
                  className={`min-h-10 rounded-full border px-4 py-2 text-sm transition ${
                    privateMaxPlayers === seatCount
                      ? 'border-amber-300/55 bg-amber-300/12 text-amber-100'
                      : 'border-white/15 bg-white/[0.04] text-white/75 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {seatCount} Players
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/55">
              Host Note (Optional)
            </label>
            <textarea
              value={privateHostNote}
              onChange={(event) => setPrivateHostNote(event.target.value.slice(0, 160))}
              rows={3}
              placeholder="Example: Starting as soon as 4 are in."
              className="w-full rounded-2xl border border-white/14 bg-black/35 px-3 py-3 text-sm text-white placeholder:text-white/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Private Table Summary</div>
            <div className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
              <div>Room type: {privateMode === 'PRIVATE_USD_TABLE' ? 'USD Private Table' : 'RTC Private Table'}</div>
              <div>Stake: {privateStakeDisplay.amount} {privateStakeDisplay.unit}</div>
              <div>Seats: {privateMaxPlayers} players</div>
              <div>Access: Invite-only</div>
              <div>No AI players will be added to this room.</div>
              <div>{privateMode === 'PRIVATE_USD_TABLE' ? 'Guests need enough USD balance to join.' : 'Guests need enough RTC balance to join.'}</div>
            </div>
          </div>

          <p className="text-xs text-white/60">
            We&apos;ll copy the invite link and seat you instantly so you can host from inside the room.
          </p>
          {privateCreating && <p className="text-xs text-white/70">Creating private table...</p>}
        </div>
      </Modal>

      <Modal
        isOpen={privateManagerOpen}
        onClose={() => setPrivateManagerOpen(false)}
        onConfirm={() => setPrivateManagerOpen(false)}
        title="Manage Private Tables"
        confirmLabel="Done"
      >
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Jump back into your rooms or send out a fresh invite link.
          </p>
          {privateTablesLoading && (
            <p className="text-sm text-white/60">Loading your private tables...</p>
          )}
          {!privateTablesLoading && myPrivateTables.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/12 bg-black/15 p-4 text-sm text-white/60">
              You haven&apos;t created any private tables yet.
            </div>
          )}
          {!privateTablesLoading && myPrivateTables.length > 0 && (
            <div className="space-y-3">
              {myPrivateTables.map((table) => {
                const stakeDisplay = getStakeDisplay(table.stake, table.mode);
                return (
                  <article key={table._id} className="rounded-2xl border border-white/12 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">{table.name || 'Private Table'}</div>
                        <div className="mt-1 text-xs text-white/55">
                          {getModeBadge(table.mode)} | {stakeDisplay.amount} {stakeDisplay.unit}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        table.status === 'in-game'
                          ? 'bg-amber-500/20 text-amber-100'
                          : 'bg-emerald-500/20 text-emerald-200'
                      }`}>
                        {table.status === 'in-game' ? 'Hand Live' : 'Waiting'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-white/70 sm:grid-cols-2">
                      <div>Seats filled: {table.currentPlayerCount}/{table.maxPlayers}</div>
                      <div>Updated: {table.updatedAt ? new Date(table.updatedAt).toLocaleString() : '--'}</div>
                      <div>Invite: {table.inviteUrl ? 'Ready' : 'Generate a fresh link'}</div>
                      <div>Access: Invite-only</div>
                    </div>
                    {table.hostNote && (
                      <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100/85">
                        Host note: {table.hostNote}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleOpenManagedPrivateTable(table)}>
                        Open Table
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void handleCopyManagedInvite(table)} isLoading={privateInviteBusyId === table._id}>
                        {table.inviteUrl ? 'Copy Invite' : 'Create Invite'}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={vipModalOpen}
        onClose={() => setVipModalOpen(false)}
        onConfirm={handleVipCheckout}
        title="VIP Subscription Required"
        confirmLabel={vipCheckoutLoading ? 'Starting VIP...' : 'Start VIP'}
      >
        <div className="space-y-3">
          <p>Private tables are reserved for VIP members.</p>
          <ul className="list-disc pl-5 text-sm text-white/70 space-y-1">
            <li>Host private RTC or USD tables with clear preset stakes</li>
            <li>Private invite links that take your guests straight to the right room</li>
            <li>Human-only hosted rooms with no AI auto-fill</li>
          </ul>
          <p className="text-sm text-white/70">$4.99/mo. Cancel anytime.</p>
          {vipCheckoutLoading && <p className="text-xs text-white/70">Starting VIP checkout...</p>}
        </div>
      </Modal>

      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onConfirm={() => {
          if (inviteModalLink) {
            void copyToClipboard(inviteModalLink);
          }
        }}
        title="Invite Link Ready"
        confirmLabel="Copy Link"
      >
        <div className="space-y-4">
          <p>Send this link to the players you want to bring into the room.</p>
          <input
            readOnly
            value={inviteModalLink}
            className="h-11 w-full rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
          />
          <p className="text-xs text-white/55">
            The link opens the invite page first, then takes the player into the table from there.
          </p>
        </div>
      </Modal>
        </>
      )}
    </div>
  );
};

export default TableSelect;
