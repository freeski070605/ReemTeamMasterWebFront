import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import client from '../api/client';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';

type AdminTab = 'overview' | 'tables' | 'contests' | 'withdrawals';
type GameMode = 'FREE_RTC_TABLE' | 'RTC_TOURNAMENT' | 'RTC_SATELLITE' | 'USD_CONTEST';
type ContestStatus = 'draft' | 'open' | 'locked' | 'in-progress' | 'completed' | 'cancelled';

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

const MODE_LABELS: Record<GameMode, string> = {
  FREE_RTC_TABLE: 'Free RTC',
  RTC_TOURNAMENT: 'RTC Tournament',
  RTC_SATELLITE: 'RTC Satellite',
  USD_CONTEST: 'Cash Crown',
};

const statusOptions: ContestStatus[] = ['draft', 'open', 'locked', 'in-progress', 'cancelled', 'completed'];

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

  const [tableActionId, setTableActionId] = useState<string | null>(null);
  const [contestActionId, setContestActionId] = useState<string | null>(null);
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);
  const [creatingTable, setCreatingTable] = useState(false);
  const [creatingContest, setCreatingContest] = useState(false);

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
  const pendingWithdrawalAmount = useMemo(
    () => pendingWithdrawals.reduce((sum, item) => sum + item.amount, 0),
    [pendingWithdrawals]
  );

  const handleCreateTable = async () => {
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

  const beginEditTable = (table: AdminTable) => {
    setEditingTableId(table._id);
    setEditingTableDraft(toTableDraft(table));
  };

  const handleUpdateTable = async (tableId: string) => {
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

  const handleResetTable = async (tableId: string) => {
    if (!window.confirm('Reset this table and clear all seated players/state?')) return;

    try {
      setTableActionId(tableId);
      await client.post(`/admin/tables/${tableId}/reset`, { keepContestBinding: true });
      toast.success('Table reset complete.');
      await Promise.all([fetchTables(), fetchOverview()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to reset table.'));
    } finally {
      setTableActionId(null);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!window.confirm('Delete this table permanently?')) return;

    try {
      setTableActionId(tableId);
      await client.delete(`/admin/tables/${tableId}`, { params: { force: true } });
      toast.success('Table deleted.');
      await Promise.all([fetchTables(), fetchOverview()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to delete table.'));
    } finally {
      setTableActionId(null);
    }
  };

  const handleCreateContest = async () => {
    try {
      setCreatingContest(true);
      await client.post('/admin/contests', {
        entryFee: Number(contestDraft.entryFee),
        playerCount: Number(contestDraft.playerCount),
        platformFee: Number(contestDraft.platformFee),
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

  const handleProcessWithdrawal = async (id: string, action: 'approve' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;

    try {
      setProcessingWithdrawalId(id);
      await client.post(`/wallet/admin/withdrawals/${id}/process`, { action });
      toast.success(`Withdrawal ${action}ed.`);
      await Promise.all([fetchWithdrawals(), fetchOverview()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to process withdrawal.'));
    } finally {
      setProcessingWithdrawalId(null);
    }
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
        <h1 className="mt-2 text-4xl rt-page-title font-semibold">Operations Dashboard</h1>
        <p className="mt-2 text-white/65">
          Configure Cash Crown tables, manage contest flow, and process payouts from one panel.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(['overview', 'tables', 'contests', 'withdrawals'] as AdminTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' ? 'Overview' : tab === 'tables' ? 'Cash Crown Tables' : tab === 'contests' ? 'Cash Crown Contests' : 'Withdrawals'}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => void refreshAll()}>
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
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Accounts</div>
            <div className="mt-2 text-white/75">Users: {overview?.users ?? 0}</div>
            <div className="text-white/75">Wallets: {overview?.wallets ?? 0}</div>
            <div className="text-white/75">Admins: {overview?.admins ?? 0}</div>
          </div>
          <div className="rt-panel-strong rounded-2xl p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Table Ops</div>
            <div className="mt-2 text-white/75">All Tables: {overview?.tables ?? 0}</div>
            <div className="text-white/75">Cash Crown Tables: {overview?.cashCrownTables ?? 0}</div>
          </div>
          <div className="rt-panel-strong rounded-2xl p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Cash Crown Economy</div>
            <div className="mt-2 text-white/75">Contests: {overview?.contests ?? 0}</div>
            <div className="text-white/75">Active Contests: {overview?.activeContests ?? 0}</div>
            <div className="text-white/75">
              Pending Withdrawal Value: ${pendingWithdrawalAmount.toFixed(2)}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'tables' && (
        <section className="space-y-5">
          <div className="rt-panel-strong rounded-2xl p-5">
            <h2 className="text-2xl rt-page-title mb-4">Create Cash Crown Table</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Table Name"
                value={tableDraft.name}
                onChange={(event) => setTableDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
              <input
                type="number"
                min={1}
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Stake"
                value={tableDraft.stake}
                onChange={(event) => setTableDraft((prev) => ({ ...prev, stake: event.target.value }))}
              />
              <select
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                value={tableDraft.mode}
                onChange={(event) => setTableDraft((prev) => ({ ...prev, mode: event.target.value as GameMode }))}
              >
                {Object.keys(MODE_LABELS).map((mode) => (
                  <option key={mode} value={mode}>
                    {MODE_LABELS[mode as GameMode]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={2}
                max={4}
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Min Players"
                value={tableDraft.minPlayers}
                onChange={(event) => setTableDraft((prev) => ({ ...prev, minPlayers: event.target.value }))}
              />
              <input
                type="number"
                min={2}
                max={4}
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Max Players"
                value={tableDraft.maxPlayers}
                onChange={(event) => setTableDraft((prev) => ({ ...prev, maxPlayers: event.target.value }))}
              />
              <input
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Active Contest ID (optional)"
                value={tableDraft.activeContestId}
                onChange={(event) => setTableDraft((prev) => ({ ...prev, activeContestId: event.target.value }))}
              />
            </div>
            <div className="mt-4">
              <Button isLoading={creatingTable} onClick={() => void handleCreateTable()}>
                Create Table
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {tables.length === 0 && (
              <div className="rt-panel-strong rounded-2xl p-5 text-white/55">No Cash Crown tables configured.</div>
            )}
            {tables.map((table) => {
              const editing = editingTableId === table._id;
              const busy = tableActionId === table._id;
              const source = editing ? editingTableDraft : toTableDraft(table);
              return (
                <article key={table._id} className="rt-panel-strong rounded-2xl p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                      value={source.name}
                      disabled={!editing}
                      onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, name: event.target.value }))}
                    />
                    <input
                      type="number"
                      min={1}
                      className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                      value={source.stake}
                      disabled={!editing}
                      onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, stake: event.target.value }))}
                    />
                    <select
                      className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
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
                    <input
                      className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                      value={source.activeContestId}
                      disabled={!editing}
                      placeholder="Active Contest ID"
                      onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, activeContestId: event.target.value }))}
                    />
                    <input
                      type="number"
                      min={2}
                      max={4}
                      className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                      value={source.minPlayers}
                      disabled={!editing}
                      onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, minPlayers: event.target.value }))}
                    />
                    <input
                      type="number"
                      min={2}
                      max={4}
                      className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                      value={source.maxPlayers}
                      disabled={!editing}
                      onChange={(event) => setEditingTableDraft((prev) => ({ ...prev, maxPlayers: event.target.value }))}
                    />
                  </div>

                  <div className="mt-3 text-xs text-white/60">
                    Seats: {table.currentPlayerCount}/{table.maxPlayers} | Status: {table.status}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {editing ? (
                      <>
                        <Button size="sm" isLoading={busy} onClick={() => void handleUpdateTable(table._id)}>
                          Save
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
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleResetTable(table._id)}>
                      Reset
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => void handleDeleteTable(table._id)}>
                      Delete
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'contests' && (
        <section className="space-y-5">
          <div className="rt-panel-strong rounded-2xl p-5">
            <h2 className="text-2xl rt-page-title mb-4">Create Cash Crown Contest</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="number"
                min={1}
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Entry Fee"
                value={contestDraft.entryFee}
                onChange={(event) => setContestDraft((prev) => ({ ...prev, entryFee: event.target.value }))}
              />
              <input
                type="number"
                min={2}
                max={4}
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Player Count (2-4)"
                value={contestDraft.playerCount}
                onChange={(event) => setContestDraft((prev) => ({ ...prev, playerCount: event.target.value }))}
              />
              <input
                type="number"
                min={0}
                className="h-11 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Platform Fee"
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

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-white/60 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Contest</th>
                  <th className="py-3 px-4">Entry / Pool</th>
                  <th className="py-3 px-4">Seats</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {contests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-white/55">
                      No contests created yet.
                    </td>
                  </tr>
                ) : (
                  contests.map((contest) => {
                    const busy = contestActionId === contest.contestId;
                    const selectedStatus = contestStatusDraft[contest.contestId] ?? contest.status;
                    return (
                      <tr key={contest._id} className="hover:bg-white/[0.03]">
                        <td className="py-4 px-4">
                          <div className="font-semibold text-white">{contest.contestId}</div>
                          <div className="text-xs text-white/50">{MODE_LABELS.USD_CONTEST}</div>
                        </td>
                        <td className="py-4 px-4 text-white/75">
                          <div>${contest.entryFee.toFixed(2)} entry</div>
                          <div className="text-xs text-white/50">
                            Pool ${contest.prizePool.toFixed(2)} | Fee ${contest.platformFee.toFixed(2)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-white/75">
                          {contest.participants.length}/{contest.playerCount}
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
                        <td className="py-4 px-4 text-white/55 text-sm">
                          {new Date(contest.createdAt).toLocaleString()}
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
        </section>
      )}

      {activeTab === 'withdrawals' && (
        <section className="rt-panel-strong rounded-2xl p-4 sm:p-6">
          <h2 className="text-2xl rt-page-title mb-4">Pending Withdrawals</h2>
          <div className="mb-4 text-sm text-white/60">
            Pending requests: {pendingWithdrawals.length} | Pending amount: ${pendingWithdrawalAmount.toFixed(2)}
          </div>
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
                {pendingWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-white/55">
                      No pending withdrawals.
                    </td>
                  </tr>
                ) : (
                  pendingWithdrawals.map((req) => {
                    const processing = processingWithdrawalId === req._id;
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
                              onClick={() => void handleProcessWithdrawal(req._id, 'reject')}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              disabled={processing}
                              onClick={() => void handleProcessWithdrawal(req._id, 'approve')}
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
    </div>
  );
};

export default Admin;
