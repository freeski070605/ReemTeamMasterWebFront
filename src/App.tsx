import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ANALYTICS_EVENTS } from './analytics/events';
import { trackEventOncePerSession } from './api/analytics';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import QuickPlay from './pages/QuickPlay';
import TableSelect from './pages/TableSelect';
import ContestLobby from './pages/ContestLobby';
import GameTable from './pages/GameTable';
import Admin from './pages/Admin';
import Account from './pages/Account';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import UserDataDeletion from './pages/UserDataDeletion';
import HowToPlay from './pages/HowToPlay';
import Invite from './pages/Invite';

const WalletRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/account${location.search}`} replace />;
};

const App: React.FC = () => {
  const { checkAuth, authReady, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    void trackEventOncePerSession(ANALYTICS_EVENTS.appOpen, {
      path: typeof window !== 'undefined' ? window.location.pathname : '/',
    });
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated || !user?._id) {
      return;
    }

    void trackEventOncePerSession(
      ANALYTICS_EVENTS.signedIn,
      { userId: user._id },
      `signed-in:${user._id}`
    );
  }, [authReady, isAuthenticated, user?._id]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<UserDataDeletion />} />
          <Route path="/how-to-play" element={<HowToPlay />} />
          <Route path="/invite/:code" element={<Invite />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/quick-play" element={<QuickPlay />} />
            <Route path="/tables" element={<TableSelect />} />
            <Route path="/contests" element={<ContestLobby />} />
            <Route path="/game/:tableId" element={<GameTable />} />
            <Route path="/account" element={<Account />} />
            <Route path="/wallet" element={<WalletRedirect />} />
            <Route path="/profile" element={<Navigate to="/account" replace />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <ToastContainer
        position="bottom-right"
        theme="dark"
        autoClose={2200}
        closeButton={false}
        hideProgressBar
        className="compact-toast-container"
        toastClassName="compact-toast"
      />
    </Router>
  );
};

export default App;
