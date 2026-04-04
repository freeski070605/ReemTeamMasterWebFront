import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader } from '../ui/Loader';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, authReady } = useAuthStore();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};
