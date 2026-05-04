import { create } from 'zustand';
import client from '../api/client';
import { toast } from 'react-toastify';
import {
  AuthUser,
  buildUserFromAuthResponse,
  clearAuthSession,
  readStoredToken,
  readStoredUser,
  storeAuthSession,
} from '../utils/authSession';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authReady: boolean;
  login: (email: string, password: string, rememberDevice?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string, rememberDevice?: boolean) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  selectDefaultAvatar: (avatarUrl: string) => Promise<void>;
  refreshVipStatus: (sync?: boolean) => Promise<void>;
}

const storedUser = readStoredUser();
const storedToken = readStoredToken();

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  token: storedToken,
  isAuthenticated: !!storedToken && !!storedUser,
  isLoading: false,
  authReady: false,

  login: async (email, password, rememberDevice = true) => {
    set({ isLoading: true });
    try {
      const response = await client.post('/auth/login', { email, password, rememberDevice });
      const token = response.data?.token;
      const user = buildUserFromAuthResponse(response.data, { email });

      storeAuthSession(token, user);
      set({ user, token, isAuthenticated: true, isLoading: false, authReady: true });
      toast.success('Login successful!');
    } catch (error: any) {
      set({ isLoading: false, authReady: true });
      toast.error(error.response?.data?.message || 'Login failed');
      throw error;
    }
  },

  register: async (username, email, password, rememberDevice = true) => {
    set({ isLoading: true });
    try {
      const response = await client.post('/auth/register', { username, email, password, rememberDevice });
      const token = response.data?.token;
      const user = buildUserFromAuthResponse(response.data, { username, email });

      storeAuthSession(token, user);
      set({ user, token, isAuthenticated: true, isLoading: false, authReady: true });
      toast.success('Registration successful!');
    } catch (error: any) {
      set({ isLoading: false, authReady: true });
      toast.error(error.response?.data?.message || 'Registration failed');
      throw error;
    }
  },

  logout: () => {
    clearAuthSession();
    set({ user: null, token: null, isAuthenticated: false, authReady: true });
    void client.post('/auth/logout', {}, { skipAuthRefresh: true } as any).catch(() => undefined);
    toast.info('Logged out');
  },

  checkAuth: async () => {
    const token = readStoredToken();
    const user = readStoredUser();

    if (token && user) {
      set({ token, user, isAuthenticated: true, authReady: true });
      return;
    }

    try {
      const response = await client.post('/auth/refresh', {}, { skipAuthRefresh: true } as any);
      const refreshedToken = response.data?.token;
      const refreshedUser = buildUserFromAuthResponse(response.data);
      storeAuthSession(refreshedToken, refreshedUser);
      set({ token: refreshedToken, user: refreshedUser, isAuthenticated: true, authReady: true });
    } catch {
      clearAuthSession();
      set({ token: null, user: null, isAuthenticated: false, authReady: true });
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
        if (state.token) {
          storeAuthSession(state.token, user);
        }
        return { ...state, user };
      });
      toast.success('Avatar saved.');
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
        if (state.token) {
          storeAuthSession(state.token, user);
        }
        return { ...state, user };
      });
      toast.success('Avatar saved.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Avatar save failed');
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

        if (state.token) {
          storeAuthSession(state.token, user);
        }

        return { ...state, user };
      });
    } catch {
      // Ignore refresh failures.
    }
  },
}));
