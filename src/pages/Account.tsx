import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuthStore } from '../store/authStore';
import { createCheckout } from '../api/wallet';
import BalanceDisplay from '../components/wallet/BalanceDisplay';
import TransactionHistory from '../components/wallet/TransactionHistory';
import PayoutForm from '../components/wallet/PayoutForm';
import PlayerAvatar from '../components/game/PlayerAvatar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { DEFAULT_AVATAR_PATHS } from '../constants/avatars';
import { resolveAvatarUrl } from '../utils/avatar';

const QUICK_DEPOSIT_AMOUNTS = [25, 50, 100, 250];

const Account: React.FC = () => {
  const { user, uploadAvatar, selectDefaultAvatar } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);
  const [customDeposit, setCustomDeposit] = useState('');

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
      toast.error('Failed to initiate deposit.');
    } finally {
      setDepositBusy(false);
    }
  };

  const handleCustomDeposit = () => {
    const amount = Number(customDeposit);
    void handleDeposit(amount);
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
