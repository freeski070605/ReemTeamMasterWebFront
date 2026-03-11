import client from './client';

const SESSION_KEY = 'rt_session_id';

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
