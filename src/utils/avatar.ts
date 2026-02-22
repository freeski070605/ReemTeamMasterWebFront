const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getApiOrigin = () => {
  try {
    if (typeof window !== 'undefined') {
      return new URL(API_URL, window.location.origin).origin;
    }

    return new URL(API_URL).origin;
  } catch (_error) {
    return '';
  }
};

const normalizeAvatarPath = (avatarUrl: string) => {
  if (/^\/avatars\/avatar[1-4]\.png$/i.test(avatarUrl)) {
    return avatarUrl.replace(/\.png$/i, '.svg');
  }

  if (/^\/avatars\/default\.png$/i.test(avatarUrl)) {
    return avatarUrl.replace(/\.png$/i, '.svg');
  }

  if (avatarUrl.startsWith('/public/avatars/')) {
    return avatarUrl.replace('/public/avatars/', '/avatars/');
  }

  if (avatarUrl.startsWith('public/avatars/')) {
    return `/${avatarUrl.replace('public/avatars/', 'avatars/')}`;
  }

  return avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`;
};

export const resolveAvatarUrl = (avatarUrl?: string): string | undefined => {
  if (!avatarUrl) {
    return undefined;
  }

  const trimmed = avatarUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const normalizedPath = normalizeAvatarPath(trimmed);
  const apiOrigin = getApiOrigin();

  if (!apiOrigin) {
    return normalizedPath;
  }

  return `${apiOrigin}${normalizedPath}`;
};
