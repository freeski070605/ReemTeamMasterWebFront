import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';
import { ReactFacebookLoginInfo, ReactFacebookFailureResponse } from 'react-facebook-login';
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
  const logoSrc = "/assets/logo.png";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(username, email, password);
      navigate('/tables'); // Redirect to tables after registration
    } catch (error) {
      // Error handled in store
    }
  };

  const handleFacebookRegister = async (response: ReactFacebookLoginInfo | ReactFacebookFailureResponse) => {
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
      console.error('Facebook registration error: No access token received.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="max-w-md w-full p-8 bg-black/60 rounded-2xl border border-white/10 shadow-2xl backdrop-blur">
        <div className="flex flex-col items-center mb-6">
          <img src={logoSrc} alt="ReemTeam logo" className="w-14 h-14 object-contain mb-3" />
          <h2 className="text-3xl font-bold text-center text-white">
            Create Account
          </h2>
          <p className="text-white/60 text-sm mt-1">Join the arena in seconds.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          placeholder="Choose a username"
        />
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
          placeholder="Choose a password"
        />
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Register
        </Button>
        {errorMessage && <p className="text-red-500 text-sm mt-4 text-center">{errorMessage}</p>}
      </form>
        <div className="mt-4">
          <FacebookLogin
            appId="1437814761308514"
            autoLoad={false}
            fields="name,email,picture"
            callback={handleFacebookRegister}
            render={(renderProps: { onClick: () => void; }) => (
              <Button onClick={renderProps.onClick} className="w-full bg-blue-600 hover:bg-blue-700">
                Register with Facebook
              </Button>
            )}
          />
        </div>
        <p className="mt-4 text-center text-sm text-white/60">
          Already have an account?{' '}
          <Link to="/login" className="text-yellow-300 hover:text-yellow-200">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
