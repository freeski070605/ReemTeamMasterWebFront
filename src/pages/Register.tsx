import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';
import { ReactFacebookFailureResponse, ReactFacebookLoginInfo } from 'react-facebook-login';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { register, isLoading, facebookLogin } = useAuthStore();
  const navigate = useNavigate();
  const logoSrc = '/assets/logo.png';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(username, email, password);
      navigate('/tables');
    } catch {
      // Errors are handled by auth store toast.
    }
  };

  const handleFacebookRegister = async (
    response: ReactFacebookLoginInfo | ReactFacebookFailureResponse
  ) => {
    if ('accessToken' in response) {
      try {
        await facebookLogin(response.accessToken);
        navigate('/tables');
      } catch (error) {
        setErrorMessage('Facebook registration failed. Please try again.');
        console.error('Facebook registration failed:', error);
      }
    } else {
      setErrorMessage('Could not authenticate with Facebook. Please try again.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-12rem)] grid items-center py-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rt-panel-strong rounded-3xl p-8">
          <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/65">
            Claim Your Seat
          </div>
          <h1 className="mt-5 rt-page-title text-4xl font-semibold">Join ReemTeam</h1>
          <p className="mt-3 text-white/70">
            One account unlocks crib runs, cash crowns, wallet tracking, and ticket lanes.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/70">
            <div className="rt-glass rounded-xl p-3">Run open cribs, block brackets, ticket grind tables, and cash crown contests.</div>
            <div className="rt-glass rounded-xl p-3">Track outcomes and wallet movement from one account dashboard.</div>
            <div className="rt-glass rounded-xl p-3">Redeem satellite tickets for cash crowns without converting RTC to USD.</div>
          </div>
        </section>

        <section className="rt-panel-strong rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoSrc} alt="ReemTeam logo" className="h-10 w-10 object-contain" />
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-white/55">Authentication</div>
              <div className="rt-page-title text-xl">Create Account</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Choose a display name"
            />
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
              placeholder="Create a secure password"
            />
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/12" />
            <span className="text-xs uppercase tracking-[0.14em] text-white/45">or</span>
            <div className="h-px flex-1 bg-white/12" />
          </div>

          <FacebookLogin
            appId="1437814761308514"
            autoLoad={false}
            fields="name,email,picture"
            callback={handleFacebookRegister}
            render={(renderProps: { onClick: () => void }) => (
              <Button onClick={renderProps.onClick} className="w-full !bg-[#1877f2] !text-white hover:!bg-[#3b82f6]">
                Continue with Facebook
              </Button>
            )}
          />

          {errorMessage && <p className="mt-4 text-sm text-red-300">{errorMessage}</p>}

          <p className="mt-6 text-sm text-white/65">
            Already registered?{' '}
            <Link to="/login" className="text-amber-300 hover:text-amber-200">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
};

export default Register;
