import client from './client';

const SESSION_KEY = 'rt_session_id';
const SESSION_EVENT_PREFIX = 'rt_session_event:';

const getSessionId = () => {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(SESSION_KEY, generated);
  return generated;
};

export const trackEvent = async (
  name: string,
  metadata: Record<string, unknown> = {}
) => {
  try {
    await client.post('/analytics/events', {
      name,
      metadata,
      path: window.location.pathname,
      sessionId: getSessionId(),
    });
  } catch (error) {
    // Swallow analytics failures to avoid UX impact.
  }
};

export const trackEventOncePerSession = async (
  name: string,
  metadata: Record<string, unknown> = {},
  key: string = name
) => {
  if (typeof window === 'undefined') {
    return trackEvent(name, metadata);
  }

  const storageKey = `${SESSION_EVENT_PREFIX}${key}`;
  if (window.sessionStorage.getItem(storageKey) === '1') {
    return;
  }

  window.sessionStorage.setItem(storageKey, '1');
  await trackEvent(name, metadata);
};
