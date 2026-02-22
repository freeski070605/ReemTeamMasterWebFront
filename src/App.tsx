import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import TableSelect from './pages/TableSelect';
import ContestLobby from './pages/ContestLobby';
import GameTable from './pages/GameTable';
import Admin from './pages/Admin';
import Account from './pages/Account';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import UserDataDeletion from './pages/UserDataDeletion';

const WalletRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/account${location.search}`} replace />;
};

const App: React.FC = () => {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<UserDataDeletion />} />
          
          <Route element={<ProtectedRoute />}>
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
