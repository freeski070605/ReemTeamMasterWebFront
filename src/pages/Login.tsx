import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const logoSrc = '/assets/logo.png';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/tables');
    } catch {
      // Error state handled in store toast.
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] grid items-center py-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rt-panel-strong rounded-3xl p-8">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/65">
            ReemTeam Player Access
          </div>
          <h1 className="mt-5 rt-page-title text-4xl font-semibold">Welcome Back</h1>
          <p className="mt-3 text-white/70">
            Jump back into crib play, crown entries, and wallet management with one sign-in.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-white/55">Modes</div>
              <div className="mt-2 text-2xl rt-page-title">4</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-white/55">Currencies</div>
              <div className="mt-2 text-2xl rt-page-title">USD + RTC</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-white/55">Live</div>
              <div className="mt-2 text-2xl rt-page-title">Socket Play</div>
            </div>
          </div>
        </section>

        <section className="rt-panel-strong rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoSrc} alt="ReemTeam logo" className="h-10 w-10 object-contain" />
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-white/55">Authentication</div>
              <div className="rt-page-title text-xl">Sign In</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-sm text-white/65">
            Need an account?{' '}
            <Link to="/register" className="text-amber-300 hover:text-amber-200">
              Register
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
};

export default Login;
