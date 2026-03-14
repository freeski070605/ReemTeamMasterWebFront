import { create } from 'zustand';
import client from '../api/client';
import { toast } from 'react-toastify';
import { UserRole, resolveUserRole } from '../types/roles';

interface User {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  isAdmin?: boolean;
  isVip?: boolean;
  vipStatus?: string;
  vipExpiresAt?: string | null;
  vipSince?: string | null;
}

const normalizeStoredUser = (value: any): User | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const role = resolveUserRole(value.role, !!value.isAdmin);
  return {
    _id: value._id,
    username: value.username,
    email: value.email,
    avatarUrl: value.avatarUrl,
    role,
    isAdmin: role === 'admin' || role === 'superadmin',
    isVip: !!value.isVip,
    vipStatus: value.vipStatus,
    vipExpiresAt: value.vipExpiresAt ?? null,
    vipSince: value.vipSince ?? null,
  };
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
  uploadAvatar: (file: File) => Promise<void>;
  selectDefaultAvatar: (avatarUrl: string) => Promise<void>;
  refreshVipStatus: (sync?: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    const stored = JSON.parse(localStorage.getItem('user') || 'null');
    return normalizeStoredUser(stored);
  })(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await client.post('/auth/login', { email, password });
      const { token, userId, username, email: userEmail, avatarUrl, role, isAdmin } = response.data;
      const { isVip, vipStatus, vipExpiresAt } = response.data;
      const resolvedRole = resolveUserRole(role, !!isAdmin);
      
      const user = {
        _id: userId,
        username: username || 'User',
        email: userEmail || email,
        avatarUrl,
        role: resolvedRole,
        isAdmin: resolvedRole === 'admin' || resolvedRole === 'superadmin',
        isVip: !!isVip,
        vipStatus,
        vipExpiresAt: vipExpiresAt ?? null,
        vipSince: response.data?.vipSince ?? null,
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({ user, token, isAuthenticated: true, isLoading: false });
      toast.success('Login successful!');
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Login failed');
      throw error;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true });
    try {
      const response = await client.post('/auth/register', { username, email, password });
      const { token, userId, avatarUrl, role, isAdmin } = response.data;
      const { isVip, vipStatus, vipExpiresAt } = response.data;
      const resolvedRole = resolveUserRole(role, !!isAdmin);
      
      const user = {
        _id: userId,
        username,
        email,
        avatarUrl,
        role: resolvedRole,
        isAdmin: resolvedRole === 'admin' || resolvedRole === 'superadmin',
        isVip: !!isVip,
        vipStatus,
        vipExpiresAt: vipExpiresAt ?? null,
        vipSince: response.data?.vipSince ?? null,
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({ user, token, isAuthenticated: true, isLoading: false });
      toast.success('Registration successful!');
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Registration failed');
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
    toast.info('Logged out');
  },

  checkAuth: () => {
    const token = localStorage.getItem('token');
    const stored = JSON.parse(localStorage.getItem('user') || 'null');
    const normalizedUser = normalizeStoredUser(stored);
    if (token && normalizedUser) {
        set({ token, user: normalizedUser, isAuthenticated: true });
    } else {
        set({ token: null, user: null, isAuthenticated: false });
    }
  },

  uploadAvatar: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await client.post('/users/avatar/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      set((state) => {
        if (!state.user) {
          return state;
        }

        const user = { ...state.user, avatarUrl: response.data.avatarUrl };
        localStorage.setItem('user', JSON.stringify(user));
        return { ...state, user };
      });
      toast.success('Avatar updated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Avatar upload failed');
    }
  },

  selectDefaultAvatar: async (avatarUrl: string) => {
    try {
      const response = await client.post('/users/avatar/select-default', { avatarUrl });
      set((state) => {
        if (!state.user) {
          return state;
        }

        const user = { ...state.user, avatarUrl: response.data.avatarUrl };
        localStorage.setItem('user', JSON.stringify(user));
        return { ...state, user };
      });
      toast.success('Avatar updated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Avatar update failed');
    }
  },

  refreshVipStatus: async (sync = false) => {
    try {
      const response = sync
        ? await client.post('/vip/sync')
        : await client.get('/vip/status');
      const { vipStatus, vipExpiresAt, isVip } = response.data ?? {};
      set((state) => {
        if (!state.user) {
          return state;
        }
        const user = {
          ...state.user,
          vipStatus,
          vipExpiresAt: vipExpiresAt ?? null,
          isVip: !!isVip,
          vipSince: response.data?.vipSince ?? null,
        };
        localStorage.setItem('user', JSON.stringify(user));
        return { ...state, user };
      });
    } catch {
      // Ignore refresh failures.
    }
  },
}));
