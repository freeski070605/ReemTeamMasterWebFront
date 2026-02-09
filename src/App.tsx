import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import TableSelect from './pages/TableSelect';
import GameTable from './pages/GameTable';
import Wallet from './pages/Wallet';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Account from './pages/Account';

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
          
          <Route element={<ProtectedRoute />}>
            <Route path="/tables" element={<TableSelect />} />
            <Route path="/game/:tableId" element={<GameTable />} />
            <Route path="/account" element={<Account />} />
            <Route path="/wallet" element={<Navigate to="/account" replace />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile" element={<Navigate to="/account" replace />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <ToastContainer position="bottom-right" theme="dark" />
    </Router>
  );
};

export default App;
