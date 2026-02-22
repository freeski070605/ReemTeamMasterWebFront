import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, Settings, Trophy, Wallet } from 'lucide-react';
import { toast } from 'react-toastify';
import client from '../api/client';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';

type AdminTab = 'overview' | 'tables' | 'contests' | 'withdrawals';
type GameMode = 'FREE_RTC_TABLE' | 'RTC_TOURNAMENT' | 'RTC_SATELLITE' | 'USD_CONTEST';
type ContestStatus = 'draft' | 'open' | 'locked' | 'in-progress' | 'completed' | 'cancelled';
type TableStatusFilter = 'all' | 'waiting' | 'in-game';

interface AdminOverview {
  users: number;
  admins: number;
  wallets: number;
  tables: number;
  cashCrownTables: number;
  contests: number;
  activeContests: number;
  pendingWithdrawals: number;
}

interface AdminTable {
  _id: string;
  name: string;
  stake: number;
  mode: GameMode;
  minPlayers: number;
  maxPlayers: number;
  currentPlayerCount: number;
  status: 'waiting' | 'in-game';
  activeContestId?: string;
}

interface AdminContest {
  _id: string;
  contestId: string;
  entryFee: number;
  playerCount: number;
  prizePool: number;
  platformFee: number;
  status: ContestStatus;
  participants: string[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

interface WithdrawalRequest {
  _id: string;
  userId: { username: string; email: string };
  amount: number;
  payoutMethod: string;
  payoutAddress: string;
  status: string;
  requestedAt: string;
}

interface TableDraft {
  name: string;
  stake: string;
  mode: GameMode;
  minPlayers: string;
  maxPlayers: string;
  activeContestId: string;
}

interface ContestDraft {
  entryFee: string;
  playerCount: string;
  platformFee: string;
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  action: (() => Promise<void>) | null;
}

const MODE_LABELS: Record<GameMode, string> = {
  FREE_RTC_TABLE: 'Free RTC',
  RTC_TOURNAMENT: 'RTC Tournament',
  RTC_SATELLITE: 'RTC Satellite',
  USD_CONTEST: 'Cash Crown',
};

const statusOptions: ContestStatus[] = ['draft', 'open', 'locked', 'in-progress', 'cancelled', 'completed'];

const tabCopy: Record<AdminTab, { title: string; description: string }> = {
  overview: {
    title: 'Control Overview',
    description: 'Monitor platform health and cash operations at a glance.',
  },
  tables: {
    title: 'Cash Crown Tables',
    description: 'Create, configure, reset, and retire competition tables.',
  },
  contests: {
    title: 'Cash Crown Contests',
    description: 'Launch contest pools and control contest lifecycle status.',
  },
  withdrawals: {
    title: 'Withdrawal Queue',
    description: 'Review payout requests and approve or reject safely.',
  },
};

const quickTableTiers = [1, 5, 10, 25, 50];

const statusBadgeClass: Record<ContestStatus, string> = {
  draft: 'bg-white/10 text-white/75',
  open: 'bg-emerald-500/20 text-emerald-200',
  locked: 'bg-amber-500/20 text-amber-200',
  'in-progress': 'bg-sky-500/20 text-sky-200',
  completed: 'bg-violet-500/20 text-violet-200',
  cancelled: 'bg-rose-500/20 text-rose-200',
};

const getErrorMessage = (error: any, fallback: string): string => {
  return error?.response?.data?.message || fallback;
};

const toTableDraft = (table: AdminTable): TableDraft => ({
  name: table.name,
  stake: String(table.stake),
  mode: table.mode,
  minPlayers: String(table.minPlayers),
  maxPlayers: String(table.maxPlayers),
  activeContestId: table.activeContestId ?? '',
});

const defaultTableDraft = (): TableDraft => ({
  name: '',
  stake: '1',
  mode: 'USD_CONTEST',
  minPlayers: '2',
  maxPlayers: '4',
  activeContestId: '',
});

const defaultContestDraft = (): ContestDraft => ({
  entryFee: '5',
  playerCount: '2',
  platformFee: '0',
});

const toCurrency = (value: number): string => `$${value.toFixed(2)}`;

const normalizeText = (value: string): string => value.trim().toLowerCase();

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [contests, setContests] = useState<AdminContest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');

  const [tableDraft, setTableDraft] = useState<TableDraft>(defaultTableDraft());
  const [contestDraft, setContestDraft] = useState<ContestDraft>(defaultContestDraft());
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingTableDraft, setEditingTableDraft] = useState<TableDraft>(defaultTableDraft());
  const [contestStatusDraft, setContestStatusDraft] = useState<Record<string, ContestStatus>>({});

