import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  RefreshCw,
  Search,
  Shield,
  Table,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  adminApi,
  AdminAuditRecord,
  AdminTable,
  AdminTableStatusFilter,
  AdminMetrics,
  AdminUser,
  AdminWallet,
  AdminWalletSearchResult,
  AdminWithdrawal,
} from '../api/admin';
import { useAuthStore } from '../store/authStore';
import { USER_ROLES, UserRole, roleAtLeast } from '../types/roles';

type AdminSection =
  | 'dashboard'
  | 'users'
  | 'wallets'
  | 'withdrawals'
  | 'tables'
  | 'tournaments'
  | 'metrics'
  | 'audits';

interface UserProfilePayload {
  user: AdminUser;
  wallet: AdminWallet;
  transactions: any[];
}

interface WalletAdjustDraft {
  amount: string;
  reason: string;
  currency: 'USD' | 'RTC';
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (() => Promise<void>) | null;
}

const SECTIONS: Array<{ id: AdminSection; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { id: 'wallets', label: 'Wallets', icon: <Wallet className="h-4 w-4" /> },
  { id: 'withdrawals', label: 'Withdrawals', icon: <BadgeDollarSign className="h-4 w-4" /> },
  { id: 'tables', label: 'Tables', icon: <Table className="h-4 w-4" /> },
  { id: 'tournaments', label: 'Tournaments', icon: <Trophy className="h-4 w-4" /> },
  { id: 'metrics', label: 'System Metrics', icon: <Activity className="h-4 w-4" /> },
  { id: 'audits', label: 'Audit Logs', icon: <Shield className="h-4 w-4" /> },
];

const INITIAL_LOADING: Record<AdminSection, boolean> = {
  dashboard: false,
  users: false,
  wallets: false,
  withdrawals: false,
  tables: false,
  tournaments: false,
  metrics: false,
  audits: false,
};

const getErrorMessage = (error: any, fallback: string) => error?.response?.data?.message || fallback;

const formatCurrency = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (value?: string | number | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString();
};

const roleBadgeClass = (role: UserRole) => {
  switch (role) {
    case 'superadmin':
      return 'bg-red-500/20 text-red-200';
    case 'admin':
      return 'bg-orange-500/20 text-orange-200';
    case 'finance':
      return 'bg-emerald-500/20 text-emerald-200';
    case 'moderator':
      return 'bg-sky-500/20 text-sky-200';
    default:
      return 'bg-white/10 text-white/70';
  }
};

const statusChipClass = (status: string) => {
  if (status === 'in-game' || status === 'in-progress') return 'bg-emerald-500/20 text-emerald-200';
  if (status === 'waiting') return 'bg-sky-500/20 text-sky-200';
  if (status === 'pending') return 'bg-amber-500/20 text-amber-200';
  if (status === 'approved' || status === 'fulfilled') return 'bg-emerald-500/20 text-emerald-200';
  if (status === 'rejected') return 'bg-rose-500/20 text-rose-200';
  return 'bg-white/10 text-white/70';
};

