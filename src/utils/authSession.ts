import { UserRole, resolveUserRole } from '../types/roles';

export interface AuthUser {
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

const TOKEN_STORAGE_KEY = 'token';
const USER_STORAGE_KEY = 'user';
const POST_AUTH_REDIRECT_KEY = 'rt_post_auth_redirect';
const SESSION_EXPIRED_NOTICE_KEY = 'rt_session_expired_notice';

const isBrowser = () => typeof window !== 'undefined';

export const normalizeStoredUser = (value: any): AuthUser | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (typeof value._id !== 'string' || typeof value.username !== 'string' || typeof value.email !== 'string') {
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

export const buildUserFromAuthResponse = (
  data: any,
  fallback?: Partial<Pick<AuthUser, 'username' | 'email'>>
): AuthUser => {
  const resolvedRole = resolveUserRole(data?.role, !!data?.isAdmin);

  return {
    _id: String(data?.userId ?? data?._id ?? ''),
    username: String(data?.username ?? fallback?.username ?? 'User'),
    email: String(data?.email ?? fallback?.email ?? ''),
    avatarUrl: data?.avatarUrl,
    role: resolvedRole,
    isAdmin: resolvedRole === 'admin' || resolvedRole === 'superadmin',
    isVip: !!data?.isVip,
    vipStatus: data?.vipStatus,
    vipExpiresAt: data?.vipExpiresAt ?? null,
    vipSince: data?.vipSince ?? null,
  };
};

export const readStoredToken = () => {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const readStoredUser = () => {
  if (!isBrowser()) {
    return null;
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY) || 'null');
    return normalizeStoredUser(stored);
  } catch {
    return null;
  }
};

export const storeAuthSession = (token: string, user: AuthUser) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
};

export const storePostAuthRedirect = (path: string) => {
  if (!isBrowser() || !path) {
    return;
  }

  window.sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, path);
};

export const consumePostAuthRedirect = () => {
  if (!isBrowser()) {
    return null;
  }

  const value = window.sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);
  if (value) {
    window.sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  }

  return value;
};

export const markSessionExpiredNotice = () => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, '1');
};

export const consumeSessionExpiredNotice = () => {
  if (!isBrowser()) {
    return false;
  }

  const marked = window.sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === '1';
  if (marked) {
    window.sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  }

  return marked;
};
