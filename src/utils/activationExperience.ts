import { buildGamePath } from './gamePath';

const STORAGE_PREFIX = 'rt_activation_experience:';

export interface ActivationExperienceState {
  hasPlayedGame: boolean;
  hasCompletedGame: boolean;
  hasSeenQuickPlayIntro: boolean;
  hasDismissedLearnMore: boolean;
  hasSeenPostFirstGamePrompt: boolean;
  firstGameStartedAt: string | null;
  firstGameCompletedAt: string | null;
}

export interface ActivationServerState {
  hasPlayedGame: boolean;
  hasCompletedGame: boolean;
  lastStartedAt?: string | null;
  lastCompletedAt?: string | null;
}

const DEFAULT_STATE: ActivationExperienceState = {
  hasPlayedGame: false,
  hasCompletedGame: false,
  hasSeenQuickPlayIntro: false,
  hasDismissedLearnMore: false,
  hasSeenPostFirstGamePrompt: false,
  firstGameStartedAt: null,
  firstGameCompletedAt: null,
};

const getStorageKey = (userId?: string | null) => `${STORAGE_PREFIX}${userId || 'guest'}`;

const isBrowser = () => typeof window !== 'undefined';

export const readActivationExperience = (userId?: string | null): ActivationExperienceState => {
  if (!isBrowser()) {
    return DEFAULT_STATE;
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(getStorageKey(userId)) || 'null');
    if (!stored || typeof stored !== 'object') {
      return DEFAULT_STATE;
    }

    return {
      ...DEFAULT_STATE,
      ...stored,
      hasPlayedGame: !!stored.hasPlayedGame,
      hasCompletedGame: !!stored.hasCompletedGame,
      hasSeenQuickPlayIntro: !!stored.hasSeenQuickPlayIntro,
      hasDismissedLearnMore: !!stored.hasDismissedLearnMore,
      hasSeenPostFirstGamePrompt: !!stored.hasSeenPostFirstGamePrompt,
      firstGameStartedAt: typeof stored.firstGameStartedAt === 'string' ? stored.firstGameStartedAt : null,
      firstGameCompletedAt: typeof stored.firstGameCompletedAt === 'string' ? stored.firstGameCompletedAt : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
};

export const updateActivationExperience = (
  userId: string | null | undefined,
  patch: Partial<ActivationExperienceState>
) => {
  const nextState = {
    ...readActivationExperience(userId),
    ...patch,
  };

  if (isBrowser()) {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(nextState));
  }

  return nextState;
};

export const resolveActivationExperience = (
  userId: string | null | undefined,
  serverState?: ActivationServerState | null
) => {
  const localState = readActivationExperience(userId);
  const hasPlayedGame = !!serverState?.hasPlayedGame || localState.hasPlayedGame;
  const hasCompletedGame = !!serverState?.hasCompletedGame || localState.hasCompletedGame;

  return {
    ...localState,
    hasPlayedGame,
    hasCompletedGame,
    firstGameStartedAt: localState.firstGameStartedAt ?? serverState?.lastStartedAt ?? null,
    firstGameCompletedAt: localState.firstGameCompletedAt ?? serverState?.lastCompletedAt ?? null,
  };
};

export const markQuickPlayIntroSeen = (userId?: string | null) =>
  updateActivationExperience(userId, { hasSeenQuickPlayIntro: true });

export const dismissLearnMore = (userId?: string | null) =>
  updateActivationExperience(userId, { hasDismissedLearnMore: true });

export const markFirstGameStarted = (userId?: string | null) =>
  updateActivationExperience(userId, {
    hasPlayedGame: true,
    firstGameStartedAt: new Date().toISOString(),
  });

export const markFirstGameCompleted = (userId?: string | null) =>
  updateActivationExperience(userId, {
    hasPlayedGame: true,
    hasCompletedGame: true,
    firstGameCompletedAt: new Date().toISOString(),
    hasSeenPostFirstGamePrompt: false,
  });

export const markPostFirstGamePromptSeen = (userId?: string | null) =>
  updateActivationExperience(userId, { hasSeenPostFirstGamePrompt: true });

export const getResumeGamePath = () => {
  if (!isBrowser()) {
    return null;
  }

  const tableId = window.localStorage.getItem('last_table_id');
  if (!tableId) {
    return null;
  }

  const inviteCode = window.localStorage.getItem('last_table_invite_code');
  return buildGamePath(tableId, {
    inviteCode,
    entry: 'resume',
  });
};
