import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { hasAdminTabAccess } from '../../types/roles';

export const AdminRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.role || !hasAdminTabAccess(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
