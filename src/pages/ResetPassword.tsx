import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import client from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const MIN_PASSWORD_LENGTH = 8;

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Reset token is missing');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await client.post('/auth/reset-password', { token, password });
      toast.success('Password updated. You can now sign in.');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="rt-auth-shell min-h-[calc(100vh-12rem)] grid items-center py-6">
        <section className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-8 max-w-2xl mx-auto w-full">
          <div className="text-sm uppercase tracking-[0.18em] text-white/55">Authentication</div>
          <h1 className="mt-2 rt-page-title text-3xl font-semibold">Reset Link Missing</h1>
          <p className="mt-3 text-white/70">
            This password reset link is incomplete. Request a new one to continue.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block mt-6 text-amber-300 hover:text-amber-200 underline"
          >
            Request a new reset link
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="rt-auth-shell min-h-[calc(100vh-12rem)] grid items-center py-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-8">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/65">
            Account Recovery
          </div>
          <h1 className="mt-5 rt-page-title text-4xl font-semibold">Set a New Password</h1>
          <p className="mt-3 text-white/70">
            Choose a strong password that you do not reuse elsewhere.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/70">
            <div className="rt-glass rounded-xl p-3">Minimum length: {MIN_PASSWORD_LENGTH} characters.</div>
            <div className="rt-glass rounded-xl p-3">After updating, sign in with your new credentials.</div>
          </div>
        </section>

        <section className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-8">
          <div className="text-sm uppercase tracking-[0.18em] text-white/55">Authentication</div>
          <div className="rt-page-title text-xl mt-1">Reset Password</div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter a new password"
            />
            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter your new password"
            />
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Update Password
            </Button>
          </form>

          <p className="mt-6 text-sm text-white/65">
            Back to{' '}
            <Link to="/login" className="text-amber-300 hover:text-amber-200">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
};

export default ResetPassword;
