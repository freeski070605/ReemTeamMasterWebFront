import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';
import { ReactFacebookLoginInfo, ReactFacebookFailureResponse } from 'react-facebook-login';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { login, isLoading, facebookLogin } = useAuthStore();
  const navigate = useNavigate();
  const logoSrc = "/assets/logo.png";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/tables'); // Redirect to tables after login
    } catch (error) {
      // Error handled in store
    }
  };

  const handleFacebookLogin = async (response: ReactFacebookLoginInfo | ReactFacebookFailureResponse) => {
    if ('accessToken' in response) {
      try {
        await facebookLogin(response.accessToken);
        navigate('/tables');
      } catch (error) {
        setErrorMessage('Facebook login failed. Please try again.');
        console.error('Facebook login failed:', error);
      }
    } else {
      setErrorMessage('Could not authenticate with Facebook. Please try again.');
      console.error('Facebook login error: No access token received.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="max-w-md w-full p-8 bg-black/60 rounded-2xl border border-white/10 shadow-2xl backdrop-blur">
        <div className="flex flex-col items-center mb-6">
          <img src={logoSrc} alt="ReemTeam logo" className="w-14 h-14 object-contain mb-3" />
          <h2 className="text-3xl font-bold text-center text-white">
            Welcome Back
          </h2>
          <p className="text-white/60 text-sm mt-1">Sign in to hit the tables.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Enter your email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter your password"
        />
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Login
        </Button>
        {errorMessage && <p className="text-red-500 text-sm mt-4 text-center">{errorMessage}</p>}
        </form>
        <div className="mt-4">
          <FacebookLogin
            appId="1437814761308514"
            autoLoad={false}
            fields="name,email,picture"
            callback={handleFacebookLogin}
            render={(renderProps: { onClick: () => void; }) => (
              <Button onClick={renderProps.onClick} className="w-full bg-blue-600 hover:bg-blue-700">
                Login with Facebook
              </Button>
            )}
          />
        </div>
        <p className="mt-4 text-center text-sm text-white/60">
          Don't have an account?{' '}
          <Link to="/register" className="text-yellow-300 hover:text-yellow-200">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
