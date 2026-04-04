import axios, { InternalAxiosRequestConfig } from 'axios';
import {
  buildUserFromAuthResponse,
  clearAuthSession,
  markSessionExpiredNotice,
  readStoredToken,
  storeAuthSession,
  storePostAuthRedirect,
} from '../utils/authSession';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string | null> | null = null;

const isJwtAuthFailure = (error: any) => {
  const backendMessage = error?.response?.data?.message;
  return backendMessage === 'No token, authorization denied'
    || backendMessage === 'Token is not valid';
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = axios.post(
      `${API_URL}/auth/refresh`,
      {},
      {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
      .then((response) => {
        const token = response.data?.token;
        if (!token) {
          throw new Error('Refresh response did not include a token.');
        }

        const user = buildUserFromAuthResponse(response.data);
        storeAuthSession(token, user);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const redirectToLoginForReauth = () => {
  clearAuthSession();

  if (typeof window === 'undefined') {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const authPaths = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

  if (!authPaths.has(window.location.pathname)) {
    storePostAuthRedirect(currentPath);
  }

  markSessionExpiredNotice();

  if (window.location.pathname !== '/login') {
    window.location.assign('/login?reauth=1');
  }
};

client.interceptors.request.use(
  (config) => {
    const nextConfig = config as RetryableRequestConfig;
    const token = readStoredToken();
    if (token) {
      nextConfig.headers.Authorization = `Bearer ${token}`;
    }
    return nextConfig;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = (error?.config ?? {}) as RetryableRequestConfig;

    if (originalRequest.skipAuthRefresh) {
      return Promise.reject(error);
    }

    if (error?.response?.status === 401 && isJwtAuthFailure(error) && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return client(originalRequest);
        }
      } catch {
        redirectToLoginForReauth();
      }
    }

    return Promise.reject(error);
  }
);

export default client;