  const [tableQuery, setTableQuery] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState<TableStatusFilter>('all');
  const [contestQuery, setContestQuery] = useState('');
  const [withdrawalQuery, setWithdrawalQuery] = useState('');

  const [tableActionId, setTableActionId] = useState<string | null>(null);
  const [contestActionId, setContestActionId] = useState<string | null>(null);
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);
  const [creatingTable, setCreatingTable] = useState(false);
  const [creatingContest, setCreatingContest] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    action: null,
  });

  const fetchOverview = useCallback(async () => {
    const response = await client.get<AdminOverview>('/admin/overview');
    setOverview(response.data);
  }, []);

  const fetchTables = useCallback(async () => {
    const response = await client.get<AdminTable[]>('/admin/tables', {
      params: { mode: 'USD_CONTEST' },
    });
    const sorted = Array.isArray(response.data)
      ? [...response.data].sort((a, b) => a.stake - b.stake || a.name.localeCompare(b.name))
      : [];
    setTables(sorted);
  }, []);

  const fetchContests = useCallback(async () => {
    const response = await client.get<AdminContest[]>('/admin/contests');
    const sorted = Array.isArray(response.data)
      ? [...response.data].sort((a, b) => {
          if (a.status !== b.status) return a.status.localeCompare(b.status);
          return b.createdAt.localeCompare(a.createdAt);
        })
      : [];
    setContests(sorted);

    setContestStatusDraft((prev) => {
      const next: Record<string, ContestStatus> = { ...prev };
      for (const contest of sorted) {
        next[contest.contestId] = prev[contest.contestId] ?? contest.status;
      }
      return next;
    });
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    const response = await client.get<WithdrawalRequest[]>('/wallet/admin/withdrawals');
    setWithdrawals(Array.isArray(response.data) ? response.data : []);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchOverview(), fetchTables(), fetchContests(), fetchWithdrawals()]);
      setFatalError('');
    } catch (error: any) {
      const message = getErrorMessage(error, 'Failed to load admin data.');
      setFatalError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [fetchContests, fetchOverview, fetchTables, fetchWithdrawals]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const pendingWithdrawals = useMemo(
    () => withdrawals.filter((item) => item.status?.toLowerCase() === 'pending'),
    [withdrawals]
  );

  const filteredTables = useMemo(() => {
    const query = normalizeText(tableQuery);
    return tables.filter((table) => {
      const matchesStatus = tableStatusFilter === 'all' ? true : table.status === tableStatusFilter;
      const haystack = `${table.name} ${table.activeContestId ?? ''} ${table.stake}`.toLowerCase();
      const matchesQuery = query.length === 0 || haystack.includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [tableQuery, tableStatusFilter, tables]);

  const filteredContests = useMemo(() => {
    const query = normalizeText(contestQuery);
    return contests.filter((contest) => {
      if (query.length === 0) return true;
      const haystack = `${contest.contestId} ${contest.status} ${contest.entryFee} ${contest.playerCount}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [contestQuery, contests]);

  const filteredWithdrawals = useMemo(() => {
    const query = normalizeText(withdrawalQuery);
    return pendingWithdrawals.filter((item) => {
      if (query.length === 0) return true;
      const haystack = `${item.userId.username} ${item.userId.email} ${item.payoutMethod} ${item.amount}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [pendingWithdrawals, withdrawalQuery]);

  const pendingWithdrawalAmount = useMemo(
    () => filteredWithdrawals.reduce((sum, item) => sum + item.amount, 0),
    [filteredWithdrawals]
  );

  const contestPreview = useMemo(() => {
    const entryFee = Number(contestDraft.entryFee || 0);
    const playerCount = Number(contestDraft.playerCount || 0);
    const fee = Number(contestDraft.platformFee || 0);

    const collected = Math.max(0, entryFee * playerCount);
    const prizePool = Math.max(0, collected - fee);

    return {
      collected,
      prizePool,
      fee,
    };
  }, [contestDraft.entryFee, contestDraft.playerCount, contestDraft.platformFee]);

  const openConfirmDialog = (title: string, message: string, action: () => Promise<void>) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      action,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      title: '',
      message: '',
      action: null,
    });
  };

  const runConfirmedAction = async () => {
    const action = confirmDialog.action;
    closeConfirmDialog();
    if (!action) return;
    await action();
  };

  const validateTableDraft = (draft: TableDraft): string | null => {
    if (draft.name.trim().length < 3) return 'Table name must be at least 3 characters.';
    const stake = Number(draft.stake);
    const minPlayers = Number(draft.minPlayers);
    const maxPlayers = Number(draft.maxPlayers);

    if (!Number.isFinite(stake) || stake <= 0) return 'Stake must be greater than 0.';
    if (!Number.isInteger(minPlayers) || minPlayers < 2 || minPlayers > 4) return 'Min players must be 2-4.';
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 4) return 'Max players must be 2-4.';
    if (minPlayers > maxPlayers) return 'Min players cannot exceed max players.';

    return null;
  };

  const handleCreateTable = async () => {
    const validation = validateTableDraft(tableDraft);
    if (validation) {
      toast.error(validation);
      return;
    }

    try {
      setCreatingTable(true);
      await client.post('/admin/tables', {
        name: tableDraft.name.trim(),
        stake: Number(tableDraft.stake),
        mode: tableDraft.mode,
        minPlayers: Number(tableDraft.minPlayers),
        maxPlayers: Number(tableDraft.maxPlayers),
        activeContestId: tableDraft.activeContestId.trim() || undefined,
      });
      toast.success('Cash Crown table created.');
      setTableDraft(defaultTableDraft());
      await Promise.all([fetchTables(), fetchOverview()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to create table.'));
    } finally {
      setCreatingTable(false);
    }
  };

  const handleQuickCreateTierTable = async (stakeTier: number) => {
    const baseName = `Cash Crown $${stakeTier}`;
    const existingCount = tables.filter((table) => table.stake === stakeTier).length;
    const suffix = existingCount > 0 ? ` #${existingCount + 1}` : '';

    try {
      setCreatingTable(true);
      await client.post('/admin/tables', {
        name: `${baseName}${suffix}`,
        stake: stakeTier,
        mode: 'USD_CONTEST',
        minPlayers: 2,
        maxPlayers: 4,
      });
      toast.success(`Created ${baseName}${suffix}.`);
      await Promise.all([fetchTables(), fetchOverview()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to quick-create table.'));
    } finally {
      setCreatingTable(false);
    }
  };

  const beginEditTable = (table: AdminTable) => {
    setEditingTableId(table._id);
    setEditingTableDraft(toTableDraft(table));
  };

  const handleUpdateTable = async (tableId: string) => {
    const validation = validateTableDraft(editingTableDraft);
    if (validation) {
      toast.error(validation);
      return;
    }

    try {
      setTableActionId(tableId);
      await client.put(`/admin/tables/${tableId}`, {
        name: editingTableDraft.name.trim(),
        stake: Number(editingTableDraft.stake),
        mode: editingTableDraft.mode,
        minPlayers: Number(editingTableDraft.minPlayers),
        maxPlayers: Number(editingTableDraft.maxPlayers),
        activeContestId: editingTableDraft.activeContestId.trim() || undefined,
      });
      toast.success('Table updated.');
      setEditingTableId(null);
      await Promise.all([fetchTables(), fetchOverview()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update table.'));
    } finally {
      setTableActionId(null);
    }
  };

  const handleResetTable = (table: AdminTable) => {
    openConfirmDialog(
      `Reset ${table.name}?`,
      'This clears seated players and live state for this table.',
      async () => {
        try {
          setTableActionId(table._id);
          await client.post(`/admin/tables/${table._id}/reset`, { keepContestBinding: true });
          toast.success('Table reset complete.');
          await Promise.all([fetchTables(), fetchOverview()]);
        } catch (error: any) {
          toast.error(getErrorMessage(error, 'Failed to reset table.'));
        } finally {
          setTableActionId(null);
        }
      }
    );
  };

  const handleDeleteTable = (table: AdminTable) => {
    openConfirmDialog(
      `Delete ${table.name}?`,
      'This permanently removes the table configuration.',
      async () => {
        try {
          setTableActionId(table._id);
          await client.delete(`/admin/tables/${table._id}`, { params: { force: true } });
          toast.success('Table deleted.');
          await Promise.all([fetchTables(), fetchOverview()]);
        } catch (error: any) {
          toast.error(getErrorMessage(error, 'Failed to delete table.'));
        } finally {
          setTableActionId(null);
        }
      }
    );
  };

  const handleCreateContest = async () => {
    const entryFee = Number(contestDraft.entryFee);
    const playerCount = Number(contestDraft.playerCount);
    const platformFee = Number(contestDraft.platformFee);

    if (!Number.isFinite(entryFee) || entryFee <= 0) {
      toast.error('Entry fee must be greater than 0.');
      return;
    }
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) {
      toast.error('Player count must be between 2 and 4.');
      return;
    }
    if (!Number.isFinite(platformFee) || platformFee < 0) {
      toast.error('Platform fee must be 0 or greater.');
      return;
    }

    try {
      setCreatingContest(true);
      await client.post('/admin/contests', {
        entryFee,
        playerCount,
        platformFee,
      });
      toast.success('Cash Crown contest created.');
      setContestDraft(defaultContestDraft());
      await Promise.all([fetchContests(), fetchOverview()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to create contest.'));
    } finally {
      setCreatingContest(false);
    }
  };

  const handleContestStatusUpdate = async (contestId: string) => {
    const nextStatus = contestStatusDraft[contestId];
    if (!nextStatus) return;

    try {
      setContestActionId(contestId);
      await client.patch(`/admin/contests/${contestId}/status`, { status: nextStatus });
      toast.success(`Contest moved to ${nextStatus}.`);
      await Promise.all([fetchContests(), fetchOverview()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update contest status.'));
    } finally {
      setContestActionId(null);
    }
  };

  const handleProcessWithdrawal = (request: WithdrawalRequest, action: 'approve' | 'reject') => {
    const verb = action === 'approve' ? 'Approve' : 'Reject';
    openConfirmDialog(
      `${verb} ${request.userId.username}'s withdrawal?`,
      `${verb} ${toCurrency(request.amount)} via ${request.payoutMethod}.`,
      async () => {
        try {
          setProcessingWithdrawalId(request._id);
          await client.post(`/wallet/admin/withdrawals/${request._id}/process`, { action });
          toast.success(`Withdrawal ${action}ed.`);
          await Promise.all([fetchWithdrawals(), fetchOverview()]);
        } catch (error: any) {
          toast.error(getErrorMessage(error, 'Failed to process withdrawal.'));
        } finally {
          setProcessingWithdrawalId(null);
        }
      }
    );
  };

  if (loading) return <Loader />;

  if (fatalError) {
    return (
      <div className="rt-panel-strong rounded-2xl p-8 text-center text-red-300">
        {fatalError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rt-panel-strong rounded-3xl p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">Admin Console</div>
        <h1 className="mt-2 text-4xl rt-page-title font-semibold">{tabCopy[activeTab].title}</h1>
        <p className="mt-2 text-white/65">{tabCopy[activeTab].description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(['overview', 'tables', 'contests', 'withdrawals'] as AdminTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' ? 'Overview' : tab === 'tables' ? 'Tables' : tab === 'contests' ? 'Contests' : 'Withdrawals'}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => void refreshAll()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Cash Crown Tables</div>
          <div className="mt-2 text-3xl rt-page-title">{overview?.cashCrownTables ?? 0}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Contests Active</div>
          <div className="mt-2 text-3xl rt-page-title">{overview?.activeContests ?? 0}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Pending Withdrawals</div>
          <div className="mt-2 text-3xl rt-page-title">{overview?.pendingWithdrawals ?? 0}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Admins / Users</div>
          <div className="mt-2 text-3xl rt-page-title">
            {overview?.admins ?? 0} / {overview?.users ?? 0}
          </div>
        </div>
      </section>

      {activeTab === 'overview' && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rt-panel-strong rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
              <Settings className="h-4 w-4" />
              Accounts
            </div>
            <div className="mt-3 space-y-1 text-white/75">
              <div>Users: {overview?.users ?? 0}</div>
              <div>Wallets: {overview?.wallets ?? 0}</div>
              <div>Admins: {overview?.admins ?? 0}</div>
            </div>
          </div>
          <div className="rt-panel-strong rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
              <Trophy className="h-4 w-4" />
              Competition Operations
            </div>
            <div className="mt-3 space-y-1 text-white/75">
              <div>All Tables: {overview?.tables ?? 0}</div>
              <div>Cash Crown Tables: {overview?.cashCrownTables ?? 0}</div>
              <div>Contests: {overview?.contests ?? 0}</div>
              <div>Active Contests: {overview?.activeContests ?? 0}</div>
            </div>
          </div>
          <div className="rt-panel-strong rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
              <Wallet className="h-4 w-4" />
              Payout Queue
            </div>
            <div className="mt-3 space-y-1 text-white/75">
              <div>Pending Requests: {pendingWithdrawals.length}</div>
              <div>Pending Value: {toCurrency(pendingWithdrawalAmount)}</div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'tables' && (
        <section className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="rt-panel-strong rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-300" />
                <h2 className="text-2xl rt-page-title">Create Table</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Table Name"
                  placeholder="Cash Crown Main"
                  value={tableDraft.name}
                  onChange={(event) => setTableDraft((prev) => ({ ...prev, name: event.target.value }))}
                />
                <Input
                  label="Stake"
                  type="number"
                  min={1}
                  value={tableDraft.stake}
                  onChange={(event) => setTableDraft((prev) => ({ ...prev, stake: event.target.value }))}
                />
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/60">Mode</label>
                  <select
                    className="h-11 w-full rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                    value={tableDraft.mode}
                    onChange={(event) => setTableDraft((prev) => ({ ...prev, mode: event.target.value as GameMode }))}
                  >
                    {Object.keys(MODE_LABELS).map((mode) => (
                      <option key={mode} value={mode}>
                        {MODE_LABELS[mode as GameMode]}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Active Contest ID"
                  placeholder="optional"
                  value={tableDraft.activeContestId}
                  onChange={(event) => setTableDraft((prev) => ({ ...prev, activeContestId: event.target.value }))}
                />
                <Input
                  label="Min Players"
                  type="number"
                  min={2}
                  max={4}
                  value={tableDraft.minPlayers}
                  onChange={(event) => setTableDraft((prev) => ({ ...prev, minPlayers: event.target.value }))}
                />
                <Input
                  label="Max Players"
                  type="number"
                  min={2}
                  max={4}
                  value={tableDraft.maxPlayers}
                  onChange={(event) => setTableDraft((prev) => ({ ...prev, maxPlayers: event.target.value }))}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button isLoading={creatingTable} onClick={() => void handleCreateTable()}>
                  Create Table
                </Button>
              </div>
            </div>

            <div className="rt-panel-strong rounded-2xl p-5">
              <h3 className="text-xl rt-page-title">Quick Create</h3>
              <p className="mt-1 text-sm text-white/60">One-click Cash Crown table setup by stake tier.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {quickTableTiers.map((tier) => (
                  <Button
                    key={tier}
                    size="sm"
                    variant="secondary"
                    isLoading={creatingTable}
                    onClick={() => void handleQuickCreateTierTable(tier)}
                  >
                    ${tier} Tier
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="rt-panel-strong rounded-2xl p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-xl rt-page-title">Managed Tables</h3>
                <div className="text-sm text-white/60">{filteredTables.length} of {tables.length} tables shown</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[220px_160px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                  <input
                    className="h-10 w-full rounded-xl border border-white/14 bg-black/35 pl-9 pr-3 text-sm text-white"
                    placeholder="Search table"
                    value={tableQuery}
                    onChange={(event) => setTableQuery(event.target.value)}
                  />
                </div>
                <select
                  className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                  value={tableStatusFilter}
                  onChange={(event) => setTableStatusFilter(event.target.value as TableStatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="waiting">Waiting</option>
                  <option value="in-game">In Game</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {filteredTables.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                  No tables match your filters.
                </div>
              )}

              {filteredTables.map((table) => {
                const editing = editingTableId === table._id;
                const busy = tableActionId === table._id;
                const source = editing ? editingTableDraft : toTableDraft(table);
                return (
                  <article key={table._id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-white">{table.name}</div>
                        <div className="text-xs text-white/50">{MODE_LABELS[table.mode]} • {toCurrency(table.stake)} stake</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${table.status === 'in-game' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {table.status === 'in-game' ? 'In Game' : 'Waiting'}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Input
                        label="Name"
                        value={source.name}
                        disabled={!editing}
                        onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, name: event.target.value }))}
                      />
                      <Input
                        label="Stake"
                        type="number"
                        min={1}
                        value={source.stake}
                        disabled={!editing}
                        onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, stake: event.target.value }))}
                      />
                      <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/60">Mode</label>
                        <select
                          className="h-11 w-full rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white disabled:opacity-50"
                          value={source.mode}
                          disabled={!editing}
                          onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, mode: event.target.value as GameMode }))}
                        >
                          {Object.keys(MODE_LABELS).map((mode) => (
                            <option key={mode} value={mode}>
                              {MODE_LABELS[mode as GameMode]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Contest ID"
                        value={source.activeContestId}
                        disabled={!editing}
                        onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, activeContestId: event.target.value }))}
                      />
                      <Input
                        label="Min Players"
                        type="number"
                        min={2}
                        max={4}
                        value={source.minPlayers}
                        disabled={!editing}
                        onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, minPlayers: event.target.value }))}
                      />
                      <Input
                        label="Max Players"
                        type="number"
                        min={2}
                        max={4}
                        value={source.maxPlayers}
                        disabled={!editing}
                        onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, maxPlayers: event.target.value }))}
                      />
                    </div>

                    <div className="mt-2 text-xs text-white/55">Seated: {table.currentPlayerCount}/{table.maxPlayers}</div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {editing ? (
                        <>
                          <Button size="sm" isLoading={busy} onClick={() => void handleUpdateTable(table._id)}>
                            Save Changes
                          </Button>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditingTableId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => beginEditTable(table)}>
                          Edit
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleResetTable(table)}>
                        Reset
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => handleDeleteTable(table)}>
                        Delete
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'contests' && (
        <section className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="rt-panel-strong rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-300" />
                <h2 className="text-2xl rt-page-title">Create Contest</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Entry Fee"
                  type="number"
                  min={1}
                  value={contestDraft.entryFee}
                  onChange={(event) => setContestDraft((prev) => ({ ...prev, entryFee: event.target.value }))}
                />
                <Input
                  label="Players"
                  type="number"
                  min={2}
                  max={4}
                  value={contestDraft.playerCount}
                  onChange={(event) => setContestDraft((prev) => ({ ...prev, playerCount: event.target.value }))}
                />
                <Input
                  label="Platform Fee"
                  type="number"
                  min={0}
                  value={contestDraft.platformFee}
                  onChange={(event) => setContestDraft((prev) => ({ ...prev, platformFee: event.target.value }))}
                />
              </div>
              <div className="mt-4">
                <Button isLoading={creatingContest} onClick={() => void handleCreateContest()}>
                  Create Contest
                </Button>
              </div>
            </div>

            <div className="rt-panel-strong rounded-2xl p-5">
              <h3 className="text-xl rt-page-title">Prize Preview</h3>
              <div className="mt-3 space-y-2 text-sm text-white/75">
                <div className="flex justify-between">
                  <span>Total Collected</span>
                  <span>{toCurrency(contestPreview.collected)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee</span>
                  <span>{toCurrency(contestPreview.fee)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-amber-200">
                  <span>Estimated Prize Pool</span>
                  <span>{toCurrency(contestPreview.prizePool)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rt-panel-strong rounded-2xl p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-xl rt-page-title">Contests</h3>
                <div className="text-sm text-white/60">{filteredContests.length} contests shown</div>
              </div>
              <div className="relative w-full max-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                <input
                  className="h-10 w-full rounded-xl border border-white/14 bg-black/35 pl-9 pr-3 text-sm text-white"
                  placeholder="Search contest"
                  value={contestQuery}
                  onChange={(event) => setContestQuery(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/20">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-white/60 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4">Contest</th>
                    <th className="py-3 px-4">Entry / Pool</th>
                    <th className="py-3 px-4">Seats</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Next Status</th>
                    <th className="py-3 px-4 text-right">Apply</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredContests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-white/55">
                        No contests match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredContests.map((contest) => {
                      const busy = contestActionId === contest.contestId;
                      const selectedStatus = contestStatusDraft[contest.contestId] ?? contest.status;
                      return (
                        <tr key={contest._id} className="hover:bg-white/[0.03]">
                          <td className="py-4 px-4">
                            <div className="font-semibold text-white">{contest.contestId}</div>
                            <div className="text-xs text-white/50">Created {new Date(contest.createdAt).toLocaleString()}</div>
                          </td>
                          <td className="py-4 px-4 text-white/75">
                            <div>{toCurrency(contest.entryFee)} entry</div>
                            <div className="text-xs text-white/50">Pool {toCurrency(contest.prizePool)} • Fee {toCurrency(contest.platformFee)}</div>
                          </td>
                          <td className="py-4 px-4 text-white/75">
                            {contest.participants.length}/{contest.playerCount}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs ${statusBadgeClass[contest.status]}`}>
                              {contest.status}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <select
                              className="h-9 rounded-lg border border-white/14 bg-black/35 px-2 text-xs text-white"
                              value={selectedStatus}
                              onChange={(event) =>
                                setContestStatusDraft((prev) => ({
                                  ...prev,
                                  [contest.contestId]: event.target.value as ContestStatus,
                                }))
                              }
                              disabled={busy}
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy || selectedStatus === contest.status}
                              onClick={() => void handleContestStatusUpdate(contest.contestId)}
                            >
                              Update
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'withdrawals' && (
        <section className="rt-panel-strong rounded-2xl p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl rt-page-title">Pending Withdrawals</h2>
              <div className="text-sm text-white/60">
                {filteredWithdrawals.length} requests • {toCurrency(pendingWithdrawalAmount)} queued
              </div>
            </div>
            <div className="relative w-full max-w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                className="h-10 w-full rounded-xl border border-white/14 bg-black/35 pl-9 pr-3 text-sm text-white"
                placeholder="Search requester"
                value={withdrawalQuery}
                onChange={(event) => setWithdrawalQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/20">
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
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-white/55">
                      No pending withdrawals match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((req) => {
                    const processing = processingWithdrawalId === req._id;
                    return (
                      <tr key={req._id} className="hover:bg-white/[0.03]">
                        <td className="py-4 px-4">
                          <div className="font-medium text-white">{req.userId.username}</div>
                          <div className="text-xs text-white/50">{req.userId.email}</div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-amber-200">{toCurrency(req.amount)}</td>
                        <td className="py-4 px-4 text-white/75">{req.payoutMethod}</td>
                        <td className="py-4 px-4 text-white/75 font-mono text-xs">{req.payoutAddress}</td>
                        <td className="py-4 px-4 text-white/55 text-sm">{new Date(req.requestedAt).toLocaleString()}</td>
                        <td className="py-4 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={processing}
                              onClick={() => handleProcessWithdrawal(req, 'reject')}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              disabled={processing}
                              onClick={() => handleProcessWithdrawal(req, 'approve')}
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
      )}

      <Modal
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        onClose={closeConfirmDialog}
        onConfirm={() => void runConfirmedAction()}
      >
        <p>{confirmDialog.message}</p>
      </Modal>
    </div>
  );
};

export default Admin;
