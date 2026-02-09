import React, { useState } from "react";
import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";
import { toast } from "react-toastify";
import { useAuthStore } from "../store/authStore";
import { createCheckout } from "../api/wallet";
import BalanceDisplay from "../components/wallet/BalanceDisplay";
import TransactionHistory from "../components/wallet/TransactionHistory";
import PayoutForm from "../components/wallet/PayoutForm";
import PlayerAvatar from "../components/game/PlayerAvatar";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

const Account: React.FC = () => {
  const { user, uploadAvatar, selectDefaultAvatar, linkFacebook } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadAvatar(file);
    }
  };

  const handleDeposit = async (amount: number) => {
    setDepositBusy(true);
    try {
      const checkoutUrl = await createCheckout(amount);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      toast.error("Failed to start checkout.");
    } catch (error) {
      console.error("Deposit error:", error);
      toast.error("Failed to initiate deposit.");
    } finally {
      setDepositBusy(false);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% 10%, rgba(255,199,74,0.12), transparent 60%)," +
            "radial-gradient(900px 500px at 90% 10%, rgba(244,138,24,0.12), transparent 55%)," +
            "linear-gradient(180deg, #0b0c0e 0%, #111214 45%, #0b0c0e 100%)",
        }}
        aria-hidden
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.3em] text-white/50">Account Dashboard</div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mt-2">Wallet & Profile</h1>
          <p className="text-white/60 mt-2">Manage your balance, payouts, and identity in one calm workspace.</p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <BalanceDisplay label="Available Balance" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="text-sm uppercase tracking-[0.2em] text-white/50">Quick Deposit</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[25, 50, 100, 250].map((amount) => (
                <Button
                  key={amount}
                  variant="secondary"
                  disabled={depositBusy}
                  onClick={() => handleDeposit(amount)}
                  className="h-12 text-base font-semibold"
                >
                  ${amount}
                </Button>
              ))}
            </div>
            <p className="text-xs text-white/50 mt-4">Deposits use secure checkout and update your balance shortly.</p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="text-sm uppercase tracking-[0.2em] text-white/50">Transaction History</div>
            <div className="mt-4">
              <TransactionHistory embedded />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-sm uppercase tracking-[0.2em] text-white/50">Player Identity</div>
              <div className="mt-4 flex items-center gap-4">
                <PlayerAvatar player={{ name: user?.username || "Player", avatarUrl: user?.avatarUrl }} size="lg" />
                <div>
                  <div className="text-lg font-semibold text-white">{user?.username || "Player"}</div>
                  <div className="text-sm text-white/60">Customize how you show up at the table.</div>
                </div>
              </div>
              <div className="mt-6">
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-2" htmlFor="avatar-upload">
                  Upload Custom Avatar
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    id="avatar-upload"
                    type="file"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  <Button onClick={handleUpload} disabled={!file}>
                    Upload
                  </Button>
                </div>
                <p className="text-xs text-white/50 mt-2">PNG, JPG, or GIF. Max size 2MB.</p>
              </div>
              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="text-sm uppercase tracking-[0.2em] text-white/50">Default Avatars</div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {["/avatars/avatar1.png", "/avatars/avatar2.png", "/avatars/avatar3.png", "/avatars/avatar4.png"].map((avatar) => (
                    <img
                      key={avatar}
                      src={avatar}
                      alt="Default Avatar"
                      className="w-14 h-14 rounded-full cursor-pointer border border-white/10 hover:border-yellow-400/60 transition"
                      onClick={() => selectDefaultAvatar(avatar)}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="text-sm uppercase tracking-[0.2em] text-white/50">Social Accounts</div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Facebook</div>
                    <div className="text-xs text-white/60">Not connected</div>
                  </div>
                  <FacebookLogin
                    appId="YOUR_FACEBOOK_APP_ID"
                    autoLoad={false}
                    fields="name,email,picture"
                    callback={(response: any) => linkFacebook(response.accessToken)}
                    render={(renderProps: any) => (
                      <Button variant="secondary" onClick={renderProps.onClick}>
                        Link Account
                      </Button>
                    )}
                  />
                </div>
              </div>
            </div>

            <PayoutForm />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Account;
