import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { getPostAuthRedirectPath } from '../utils/authRedirect';
import { consumeSessionExpiredNotice } from '../utils/authSession';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const logoSrc = '/assets/logo.png';
  const sessionExpired = useMemo(
    () => consumeSessionExpiredNotice() || searchParams.get('reauth') === '1',
    [searchParams]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password, rememberDevice);
      const nextPath = getPostAuthRedirectPath(location.state as any);
      navigate(nextPath, { replace: true });
    } catch {
      // Error state handled in store toast.
    }
  };

  return (
    <div className="rt-auth-shell min-h-[calc(100vh-12rem)] grid items-center py-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoSrc} alt="ReemTeam logo" className="h-10 w-10 object-contain" />
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-white/55">Authentication</div>
              <div className="rt-page-title text-xl">Sign In</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {sessionExpired && (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Your session timed out. Sign in again and we&apos;ll get you back to your game.
              </div>
            )}
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Your password"
            />
            <div className="text-right -mt-1">
              <Link to="/forgot-password" className="text-xs text-amber-300 hover:text-amber-200">
                Forgot password?
              </Link>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-amber-300 focus:ring-amber-300"
              />
              <span>
                Keep me signed in on this device
                <span className="block text-xs text-white/50">Recommended for personal or trusted devices.</span>
              </span>
            </label>
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-sm text-white/65">
            Need an account?{' '}
            <Link to="/register" state={location.state} className="text-amber-300 hover:text-amber-200">
              Register
            </Link>
          </p>
        </section>
        <section className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-8">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/65">
            ReemTeam Player Access
          </div>
          <h1 className="mt-5 rt-page-title text-4xl font-semibold">Welcome Back</h1>
          <p className="mt-3 text-white/70">
            Jump back into Reem Team Cash cribs, Cash Crown tournaments, and wallet management with one sign-in.
          </p>
        </section>

        
      </div>
    </div>
  );
};

export default Login;
