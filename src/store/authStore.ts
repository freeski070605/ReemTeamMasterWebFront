import { create } from 'zustand';
import client from '../api/client';
import { toast } from 'react-toastify';

interface User {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    const stored = JSON.parse(localStorage.getItem('user') || 'null');
    if (!stored) return null;
    return { ...stored, isAdmin: !!stored.isAdmin };
  })(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await client.post('/auth/login', { email, password });
      const { token, userId, username, email: userEmail, avatarUrl, isAdmin } = response.data;
      
      const user = {
        _id: userId,
        username: username || 'User',
        email: userEmail || email,
        avatarUrl,
        isAdmin: !!isAdmin,
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
      const { token, userId, avatarUrl, isAdmin } = response.data;
      
      const user = { _id: userId, username, email, avatarUrl, isAdmin: !!isAdmin };
      
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
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const normalizedUser = user ? { ...user, isAdmin: !!user.isAdmin } : null;
    if (token && user) {
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
}));
