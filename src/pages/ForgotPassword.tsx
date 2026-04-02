import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import client from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setDevResetLink(null);

    try {
      const response = await client.post('/auth/forgot-password', { email });
      const resetLink = typeof response.data?.resetLink === 'string' ? response.data.resetLink : null;
      setDevResetLink(resetLink);
      toast.success(
        response.data?.message || 'If an account exists for that email, a reset link has been sent.'
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to start password reset');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rt-auth-shell min-h-[calc(100vh-12rem)] grid items-center py-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-8">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/65">
            Account Recovery
          </div>
          <h1 className="mt-5 rt-page-title text-4xl font-semibold">Forgot Your Password?</h1>
          <p className="mt-3 text-white/70">
            Enter the email tied to your ReemTeam account. If it exists, we will issue a secure reset link.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/70">
            <div className="rt-glass rounded-xl p-3">Reset links are time-limited for security.</div>
            <div className="rt-glass rounded-xl p-3">Submitting this form does not reveal whether an email is registered.</div>
          </div>
        </section>

        <section className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-8">
          <div className="text-sm uppercase tracking-[0.18em] text-white/55">Authentication</div>
          <div className="rt-page-title text-xl mt-1">Request Password Reset</div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Send Reset Link
            </Button>
          </form>

          {devResetLink ? (
            <div className="mt-4 rounded-xl border border-amber-300/35 bg-amber-300/10 p-3 text-sm text-amber-100 break-all">
              <div className="text-xs uppercase tracking-[0.16em] text-amber-200/90">Development Reset Link</div>
              <a className="mt-1 inline-block underline hover:text-amber-50" href={devResetLink}>
                {devResetLink}
              </a>
            </div>
          ) : null}

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

export default ForgotPassword;