const ConfirmDialog: React.FC<{
  state: ConfirmState;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ state, pending, onClose, onConfirm }) => {
  return (
    <AnimatePresence>
      {state.isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d1118] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Confirmation</div>
            <h3 className="mt-2 text-2xl rt-page-title">{state.title}</h3>
            <p className="mt-3 text-sm text-white/70">{state.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant={state.danger ? 'danger' : 'primary'}
                onClick={onConfirm}
                isLoading={pending}
              >
                {state.confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const WalletAdjustModal: React.FC<{
  open: boolean;
  draft: WalletAdjustDraft;
  onChange: (next: WalletAdjustDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  targetUserId: string;
}> = ({ open, draft, onChange, onClose, onSubmit, pending, targetUserId }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#0d1118] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">Wallet Adjustment</div>
            <h3 className="mt-2 text-2xl rt-page-title">Confirm Balance Change</h3>
            <p className="mt-2 text-sm text-white/70">User ID: {targetUserId || '--'}</p>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/60">Currency</label>
                <select
                  className="flex h-11 w-full rounded-xl border border-white/14 bg-black/35 px-3 py-2 text-sm text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                  value={draft.currency}
                  onChange={(event) => onChange({ ...draft, currency: event.target.value as 'USD' | 'RTC' })}
                >
                  <option value="USD">USD</option>
                  <option value="RTC">RTC</option>
                </select>
              </div>
              <Input
                label={`Amount (+/- ${draft.currency})`}
                type="number"
                value={draft.amount}
                onChange={(event) => onChange({ ...draft, amount: event.target.value })}
              />
              <Input
                label="Reason"
                value={draft.reason}
                onChange={(event) => onChange({ ...draft, reason: event.target.value })}
              />
            </div>
            <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">
              This action is audited with before/after state and operator identity.
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={onSubmit} isLoading={pending}>
                Apply Adjustment
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Admin: React.FC = () => {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [loading, setLoading] = useState<Record<AdminSection, boolean>>(INITIAL_LOADING);
  const [actionPending, setActionPending] = useState(false);

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<UserProfilePayload | null>(null);

  const [walletLookupQuery, setWalletLookupQuery] = useState('');
  const [walletLookupUserId, setWalletLookupUserId] = useState('');
  const [walletSearchResults, setWalletSearchResults] = useState<AdminWalletSearchResult[]>([]);
  const [walletProfile, setWalletProfile] = useState<UserProfilePayload | null>(null);
  const [walletAdjustOpen, setWalletAdjustOpen] = useState(false);
  const [walletAdjustDraft, setWalletAdjustDraft] = useState<WalletAdjustDraft>({ amount: '', reason: '', currency: 'USD' });

  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [withdrawalStatus, setWithdrawalStatus] = useState('pending');

  const [tables, setTables] = useState<AdminTable[]>([]);
  const [tableStatusFilter, setTableStatusFilter] = useState<AdminTableStatusFilter>('all');
  const [matchLookupId, setMatchLookupId] = useState('');
  const [matchDetails, setMatchDetails] = useState<any>(null);

  const [tournaments, setTournaments] = useState<any[]>([]);

  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditAdminFilter, setAuditAdminFilter] = useState('');
  const [auditResponse, setAuditResponse] = useState<{ records: AdminAuditRecord[]; total: number; page: number; limit: number } | null>(null);

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: null,
  });

  const currentRole = user?.role ?? 'user';
  const canAdmin = roleAtLeast(currentRole, 'admin');
  const canFinance = roleAtLeast(currentRole, 'finance');
  const isSuperAdmin = currentRole === 'superadmin';

  const availableSections = useMemo(() => {
    if (canAdmin) {
      return SECTIONS;
    }
    if (canFinance) {
      return SECTIONS.filter((section) => section.id === 'wallets' || section.id === 'withdrawals');
    }
    return [];
  }, [canAdmin, canFinance]);

  useEffect(() => {
    if (availableSections.length === 0) return;
    if (!availableSections.some((section) => section.id === activeSection)) {
      setActiveSection(availableSections[0].id);
    }
  }, [activeSection, availableSections]);

  const setSectionLoading = (section: AdminSection, value: boolean) => {
    setLoading((prev) => ({ ...prev, [section]: value }));
  };

  const openConfirm = (
    title: string,
    message: string,
    onConfirm: () => Promise<void>,
    options?: { danger?: boolean; confirmLabel?: string }
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm,
      danger: options?.danger,
      confirmLabel: options?.confirmLabel || 'Confirm',
    });
  };

  const closeConfirm = () => {
    if (actionPending) return;
    setConfirmState({ isOpen: false, title: '', message: '', confirmLabel: 'Confirm', onConfirm: null });
  };

  const runConfirmAction = async () => {
    if (!confirmState.onConfirm) return;
    setActionPending(true);
    try {
      await confirmState.onConfirm();
      closeConfirm();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Action failed.'));
    } finally {
      setActionPending(false);
    }
  };

  const loadMetrics = useCallback(async () => {
    setSectionLoading('dashboard', true);
    try {
      const payload = await adminApi.getSystemMetrics();
      setMetrics(payload);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load metrics.'));
    } finally {
      setSectionLoading('dashboard', false);
    }
  }, []);

  const loadUsers = useCallback(async (query: string) => {
    setSectionLoading('users', true);
    try {
      const list = await adminApi.searchUsers(query);
      setUsers(list);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to search users.'));
    } finally {
      setSectionLoading('users', false);
    }
  }, []);

  const loadUserProfile = useCallback(async (id: string) => {
    setSectionLoading('users', true);
    try {
      const payload = await adminApi.getUser(id);
      setSelectedProfile(payload);
      setWalletLookupQuery(payload.user.username || payload.user.email);
      setWalletLookupUserId(payload.user.id);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load user profile.'));
    } finally {
      setSectionLoading('users', false);
    }
  }, []);

  const searchWallets = useCallback(async (query: string) => {
    setSectionLoading('wallets', true);
    try {
      const results = await adminApi.searchWallets(query.trim());
      setWalletSearchResults(results);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to search wallets.'));
    } finally {
      setSectionLoading('wallets', false);
    }
  }, []);

  const loadWalletProfile = useCallback(async (userId: string) => {
    if (!userId.trim()) {
      toast.error('User ID is required.');
      return;
    }

    setSectionLoading('wallets', true);
    try {
      const safeUserId = userId.trim();
      const payload = await adminApi.getWallet(safeUserId);
      setWalletLookupUserId(safeUserId);
      setWalletProfile(payload);
      setWalletLookupQuery(payload.user.username || payload.user.email);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load wallet details.'));
    } finally {
      setSectionLoading('wallets', false);
    }
  }, []);

  const loadWithdrawals = useCallback(async (status: string) => {
    setSectionLoading('withdrawals', true);
    try {
      const list = await adminApi.getWithdrawals(status);
      setWithdrawals(list);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load withdrawals.'));
    } finally {
      setSectionLoading('withdrawals', false);
    }
  }, []);

  const loadTables = useCallback(async (status: AdminTableStatusFilter = 'all') => {
    setSectionLoading('tables', true);
    try {
      const list = await adminApi.getTables(status);
      setTables(list);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load tables.'));
    } finally {
      setSectionLoading('tables', false);
    }
  }, []);

  const loadTournaments = useCallback(async () => {
    setSectionLoading('tournaments', true);
    try {
      const list = await adminApi.getTournaments();
      setTournaments(list);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load tournaments.'));
    } finally {
      setSectionLoading('tournaments', false);
    }
  }, []);

  const loadAudits = useCallback(async (page: number, action: string, adminUserId: string) => {
    setSectionLoading('audits', true);
    try {
      const payload = await adminApi.getAudits({ page, limit: 12, action: action || undefined, adminUserId: adminUserId || undefined });
      setAuditResponse(payload);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load audit logs.'));
    } finally {
      setSectionLoading('audits', false);
    }
  }, []);

  useEffect(() => {
    if (canAdmin) {
      void loadMetrics();
      void loadUsers('');
      void loadTables('all');
      void loadAudits(1, '', '');
      void loadTournaments();
    }
    if (canFinance) {
      void loadWithdrawals('pending');
    }
  }, [canAdmin, canFinance, loadAudits, loadMetrics, loadTables, loadTournaments, loadUsers, loadWithdrawals]);

  const pendingWithdrawalAmount = useMemo(
    () => withdrawals.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0),
    [withdrawals]
  );
  const liveTableCount = useMemo(
    () => tables.filter((table) => table.status === 'in-game').length,
    [tables]
  );
  const waitingTableCount = tables.length - liveTableCount;

  const handleBanToggle = async (target: AdminUser) => {
    await adminApi.setBanState(target.id, !target.isBanned);
    toast.success(target.isBanned ? 'User unbanned.' : 'User banned.');
    await Promise.all([loadUsers(userQuery), selectedProfile ? loadUserProfile(selectedProfile.user.id) : Promise.resolve(), loadMetrics()]);
  };

  const handleFreezeToggle = async (target: AdminUser) => {
    await adminApi.setFreezeState(target.id, !target.isFrozen);
    toast.success(target.isFrozen ? 'Account unfrozen.' : 'Account frozen.');
    await Promise.all([loadUsers(userQuery), selectedProfile ? loadUserProfile(selectedProfile.user.id) : Promise.resolve(), loadMetrics()]);
  };

  const handleRoleChange = async (target: AdminUser, role: UserRole) => {
    try {
      await adminApi.setUserRole(target.id, role);
      toast.success('Role updated.');
      await Promise.all([loadUsers(userQuery), selectedProfile ? loadUserProfile(selectedProfile.user.id) : Promise.resolve(), loadMetrics()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update role.'));
    }
  };

  const handleWalletAdjustment = async () => {
    const targetUserId = walletProfile?.user.id || walletLookupUserId;
    const amount = Number(walletAdjustDraft.amount);
    const currency = walletAdjustDraft.currency;
    if (!targetUserId) {
      toast.error('Load a wallet before adjustment.');
      return;
    }
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error('Enter a non-zero numeric amount.');
      return;
    }
    if (walletAdjustDraft.reason.trim().length < 3) {
      toast.error('Reason must be at least 3 characters.');
      return;
    }

    setActionPending(true);
    try {
      await adminApi.adjustWallet({
        userId: targetUserId,
        amount,
        reason: walletAdjustDraft.reason.trim(),
        currency,
      });
      toast.success('Wallet adjusted successfully.');
      setWalletAdjustOpen(false);
      setWalletAdjustDraft({ amount: '', reason: '', currency: 'USD' });
      await Promise.all([loadWalletProfile(targetUserId), loadMetrics()]);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to adjust wallet.'));
    } finally {
      setActionPending(false);
    }
  };

  const handleWithdrawalAction = (item: AdminWithdrawal, action: 'approve' | 'reject') => {
    openConfirm(
      `${action === 'approve' ? 'Approve' : 'Reject'} Withdrawal`,
      `${action === 'approve' ? 'Approve' : 'Reject'} ${formatCurrency(item.amount)} for ${item.username || item.userId}?`,
      async () => {
        if (action === 'approve') {
          await adminApi.approveWithdrawal(item.id);
          toast.success('Withdrawal approved.');
        } else {
          await adminApi.rejectWithdrawal(item.id);
          toast.success('Withdrawal rejected.');
        }
        await Promise.all([loadWithdrawals(withdrawalStatus), loadMetrics(), loadAudits(1, auditActionFilter, auditAdminFilter)]);
      },
      { danger: action === 'reject', confirmLabel: action === 'approve' ? 'Approve' : 'Reject' }
    );
  };

  const handleResetTable = (table: AdminTable) => {
    openConfirm(
      'Reset Table',
      `Reset ${table.name}? This clears seated players and active game state.`,
      async () => {
        await adminApi.resetTable(table.tableId);
        toast.success('Table reset completed.');
        await Promise.all([loadTables(tableStatusFilter), loadMetrics(), loadAudits(1, auditActionFilter, auditAdminFilter)]);
      },
      { danger: true, confirmLabel: 'Reset Table' }
    );
  };

  const lookupMatch = async () => {
    if (!matchLookupId.trim()) {
      toast.error('Enter a match id.');
      return;
    }

    setSectionLoading('tables', true);
    try {
      const payload = await adminApi.getMatch(matchLookupId.trim());
      setMatchDetails(payload);
      toast.success('Match loaded.');
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Unable to fetch match.'));
    } finally {
      setSectionLoading('tables', false);
    }
  };

  const renderDashboard = () => {
    return (
      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-[#121926] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Total Users</div>
            <div className="mt-2 text-3xl rt-page-title">{metrics?.users.total ?? '--'}</div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#121926] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Privileged Users</div>
            <div className="mt-2 text-3xl rt-page-title">{metrics?.users.privileged ?? '--'}</div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#121926] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Pending Withdrawals</div>
            <div className="mt-2 text-3xl rt-page-title">{metrics?.operations.pendingWithdrawals ?? '--'}</div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#121926] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Active Tables</div>
            <div className="mt-2 text-3xl rt-page-title">{metrics?.operations.activeTables ?? '--'}</div>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
            <h3 className="text-xl rt-page-title">Financial Snapshot</h3>
            <div className="mt-3 grid gap-3 text-sm text-white/75">
              <div className="flex justify-between">
                <span>Total USD Across Wallets</span>
                <span>{formatCurrency(metrics?.wallets.totalUsdBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total RTC Across Wallets</span>
                <span>{metrics?.wallets.totalRtcBalance ?? '--'}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Queue Value</span>
                <span>{formatCurrency(pendingWithdrawalAmount)}</span>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
            <h3 className="text-xl rt-page-title">Runtime</h3>
            <div className="mt-3 grid gap-2 text-sm text-white/75">
              <div className="flex justify-between">
                <span>Server Uptime</span>
                <span>{metrics?.runtime.uptimeSeconds ?? '--'}s</span>
              </div>
              <div className="flex justify-between">
                <span>Redis</span>
                <span>{metrics?.runtime.redisConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex justify-between">
                <span>Node Version</span>
                <span>{metrics?.runtime.nodeVersion ?? '--'}</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    );
  };

  const renderUsers = () => {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-xl rt-page-title">User Search</h3>
              <p className="text-xs text-white/55">Search by username or email.</p>
            </div>
            <div className="flex w-full max-w-md items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                <input
                  className="h-10 w-full rounded-xl border border-white/14 bg-black/35 pl-9 pr-3 text-sm text-white"
                  placeholder="Find user"
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                />
              </div>
              <Button size="sm" onClick={() => void loadUsers(userQuery)} isLoading={loading.users}>
                Search
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1622]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-white/50">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{item.username}</div>
                      <div className="text-xs text-white/55">{item.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${roleBadgeClass(item.role)}`}>{item.role}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/70">
                      {item.isBanned ? 'Banned' : 'Active'} / {item.isFrozen ? 'Frozen' : 'Live'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => void loadUserProfile(item.id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-white/50">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
            <h3 className="text-xl rt-page-title">Profile Actions</h3>
            {!selectedProfile ? (
              <p className="mt-4 text-sm text-white/60">Select a user to view profile controls.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="font-semibold text-white">{selectedProfile.user.username}</div>
                  <div className="text-xs text-white/55">{selectedProfile.user.email}</div>
                  <div className="mt-2 text-xs text-white/65">Wallet: {formatCurrency(selectedProfile.wallet.usdBalance)}</div>
                </div>
                <div className="grid gap-2">
                  <Button
                    variant={selectedProfile.user.isBanned ? 'secondary' : 'danger'}
                    onClick={() =>
                      openConfirm(
                        selectedProfile.user.isBanned ? 'Unban User' : 'Ban User',
                        `${selectedProfile.user.isBanned ? 'Restore' : 'Block'} ${selectedProfile.user.username}?`,
                        () => handleBanToggle(selectedProfile.user),
                        { danger: !selectedProfile.user.isBanned, confirmLabel: selectedProfile.user.isBanned ? 'Unban' : 'Ban' }
                      )
                    }
                  >
                    {selectedProfile.user.isBanned ? 'Unban' : 'Ban'} User
                  </Button>
                  <Button
                    variant={selectedProfile.user.isFrozen ? 'secondary' : 'danger'}
                    onClick={() =>
                      openConfirm(
                        selectedProfile.user.isFrozen ? 'Unfreeze User' : 'Freeze User',
                        `${selectedProfile.user.isFrozen ? 'Unfreeze' : 'Freeze'} wallet/gameplay access for ${selectedProfile.user.username}?`,
                        () => handleFreezeToggle(selectedProfile.user),
                        { danger: !selectedProfile.user.isFrozen, confirmLabel: selectedProfile.user.isFrozen ? 'Unfreeze' : 'Freeze' }
                      )
                    }
                  >
                    {selectedProfile.user.isFrozen ? 'Unfreeze' : 'Freeze'} User
                  </Button>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.14em] text-white/50">Change Role</div>
                  <select
                    className="h-10 w-full rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                    value={selectedProfile.user.role}
                    disabled={!isSuperAdmin}
                    onChange={(event) => {
                      const nextRole = event.target.value as UserRole;
                      if (!isSuperAdmin) return;
                      void handleRoleChange(selectedProfile.user, nextRole);
                    }}
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  {!isSuperAdmin && <div className="mt-2 text-xs text-white/45">Only superadmin can change roles.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderWallets = () => {
    const activeWallet = walletProfile?.wallet;

    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-xl rt-page-title">Wallet Inspection</h3>
              <p className="text-xs text-white/55">Search wallets by username/email, then adjust balances safely.</p>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Input
                label="Username or Email"
                value={walletLookupQuery}
                onChange={(event) => setWalletLookupQuery(event.target.value)}
              />
              <Button size="sm" onClick={() => void searchWallets(walletLookupQuery)} isLoading={loading.wallets}>
                Search Wallets
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Input
                label="Direct User ID (Optional)"
                value={walletLookupUserId}
                onChange={(event) => setWalletLookupUserId(event.target.value)}
              />
              <Button size="sm" variant="secondary" onClick={() => void loadWalletProfile(walletLookupUserId)} isLoading={loading.wallets}>
                Load by ID
              </Button>
            </div>
          </div>
        </div>

        {walletSearchResults.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1622]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-white/50">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">USD</th>
                  <th className="px-4 py-3">RTC</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {walletSearchResults.map((item) => (
                  <tr key={item.user.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{item.user.username}</div>
                      <div className="text-xs text-white/55">{item.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-white/75">{formatCurrency(item.wallet.usdBalance)}</td>
                    <td className="px-4 py-3 text-white/75">{item.wallet.rtcBalance}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => void loadWalletProfile(item.user.id)}>
                        Load
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!walletProfile ? (
          <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-6 text-sm text-white/60">
            Search and load a wallet to manage balances and transaction history.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/50">Loaded Wallet</div>
              <div className="mt-2 text-lg text-white">{walletProfile.user.username}</div>
              <div className="text-xs text-white/55">{walletProfile.user.email}</div>
              <div className="mt-2 text-xs text-white/50">User ID: {walletProfile.user.id}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">USD Balance</div>
                <div className="mt-2 text-2xl rt-page-title">{formatCurrency(activeWallet?.usdBalance)}</div>
              </article>
              <article className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">RTC Balance</div>
                <div className="mt-2 text-2xl rt-page-title">{activeWallet?.rtcBalance ?? '--'}</div>
              </article>
              <article className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">Pending Withdrawals</div>
                <div className="mt-2 text-2xl rt-page-title">{formatCurrency(activeWallet?.pendingWithdrawals)}</div>
              </article>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl rt-page-title">Adjust Balance</h3>
                  <p className="text-xs text-white/55">Requires reason and confirmation.</p>
                </div>
                <Button size="sm" onClick={() => setWalletAdjustOpen(true)}>
                  Adjust Wallet
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1622]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-white/50">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {walletProfile.transactions?.map((txn: any) => (
                    <tr key={txn._id}>
                      <td className="px-4 py-3 text-white/70">{formatDate(txn.date || txn.createdAt)}</td>
                      <td className="px-4 py-3 text-white">{txn.type}</td>
                      <td className="px-4 py-3 text-white/80">{txn.currency === 'USD' ? formatCurrency(txn.amount) : txn.amount}</td>
                      <td className="px-4 py-3 text-white/65">{txn.status}</td>
                    </tr>
                  ))}
                  {(!walletProfile.transactions || walletProfile.transactions.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-white/50">
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    );
  };

  const renderWithdrawals = () => {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-xl rt-page-title">Withdrawal Queue</h3>
              <p className="text-xs text-white/55">Review and process payout requests.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                value={withdrawalStatus}
                onChange={(event) => {
                  const status = event.target.value;
                  setWithdrawalStatus(status);
                  void loadWithdrawals(status);
                }}
              >
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="all">all</option>
              </select>
              <Button size="sm" variant="secondary" onClick={() => void loadWithdrawals(withdrawalStatus)} isLoading={loading.withdrawals}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1622]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-white/50">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Payout</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {withdrawals.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{item.username || item.userId}</div>
                    <div className="text-xs text-white/55">{item.email}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-amber-200">{formatCurrency(item.amount)}</td>
                  <td className="px-4 py-3 text-white/70">{item.payoutMethod}</td>
                  <td className="px-4 py-3 text-white/60">{item.payoutAddressMasked}</td>
                  <td className="px-4 py-3 text-white/60">{formatDate(item.requestedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${statusChipClass(item.status)}`}>{item.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="danger" onClick={() => handleWithdrawalAction(item, 'reject')}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => handleWithdrawalAction(item, 'approve')}>
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-white/45">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/50">
                    No withdrawals in this status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderTables = () => {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-xl rt-page-title">Table Operations</h3>
              <p className="text-xs text-white/55">View live and non-live tables and reset table runtime state.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                value={tableStatusFilter}
                onChange={(event) => {
                  const status = event.target.value as AdminTableStatusFilter;
                  setTableStatusFilter(status);
                  void loadTables(status);
                }}
              >
                <option value="all">all tables</option>
                <option value="in-game">live only</option>
                <option value="waiting">non-live only</option>
              </select>
              <Button size="sm" variant="secondary" onClick={() => void loadTables(tableStatusFilter)} isLoading={loading.tables}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Total Tables</div>
            <div className="mt-2 text-2xl rt-page-title">{tables.length}</div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Live Tables</div>
            <div className="mt-2 text-2xl rt-page-title">{liveTableCount}</div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/50">Non-Live Tables</div>
            <div className="mt-2 text-2xl rt-page-title">{waitingTableCount}</div>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {tables.map((table) => (
            <article key={table.tableId} className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg rt-page-title">{table.name}</h4>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${statusChipClass(table.status)}`}>{table.status}</span>
                    <span className="text-white/55">{table.mode} | Stake {formatCurrency(table.stake)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-white/70">
                <div>Players seated: {table.currentPlayerCount}/{table.maxPlayers}</div>
                <div>Min players: {table.minPlayers}</div>
                <div>Current pot: {formatCurrency(table.currentPot)}</div>
                <div>Turn: {table.turnState?.turn ?? '--'} ({table.turnState?.status || 'no game state'})</div>
                <div>Current player: {table.turnState?.currentPlayerUsername || '--'}</div>
                <div>Time remaining: {table.turnState?.turnTimeRemainingMs ? `${Math.ceil(table.turnState.turnTimeRemainingMs / 1000)}s` : '--'}</div>
                <div>Updated: {formatDate(table.updatedAt)}</div>
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                {table.playersSeated.map((player) => player.username).join(', ') || 'No players listed'}
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="danger" onClick={() => handleResetTable(table)}>
                  Reset Table
                </Button>
              </div>
            </article>
          ))}
          {tables.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-6 text-sm text-white/55">
              No tables found in this filter.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
          <h3 className="text-xl rt-page-title">Match Lookup</h3>
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
            <input
              className="h-10 flex-1 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
              value={matchLookupId}
              placeholder="Match ID"
              onChange={(event) => setMatchLookupId(event.target.value)}
            />
            <Button size="sm" onClick={() => void lookupMatch()} isLoading={loading.tables}>
              Fetch Match
            </Button>
          </div>
          {matchDetails && (
            <pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
              {JSON.stringify(matchDetails, null, 2)}
            </pre>
          )}
        </div>
      </section>
    );
  };
  const renderTournaments = () => {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl rt-page-title">Tournament Sessions</h3>
            <p className="text-xs text-white/55">Cash Crown contest lifecycle overview.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadTournaments()} isLoading={loading.tournaments}>
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1622]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-white/50">
              <tr>
                <th className="px-4 py-3">Contest</th>
                <th className="px-4 py-3">Entry Fee</th>
                <th className="px-4 py-3">Players</th>
                <th className="px-4 py-3">Prize Pool</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {tournaments.map((item: any) => (
                <tr key={item._id}>
                  <td className="px-4 py-3 text-white">{item.contestId}</td>
                  <td className="px-4 py-3 text-white/70">{formatCurrency(item.entryFee)}</td>
                  <td className="px-4 py-3 text-white/70">{item.participants?.length ?? 0}/{item.playerCount}</td>
                  <td className="px-4 py-3 text-white/70">{formatCurrency(item.prizePool)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${statusChipClass(item.status)}`}>{item.status}</span>
                  </td>
                  <td className="px-4 py-3 text-white/60">{formatDate(item.createdAt)}</td>
                </tr>
              ))}
              {tournaments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-white/50">
                    No tournaments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const renderMetrics = () => {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl rt-page-title">System Metrics</h3>
            <p className="text-xs text-white/55">Runtime, throughput, and treasury posture.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadMetrics()} isLoading={loading.metrics || loading.dashboard}>
            Refresh
          </Button>
        </div>
        <pre className="max-h-[560px] overflow-auto rounded-2xl border border-white/10 bg-[#0f1622] p-4 text-xs text-white/70">
          {JSON.stringify(metrics, null, 2)}
        </pre>
      </section>
    );
  };

  const renderAudits = () => {
    const totalPages = auditResponse ? Math.max(1, Math.ceil(auditResponse.total / auditResponse.limit)) : 1;

    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-xl rt-page-title">Audit Logs</h3>
              <p className="text-xs text-white/55">Filter by admin or action type. Data is paginated.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Action"
                value={auditActionFilter}
                onChange={(event) => setAuditActionFilter(event.target.value)}
              />
              <input
                className="h-10 rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
                placeholder="Admin User ID"
                value={auditAdminFilter}
                onChange={(event) => setAuditAdminFilter(event.target.value)}
              />
              <Button
                size="sm"
                onClick={() => {
                  setAuditPage(1);
                  void loadAudits(1, auditActionFilter, auditAdminFilter);
                }}
                isLoading={loading.audits}
              >
                Filter
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f1622]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-white/50">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {auditResponse?.records.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-3 text-white/70">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{item.adminUserId?.username || item.adminRole}</div>
                    <div className="text-xs text-white/55">{item.adminRole}</div>
                  </td>
                  <td className="px-4 py-3 text-white/75">{item.action}</td>
                  <td className="px-4 py-3 text-white/65">{item.targetType} {item.targetId ? `• ${item.targetId}` : ''}</td>
                  <td className="px-4 py-3 text-white/55">{item.ipAddress || '--'}</td>
                </tr>
              ))}
              {(!auditResponse || auditResponse.records.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-white/50">
                    No audit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0f1622] px-4 py-3 text-sm text-white/70">
          <div>Page {auditResponse?.page || 1} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={(auditResponse?.page || 1) <= 1}
              onClick={() => {
                const next = Math.max(1, (auditResponse?.page || 1) - 1);
                setAuditPage(next);
                void loadAudits(next, auditActionFilter, auditAdminFilter);
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={(auditResponse?.page || 1) >= totalPages}
              onClick={() => {
                const next = Math.min(totalPages, (auditResponse?.page || 1) + 1);
                setAuditPage(next);
                void loadAudits(next, auditActionFilter, auditAdminFilter);
              }}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    );
  };

  const renderActiveSection = () => {
    if (!availableSections.some((section) => section.id === activeSection)) {
      if (availableSections.length === 0) {
        return (
          <div className="rounded-2xl border border-white/10 bg-[#0f1622] p-6 text-sm text-white/60">
            No admin sections are available for this role.
          </div>
        );
      }
      return null;
    }
    if (activeSection === 'dashboard') return renderDashboard();
    if (activeSection === 'users') return renderUsers();
    if (activeSection === 'wallets') return renderWallets();
    if (activeSection === 'withdrawals') return renderWithdrawals();
    if (activeSection === 'tables') return renderTables();
    if (activeSection === 'tournaments') return renderTournaments();
    if (activeSection === 'metrics') return renderMetrics();
    return renderAudits();
  };

  return (
    <div className="relative min-h-[78vh] overflow-hidden rounded-3xl border border-white/10 bg-[#090d14]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_360px_at_10%_0%,rgba(0,196,255,0.15),transparent_66%),radial-gradient(780px_340px_at_90%_6%,rgba(41,255,160,0.14),transparent_64%),linear-gradient(180deg,#070a11,#0b111a_55%,#070a11)]" />
      <div className="grid min-h-[78vh] lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-white/10 bg-[#0b111a]/85 p-4 backdrop-blur-xl">
          <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Admin Ops</div>
            <h1 className="mt-2 text-2xl rt-page-title">Operations Panel</h1>
            <p className="mt-2 text-xs text-white/55">Secure controls for platform, funds, and live sessions.</p>
          </div>

          <nav className="space-y-1">
            {availableSections.map((section) => {
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-cyan-400/20 text-cyan-100 border border-cyan-300/35'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.icon}
                  {section.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="p-4 md:p-6">
          <header className="mb-5 rounded-2xl border border-white/10 bg-[#0f1622] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">Active Section</div>
                <h2 className="text-2xl rt-page-title">
                  {(availableSections.find((item) => item.id === activeSection) ?? SECTIONS.find((item) => item.id === activeSection))?.label}
                </h2>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (activeSection === 'dashboard' || activeSection === 'metrics') void loadMetrics();
                  if (activeSection === 'users') void loadUsers(userQuery);
                  if (activeSection === 'wallets') void loadWalletProfile(walletLookupUserId || walletProfile?.user.id || '');
                  if (activeSection === 'withdrawals') void loadWithdrawals(withdrawalStatus);
                  if (activeSection === 'tables') void loadTables(tableStatusFilter);
                  if (activeSection === 'tournaments') void loadTournaments();
                  if (activeSection === 'audits') void loadAudits(auditPage, auditActionFilter, auditAdminFilter);
                }}
              >
                <RefreshCw className="mr-1 h-4 w-4" /> Refresh
              </Button>
            </div>
          </header>

          {renderActiveSection()}
        </main>
      </div>

      <ConfirmDialog state={confirmState} pending={actionPending} onClose={closeConfirm} onConfirm={() => void runConfirmAction()} />

      <WalletAdjustModal
        open={walletAdjustOpen}
        draft={walletAdjustDraft}
        onChange={setWalletAdjustDraft}
        onClose={() => {
          if (!actionPending) {
            setWalletAdjustOpen(false);
          }
        }}
        onSubmit={() => void handleWalletAdjustment()}
        pending={actionPending}
        targetUserId={walletProfile?.user.id || walletLookupUserId}
      />
    </div>
  );
};

export default Admin;
