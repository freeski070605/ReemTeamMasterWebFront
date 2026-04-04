import { consumePostAuthRedirect } from './authSession';

type LocationLike = {
  pathname?: string;
  search?: string;
};

type AuthRedirectState = {
  from?: LocationLike;
  postAuthRedirect?: string;
};

export const buildInviteJoinPath = (tableId?: string | null, inviteCode?: string | null) => {
  if (!tableId) {
    return '/tables';
  }

  const query = inviteCode
    ? `?inviteCode=${encodeURIComponent(inviteCode)}`
    : '';

  return `/game/${tableId}${query}`;
};

export const getPostAuthRedirectPath = (state?: AuthRedirectState | null) => {
  if (typeof state?.postAuthRedirect === 'string' && state.postAuthRedirect.length > 0) {
    return state.postAuthRedirect;
  }

  const storedRedirect = consumePostAuthRedirect();
  if (storedRedirect) {
    return storedRedirect;
  }

  if (state?.from?.pathname) {
    return `${state.from.pathname}${state.from.search ?? ''}`;
  }

  return '/tables';
};
