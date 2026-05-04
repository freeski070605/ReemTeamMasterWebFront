import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
import { AccountStats, createCheckout, getAccountStats } from '../api/wallet';
import { createRtcCheckout, getRtcBundles, RtcPurchaseBundle, requestRtcRefill } from '../api/rtc';
import { cancelVipSubscription, createVipCheckout } from '../api/vip';
import TransactionHistory from '../components/wallet/TransactionHistory';
import PayoutForm from '../components/wallet/PayoutForm';
import PlayerAvatar from '../components/game/PlayerAvatar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { DEFAULT_AVATAR_PATHS } from '../constants/avatars';
import { resolveAvatarUrl } from '../utils/avatar';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { formatRTCCompactAmount } from '../utils/rtcCurrency';

const QUICK_DEPOSIT_AMOUNTS = [25, 50, 100, 250];

const formatUsdBalance = (amount: number | null): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount ?? 0);
};

const formatRtcBalance = (amount: number | null): string => {
  return formatRTCCompactAmount(amount);
};

const formatVipDate = (value?: string | null): string => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const Account: React.FC = () => {
  const { user, uploadAvatar, selectDefaultAvatar, refreshVipStatus } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);
  const [customDeposit, setCustomDeposit] = useState('');
  const [rtcBundles, setRtcBundles] = useState<RtcPurchaseBundle[]>([]);
  const [rtcBundlesLoading, setRtcBundlesLoading] = useState(true);
  const [rtcBundlesError, setRtcBundlesError] = useState<string | null>(null);
  const [purchasingBundleId, setPurchasingBundleId] = useState<string | null>(null);
  const [rtcRefillLoading, setRtcRefillLoading] = useState(false);
  const [rtcRefillNextEligibleAt, setRtcRefillNextEligibleAt] = useState<string | null>(null);
  const [vipCheckoutLoading, setVipCheckoutLoading] = useState(false);
  const [vipCancelOpen, setVipCancelOpen] = useState(false);
  const [vipCanceling, setVipCanceling] = useState(false);
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);
  const [accountStatsLoading, setAccountStatsLoading] = useState(true);
  const [accountStatsError, setAccountStatsError] = useState<string | null>(null);
  const {
    balance: usdBalance,
    loading: usdBalanceLoading,
    error: usdBalanceError,
    refresh: refreshUsdBalance,
  } = useWalletBalance({ currency: 'usd', refreshIntervalMs: 15000 });
  const {
    balance: rtcBalance,
    loading: rtcBalanceLoading,
    error: rtcBalanceError,
    refresh: refreshRtcBalance,
  } = useWalletBalance({ currency: 'rtc', refreshIntervalMs: 15000 });

  useEffect(() => {
    const paymentStatus = searchParams.get('paymentStatus');
    const paymentType = searchParams.get('paymentType');
    if (!paymentStatus) {
      return;
    }

    if (paymentStatus === 'success') {
      if (paymentType === 'rtc') {
        toast.success('RTC purchase complete. Your balance is refreshing.');
      } else if (paymentType === 'vip') {
        toast.success('VIP subscription active. Private tables unlocked.');
        void refreshVipStatus(true);
      } else {
        toast.success('Deposit complete. Your balance is refreshing.');
      }
      window.dispatchEvent(new Event('wallet-balance-refresh'));
      void Promise.all([refreshUsdBalance(), refreshRtcBalance()]);
    } else {
      toast.info(`Checkout status: ${paymentStatus}`);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('paymentStatus');
    nextParams.delete('paymentType');
    nextParams.delete('bundleId');
    nextParams.delete('userId');
    nextParams.delete('amount');
    setSearchParams(nextParams, { replace: true });
  }, [refreshRtcBalance, refreshUsdBalance, refreshVipStatus, searchParams, setSearchParams]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setFile(event.target.files[0]);
      return;
    }
    setFile(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    await uploadAvatar(file);
    setFile(null);
  };

  const handleDeposit = async (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid deposit amount.');
      return;
    }

    setDepositBusy(true);
    try {
      const checkoutUrl = await createCheckout(amount);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      toast.error('Failed to start checkout.');
    } catch (error) {
      console.error('Deposit error:', error);
      const apiMessage =
        (error as any)?.response?.data?.errors?.[0]?.detail ||
        (error as any)?.response?.data?.message;
      toast.error(apiMessage || 'Failed to initiate deposit.');
    } finally {
      setDepositBusy(false);
    }
  };

  const handleCustomDeposit = () => {
    const amount = Number(customDeposit);
    void handleDeposit(amount);
  };

  const fetchRtcBundles = useCallback(async () => {
    try {
      setRtcBundlesLoading(true);
      setRtcBundlesError(null);
      const bundles = await getRtcBundles();
      setRtcBundles(bundles);
    } catch (error: any) {
      setRtcBundles([]);
      setRtcBundlesError(error?.response?.data?.message || 'Failed to load Reem Team Cash bundles.');
    } finally {
      setRtcBundlesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRtcBundles();
  }, [fetchRtcBundles]);

  useEffect(() => {
    void refreshVipStatus();
  }, [refreshVipStatus]);

  const fetchAccountStats = useCallback(async () => {
    try {
      setAccountStatsLoading(true);
      setAccountStatsError(null);
      const nextStats = await getAccountStats();
      setAccountStats(nextStats);
    } catch (error: any) {
      setAccountStats(null);
      setAccountStatsError(error?.response?.data?.message || 'Failed to load account stats.');
    } finally {
      setAccountStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccountStats();
  }, [fetchAccountStats]);

  const handleRtcPurchase = async (bundleId: string) => {
    setPurchasingBundleId(bundleId);
    try {
      const checkoutUrl = await createRtcCheckout(bundleId);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      toast.error('Failed to start RTC checkout.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not start Reem Team Cash checkout.');
    } finally {
      setPurchasingBundleId(null);
    }
  };

  const handleRtcRefill = async () => {
    setRtcRefillLoading(true);
    try {
      const result = await requestRtcRefill();
      setRtcRefillNextEligibleAt(result.nextEligibleAt);
      if (result.refilled) {
        toast.success(`Daily RTC boost claimed: +${formatRTCCompactAmount(result.refillAmount)} RTC`);
      } else {
        toast.info('Daily RTC boost already claimed. Check back later.');
      }
      window.dispatchEvent(new Event('wallet-balance-refresh'));
      void refreshRtcBalance();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not claim daily RTC.');
    } finally {
      setRtcRefillLoading(false);
    }
  };

  const handleVipCheckout = async () => {
    if (isVipActive) {
      toast.info('VIP is already active on your account.');
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
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not start VIP checkout.');
    } finally {
      setVipCheckoutLoading(false);
    }
  };

  const handleVipCancel = async () => {
    if (vipCanceling) {
      return;
    }
    setVipCanceling(true);
    try {
      await cancelVipSubscription();
      toast.success('VIP cancellation scheduled. Access remains until your billing period ends.');
      setVipCancelOpen(false);
      void refreshVipStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not cancel VIP.');
    } finally {
      setVipCanceling(false);
    }
  };

  const handleVipSync = async () => {
    if (vipCheckoutLoading || vipCanceling) {
      return;
    }
    try {
      await refreshVipStatus(true);
      toast.success('VIP status synced.');
    } catch {
      toast.error('Could not sync VIP status.');
    }
  };

  const bestValueBundleId = useMemo(() => {
    return rtcBundles.reduce<{ id: string; ratio: number } | null>((best, bundle) => {
      const ratio = bundle.usdPrice > 0 ? bundle.rtcAmount / bundle.usdPrice : 0;
      if (!best || ratio > best.ratio) {
        return { id: bundle.id, ratio };
      }
      return best;
    }, null)?.id ?? null;
  }, [rtcBundles]);

  const resolvedCurrentAvatar = useMemo(() => {
    if (!user?.avatarUrl) {
      return '';
    }
    return resolveAvatarUrl(user.avatarUrl) || user.avatarUrl;
  }, [user?.avatarUrl]);

  const hasCustomAvatar = useMemo(() => {
    if (!user?.avatarUrl) {
      return false;
    }

    return !DEFAULT_AVATAR_PATHS.some((path) => {
      const resolvedDefaultPath = resolveAvatarUrl(path) || path;
      return user.avatarUrl === path || resolvedCurrentAvatar === resolvedDefaultPath;
    });
  }, [resolvedCurrentAvatar, user?.avatarUrl]);

  const walletSyncLabel = useMemo(() => {
    if (usdBalanceError || rtcBalanceError) {
      return 'Sync issue';
    }
    if (usdBalanceLoading || rtcBalanceLoading) {
      return 'Syncing';
    }
    return 'Live';
  }, [rtcBalanceError, rtcBalanceLoading, usdBalanceError, usdBalanceLoading]);

  const vipStatus = (user?.vipStatus || 'NONE').toUpperCase();
  const vipStatusLabel = useMemo(() => {
    switch (vipStatus) {
      case 'ACTIVE':
        return 'Active';
      case 'PENDING':
        return 'Pending Activation';
      case 'PAUSED':
        return 'Paused';
      case 'CANCELED':
        return 'Canceled';
      case 'DEACTIVATED':
        return 'Deactivated';
      case 'COMPLETED':
        return 'Completed';
      default:
        return 'Not Active';
    }
  }, [vipStatus]);
  const isVipActive = !!user?.isVip;
  const canCancelVip = vipStatus === 'ACTIVE' || vipStatus === 'PENDING' || vipStatus === 'PAUSED';
  const isVipCanceled = vipStatus === 'CANCELED';
  const vipRenewalLabel = useMemo(() => {
    if (!user?.vipExpiresAt) {
      return isVipActive ? 'Renewal date pending' : '--';
    }
    const formatted = formatVipDate(user.vipExpiresAt);
    if (isVipCanceled) {
      return `Access ends on ${formatted}`;
    }
    return `Renews on ${formatted}`;
  }, [isVipActive, isVipCanceled, user?.vipExpiresAt]);
  const vipSinceLabel = useMemo(() => formatVipDate(user?.vipSince ?? null), [user?.vipSince]);
  const vipBadgeClass = useMemo(() => {
    if (isVipActive || vipStatus === 'PENDING') {
      return 'border-amber-300/40 bg-amber-300/10 text-amber-200';
    }
    return 'border-white/15 bg-white/5 text-white/70';
  }, [isVipActive, vipStatus]);

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl account-aura" />

      <header className="account-reveal account-hero rt-landscape-compact-card relative overflow-hidden rounded-[30px] border border-white/15 p-7 sm:p-9">
        <div className="account-hero-pattern pointer-events-none absolute inset-0 opacity-90" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/75">
              Account Command Center
            </div>
            <h1 className="mt-4 text-4xl leading-[1.03] rt-page-title sm:text-5xl">
              {user?.username ? `${user.username}'s Wallet Lane` : 'Wallet + Identity Lane'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-white/72 sm:text-base">
              Keep both bankrolls ready, set your table identity, and control payouts from one tuned panel.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">USD Wallet</div>
                <div className="mt-2 text-2xl rt-page-title">
                  {usdBalanceLoading ? '...' : formatUsdBalance(usdBalance)}
                </div>
              </div>
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Reem Team Cash</div>
                <div className="mt-2 text-2xl rt-page-title">
                  {rtcBalanceLoading ? '...' : formatRtcBalance(rtcBalance)}
                </div>
              </div>
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Wallet Status</div>
                <div className="mt-2 text-2xl rt-page-title">{walletSyncLabel}</div>
              </div>
            </div>
          </div>

          <aside className="rt-glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/55">Session Snapshot</div>
            <div className="mt-3 text-xl rt-page-title text-white">{user?.username || 'Player'}</div>
            <p className="mt-1 text-sm text-white/65">{user?.email || 'No email loaded'}</p>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/12 bg-black/25 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">Avatar Mode</div>
                <div className="mt-1 text-sm text-white/88">{hasCustomAvatar ? 'Custom Equipped' : 'Default Equipped'}</div>
              </div>
              <div className="rounded-xl border border-white/12 bg-black/25 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">Quick Deposit Buttons</div>
                <div className="mt-1 text-sm text-white/88">{QUICK_DEPOSIT_AMOUNTS.length} Presets Ready</div>
              </div>
              <div className="rounded-xl border border-white/12 bg-black/25 px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">Tournament Lanes</div>
                <div className="mt-1 text-sm text-white/88">USD + RTC Active</div>
              </div>
            </div>
          </aside>
        </div>
      </header>

      <section className="rt-landscape-tight-gap grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-2xl p-6" style={{ animationDelay: '60ms' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Player Stats</div>
                <h2 className="mt-2 text-2xl rt-page-title">Lifetime Account Numbers</h2>
                <p className="mt-2 text-sm text-white/65">
                  A quick read on what this account has earned and how it has performed across ReemTeam tables.
                </p>
              </div>
              <span className="rounded-full border border-white/14 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.17em] text-white/70">
                {accountStatsLoading ? 'Syncing' : 'Live Summary'}
              </span>
            </div>

            {accountStatsError ? <p className="mt-4 text-sm text-red-300">{accountStatsError}</p> : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">RTC Earned</div>
                <div className="mt-2 text-2xl rt-page-title">
                  {accountStatsLoading ? '...' : formatRtcBalance(accountStats?.rtcEarned ?? 0)}
                </div>
              </div>
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">USD Earned</div>
                <div className="mt-2 text-2xl rt-page-title">
                  {accountStatsLoading ? '...' : formatUsdBalance(accountStats?.usdEarned ?? 0)}
                </div>
              </div>
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Total Reems</div>
                <div className="mt-2 text-2xl rt-page-title">
                  {accountStatsLoading ? '...' : (accountStats?.totalReems ?? 0).toLocaleString('en-US')}
                </div>
              </div>
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Total Wins</div>
                <div className="mt-2 text-2xl rt-page-title">
                  {accountStatsLoading ? '...' : (accountStats?.totalWins ?? 0).toLocaleString('en-US')}
                </div>
              </div>
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Matches Played</div>
                <div className="mt-2 text-2xl rt-page-title">
                  {accountStatsLoading ? '...' : (accountStats?.matchesPlayed ?? 0).toLocaleString('en-US')}
                </div>
              </div>
              <div className="account-stat-tile rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Win Rate</div>
                <div className="mt-2 text-2xl rt-page-title">
                  {accountStatsLoading ? '...' : `${(accountStats?.winRate ?? 0).toFixed(1)}%`}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Biggest USD Payout</div>
                <div className="mt-2 text-lg rt-page-title text-white">
                  {accountStatsLoading ? '...' : formatUsdBalance(accountStats?.biggestUsdPayout ?? 0)}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  Net USD: {accountStatsLoading ? '...' : formatUsdBalance(accountStats?.usdNet ?? 0)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Biggest RTC Payout</div>
                <div className="mt-2 text-lg rt-page-title text-white">
                  {accountStatsLoading ? '...' : formatRtcBalance(accountStats?.biggestRtcPayout ?? 0)}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  Net RTC: {accountStatsLoading ? '...' : formatRtcBalance(accountStats?.rtcNet ?? 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-2xl p-6" style={{ animationDelay: '80ms' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Deposit Wallet</div>
                <h2 className="mt-2 text-2xl rt-page-title">Top Up USD Balance</h2>
              </div>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.17em] text-amber-200">
                Square Checkout
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK_DEPOSIT_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant="secondary"
                  disabled={depositBusy}
                  onClick={() => void handleDeposit(amount)}
                  className="h-11 rounded-xl border-white/20 bg-white/[0.06] hover:bg-white/[0.12]"
                >
                  ${amount}
                </Button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                label="Custom Amount"
                type="number"
                min={1}
                step="0.01"
                placeholder="e.g. 75"
                value={customDeposit}
                onChange={(event) => setCustomDeposit(event.target.value)}
              />
              <Button
                className="sm:mt-[1.55rem]"
                disabled={depositBusy || !customDeposit.trim()}
                onClick={handleCustomDeposit}
              >
                Deposit Funds
              </Button>
            </div>

            {usdBalanceError && <p className="mt-3 text-sm text-red-300">{usdBalanceError}</p>}
            <p className="mt-3 text-xs text-white/50">Payments redirect to a secure hosted checkout.</p>
          </div>

          <div className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-2xl p-6" style={{ animationDelay: '140ms' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Reem Team Cash Wallet</div>
                <h2 className="mt-2 text-2xl rt-page-title">Load RTC for Crib Lanes</h2>
              </div>
              <span className="rounded-full border border-white/14 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.17em] text-white/70">
                {rtcBalanceLoading ? 'Syncing' : `${formatRtcBalance(rtcBalance)} RTC`}
              </span>
            </div>

            <p className="mt-3 text-sm text-white/65">
              Use RTC bundles for crib games.
            </p>

            <div className="mt-4 rounded-2xl border border-white/12 bg-black/25 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-white/55">Daily RTC Boost</div>
              <div className="mt-2 text-sm text-white/70">
                Keep your bankroll topped up with a once‑per‑day refill.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  disabled={rtcRefillLoading}
                  onClick={() => void handleRtcRefill()}
                >
                  {rtcRefillLoading ? 'Claiming...' : 'Claim Daily RTC'}
                </Button>
                {rtcRefillNextEligibleAt && (
                  <div className="text-xs text-white/55">
                    Next eligible: {new Date(rtcRefillNextEligibleAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {rtcBalanceError && <p className="mt-3 text-sm text-red-300">{rtcBalanceError}</p>}
            {rtcBundlesError && <p className="mt-3 text-sm text-red-300">{rtcBundlesError}</p>}

            {rtcBundlesLoading ? (
              <p className="mt-4 text-sm text-white/60">Loading bundles...</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {rtcBundles.map((bundle) => {
                  const rtcPerDollar = bundle.usdPrice > 0 ? Math.floor(bundle.rtcAmount / bundle.usdPrice) : 0;
                  const isBestValue = bundle.id === bestValueBundleId;
                  const isPurchasing = purchasingBundleId === bundle.id;

                  return (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => void handleRtcPurchase(bundle.id)}
                      disabled={!!purchasingBundleId}
                      className="group relative rounded-2xl border border-white/14 bg-black/20 p-4 text-left transition hover:border-amber-300/40 hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBestValue && (
                        <span className="absolute right-3 top-3 rounded-full border border-amber-200/50 bg-amber-200/18 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-100">
                          Best Value
                        </span>
                      )}
                      <div className="text-[11px] uppercase tracking-[0.17em] text-white/55">${bundle.usdPrice.toFixed(2)} USD</div>
                      <div className="mt-1 text-2xl rt-page-title text-white">{formatRTCCompactAmount(bundle.rtcAmount)} RTC</div>
                      <div className="mt-1 text-xs text-white/62">{formatRTCCompactAmount(rtcPerDollar)} RTC per $1</div>
                      <div className="mt-3 text-xs text-amber-100/90">
                        {isPurchasing ? 'Redirecting to checkout...' : 'Buy this bundle'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="mt-4 text-xs text-white/50">
              Cash Crown tournaments use USD buy-ins. RTC applies to crib and RTC lanes.
            </p>
          </div>

          <div className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-2xl p-6" style={{ animationDelay: '200ms' }}>
            <TransactionHistory embedded pageSize={10} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-2xl p-6" style={{ animationDelay: '110ms' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Player Identity</div>
                <h2 className="mt-2 text-2xl rt-page-title">Avatar + Presence</h2>
              </div>
              <span className="rounded-full border border-white/14 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.17em] text-white/70">
                {hasCustomAvatar ? 'Custom Avatar' : 'Default Avatar'}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-white/12 bg-gradient-to-r from-white/[0.05] to-amber-300/[0.04] p-4">
              <div className="flex items-center gap-4">
                <PlayerAvatar
                  player={{ name: user?.username || 'Player', avatarUrl: user?.avatarUrl }}
                  size="lg"
                />
                <div>
                  <div className="text-xl rt-page-title text-white">{user?.username || 'Player'}</div>
                  <div className="text-sm text-white/65">{user?.email || 'No email loaded'}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">
                    {hasCustomAvatar ? 'Custom profile art equipped' : 'Using team default avatar'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label
                htmlFor="avatar-upload"
                className="block cursor-pointer rounded-2xl border border-dashed border-white/25 bg-white/[0.02] px-4 py-4 transition hover:border-amber-300/45 hover:bg-white/[0.05]"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-white/55">Upload Avatar</div>
                <div className="mt-2 text-sm text-white/88">{file ? file.name : 'Choose an image file'}</div>
                <div className="mt-1 text-xs text-white/50">PNG, JPG, GIF, or WEBP</div>
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleFileChange}
                className="sr-only"
              />
              <Button className="mt-3 w-full" onClick={() => void handleUpload()} disabled={!file}>
                Upload Selected File
              </Button>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">Default Avatar Set</div>
              <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
                {DEFAULT_AVATAR_PATHS.map((avatarPath) => {
                  const avatarPreviewUrl = resolveAvatarUrl(avatarPath) || avatarPath;
                  const isSelected = user?.avatarUrl === avatarPath || resolvedCurrentAvatar === avatarPreviewUrl;

                  return (
                    <button
                      key={avatarPath}
                      type="button"
                      onClick={() => void selectDefaultAvatar(avatarPath)}
                      className={`relative rounded-2xl border p-1 transition ${
                        isSelected
                          ? 'border-amber-300/70 bg-amber-300/10'
                          : 'border-white/14 bg-black/15 hover:border-white/35'
                      }`}
                    >
                      <img src={avatarPreviewUrl} alt="Default Avatar" className="h-14 w-full rounded-xl object-cover" />
                      {isSelected && (
                        <span className="absolute -right-1 -top-1 rounded-full border border-amber-100/65 bg-amber-200/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-black">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-2xl p-6" style={{ animationDelay: '150ms' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">VIP Membership</div>
                <h2 className="mt-2 text-2xl rt-page-title">Private RTC + USD Tables</h2>
                <p className="mt-2 text-sm text-white/65">
                  VIP membership unlocks private hosted tables with clear RTC and USD stake options, invite-only access, and human-only seats.
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.17em] ${vipBadgeClass}`}>
                {vipStatusLabel}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-white/70">
              <div>Status: <span className="text-white/90">{vipStatusLabel}</span></div>
              <div>Billing: {vipRenewalLabel}</div>
              <div>Member since: {vipSinceLabel}</div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-white/70 list-disc pl-5">
              <li>Launch private RTC tables using the same stake ladder as the crib lobby</li>
              <li>Host private USD tables at $5, $10, $20, $50, or $100</li>
              <li>Share invite links that open the right room with a clear join page</li>
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              {isVipActive ? (
                <>
                  {canCancelVip && (
                    <Button
                      variant="danger"
                      onClick={() => setVipCancelOpen(true)}
                      disabled={vipCanceling}
                    >
                      {vipCanceling ? 'Canceling...' : 'Cancel VIP'}
                    </Button>
                  )}
                  <Link to="/tables">
                    <Button variant="secondary">Create Private Table</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button onClick={handleVipCheckout} disabled={vipCheckoutLoading}>
                    {vipCheckoutLoading ? 'Starting VIP...' : 'Start VIP ($4.99/mo)'}
                  </Button>
                  <Button variant="secondary" onClick={handleVipSync}>
                    Sync VIP Status
                  </Button>
                </>
              )}
            </div>

            {isVipCanceled && user?.vipExpiresAt && (
              <p className="mt-3 text-xs text-white/55">
                Cancellation scheduled. VIP access remains until {formatVipDate(user.vipExpiresAt)}.
              </p>
            )}
          </div>

          <div className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-2xl p-6" style={{ animationDelay: '170ms' }}>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Account Security</div>
            <h3 className="mt-2 text-xl rt-page-title">Credential-First Access</h3>
            <p className="mt-2 text-sm text-white/65">
              Use your email and password to access this account.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/50">Login Method</div>
                <div className="mt-1 text-sm text-white/88">Email + Password</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/50">Payout Protection</div>
                <div className="mt-1 text-sm text-white/88">Manual Review on Requests</div>
              </div>
            </div>
          </div>

          <div className="account-reveal" style={{ animationDelay: '230ms' }}>
            <PayoutForm />
          </div>
        </div>
      </section>

      <Modal
        isOpen={vipCancelOpen}
        onClose={() => setVipCancelOpen(false)}
        onConfirm={handleVipCancel}
        title="Cancel VIP Membership?"
        confirmLabel={vipCanceling ? 'Canceling...' : 'Cancel VIP'}
      >
        <div className="space-y-2">
          <p>
            This will stop future VIP renewals. You keep VIP access until your current billing period ends.
          </p>
          <p className="text-xs text-white/60">
            Need help? Reach out to support before the renewal date.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Account;
