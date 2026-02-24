import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
import { createCheckout } from '../api/wallet';
import { getRtcBundles, purchaseRtcBundle, RtcPurchaseBundle } from '../api/rtc';
import BalanceDisplay from '../components/wallet/BalanceDisplay';
import TransactionHistory from '../components/wallet/TransactionHistory';
import PayoutForm from '../components/wallet/PayoutForm';
import PlayerAvatar from '../components/game/PlayerAvatar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { DEFAULT_AVATAR_PATHS } from '../constants/avatars';
import { resolveAvatarUrl } from '../utils/avatar';
import { useWalletBalance } from '../hooks/useWalletBalance';

const QUICK_DEPOSIT_AMOUNTS = [25, 50, 100, 250];

const Account: React.FC = () => {
  const { user, uploadAvatar, selectDefaultAvatar } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);
  const [customDeposit, setCustomDeposit] = useState('');
  const [rtcBundles, setRtcBundles] = useState<RtcPurchaseBundle[]>([]);
  const [rtcBundlesLoading, setRtcBundlesLoading] = useState(true);
  const [rtcBundlesError, setRtcBundlesError] = useState<string | null>(null);
  const [purchasingBundleId, setPurchasingBundleId] = useState<string | null>(null);
  const {
    balance: rtcBalance,
    loading: rtcBalanceLoading,
    error: rtcBalanceError,
    refresh: refreshRtcBalance,
  } = useWalletBalance({ currency: 'rtc', refreshIntervalMs: 15000 });

  useEffect(() => {
    const paymentStatus = searchParams.get('paymentStatus');
    if (!paymentStatus) {
      return;
    }

    if (paymentStatus === 'success') {
      toast.success('Deposit completed. Your balance will update shortly.');
      window.dispatchEvent(new Event('wallet-balance-refresh'));
    } else {
      toast.info(`Checkout status: ${paymentStatus}`);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('paymentStatus');
    nextParams.delete('userId');
    nextParams.delete('amount');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    uploadAvatar(file);
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

  const handleRtcPurchase = async (bundleId: string) => {
    setPurchasingBundleId(bundleId);
    try {
      const paymentReferenceId = `rtc-ui-${Date.now()}`;
      const response = await purchaseRtcBundle(bundleId, paymentReferenceId);
      toast.success(
        `${response.bundle.rtcAmount.toLocaleString()} Reem Team Cash credited to your wallet.`
      );
      await refreshRtcBalance();
      window.dispatchEvent(new Event('wallet-balance-refresh'));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not complete Reem Team Cash purchase.');
    } finally {
      setPurchasingBundleId(null);
    }
  };

  const formatRtcBalance = (amount: number | null): string => {
    if (amount === null) {
      return '0';
    }
    return Math.max(0, Math.floor(amount)).toLocaleString('en-US');
  };

  return (
    <div className="space-y-6">
      <header className="rt-panel-strong rounded-3xl p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">Account Dashboard</div>
        <h1 className="mt-2 text-4xl rt-page-title font-semibold">Wallet, Profile, and Identity</h1>
        <p className="mt-2 text-white/65">
          Manage deposits, withdrawals, history, and avatar settings from one place.
        </p>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <BalanceDisplay label="USD Wallet Balance" />
          <div className="rt-panel-strong rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Reem Team Cash Wallet</div>
            <h2 className="mt-2 text-2xl rt-page-title">Buy Reem Team Cash</h2>
            <div className="mt-3 text-4xl font-semibold text-white rt-page-title">
              {rtcBalanceLoading ? '...' : formatRtcBalance(rtcBalance)}
            </div>
            <p className="mt-2 text-xs text-white/55">
              Balance used for crib games and Reem Team Cash tournaments.
            </p>
            {rtcBalanceError && (
              <p className="mt-3 text-sm text-red-300">{rtcBalanceError}</p>
            )}
            {rtcBundlesError && (
              <p className="mt-3 text-sm text-red-300">{rtcBundlesError}</p>
            )}
            {rtcBundlesLoading ? (
              <p className="mt-4 text-sm text-white/60">Loading bundles...</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {rtcBundles.map((bundle) => (
                  <Button
                    key={bundle.id}
                    variant="secondary"
                    isLoading={purchasingBundleId === bundle.id}
                    disabled={!!purchasingBundleId}
                    className="h-auto flex-col items-start py-3"
                    onClick={() => void handleRtcPurchase(bundle.id)}
                  >
                    <span className="text-sm">${bundle.usdPrice.toFixed(2)}</span>
                    <span className="mt-1 text-xs text-white/75">
                      {bundle.rtcAmount.toLocaleString()} Reem Team Cash
                    </span>
                  </Button>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-white/50">
              Cash Crown tournaments use USD buy-ins. Reem Team Cash is used for crib and RTC lanes.
            </p>
          </div>
          <div className="rt-panel-strong rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Deposit Wallet</div>
            <h2 className="mt-2 text-2xl rt-page-title">Top Up Balance</h2>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {QUICK_DEPOSIT_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant="secondary"
                  disabled={depositBusy}
                  onClick={() => void handleDeposit(amount)}
                  className="h-11"
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
                onChange={(e) => setCustomDeposit(e.target.value)}
              />
              <Button className="sm:mt-[1.55rem]" disabled={depositBusy || !customDeposit} onClick={handleCustomDeposit}>
                Deposit
              </Button>
            </div>
            <p className="mt-3 text-xs text-white/50">Checkout redirects to secure Square payment flow.</p>
          </div>
          <div className="rt-panel-strong rounded-2xl p-6">
            <TransactionHistory embedded />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rt-panel-strong rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Player Identity</div>
            <div className="mt-4 flex items-center gap-4">
              <PlayerAvatar player={{ name: user?.username || 'Player', avatarUrl: user?.avatarUrl }} size="lg" />
              <div>
                <div className="text-xl rt-page-title">{user?.username || 'Player'}</div>
                <div className="text-sm text-white/60">{user?.email}</div>
              </div>
            </div>

            <div className="mt-6">
              <Input id="avatar-upload" label="Upload Avatar" type="file" onChange={handleFileChange} />
              <Button className="mt-3 w-full" onClick={handleUpload} disabled={!file}>
                Upload Selected File
              </Button>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">Default Avatars</div>
              <div className="mt-3 flex flex-wrap gap-3">
                {DEFAULT_AVATAR_PATHS.map((avatarPath) => {
                  const avatarPreviewUrl = resolveAvatarUrl(avatarPath) || avatarPath;
                  return (
                    <img
                      key={avatarPath}
                      src={avatarPreviewUrl}
                      alt="Default Avatar"
                      className="w-14 h-14 rounded-full cursor-pointer border border-white/10 hover:border-amber-300 transition"
                      onClick={() => selectDefaultAvatar(avatarPath)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rt-panel-strong rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Account Security</div>
            <h3 className="mt-2 text-xl rt-page-title">Email + Password Login</h3>
            <p className="mt-2 text-sm text-white/65">
              Social sign-in has been removed. This account now uses direct credentials only.
            </p>
          </div>

          <PayoutForm />
        </div>
      </section>
    </div>
  );
};

export default Account;
