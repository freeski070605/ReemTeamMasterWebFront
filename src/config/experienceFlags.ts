const isBrowser = () => typeof window !== 'undefined';

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const readFlagOverride = (key: string, fallback: boolean) => {
  if (!isBrowser()) {
    return fallback;
  }

  const raw = window.localStorage.getItem(`rt_flag:${key}`);
  if (raw === null) {
    return fallback;
  }

  return parseBoolean(raw, fallback);
};

const defineFlag = (key: string, envValue: string | undefined, fallback: boolean) =>
  readFlagOverride(key, parseBoolean(envValue, fallback));

export const experienceFlags = {
  newPreGameLayout: defineFlag('newPreGameLayout', process.env.REACT_APP_NEW_PRE_GAME_LAYOUT, true),
  quickPlayDefault: defineFlag('quickPlayDefault', process.env.REACT_APP_QUICK_PLAY_DEFAULT, true),
  firstTimeUserSimplifiedFlow: defineFlag(
    'firstTimeUserSimplifiedFlow',
    process.env.REACT_APP_FIRST_TIME_USER_SIMPLIFIED_FLOW,
    true
  ),
  secondaryContentCollapsed: defineFlag(
    'secondaryContentCollapsed',
    process.env.REACT_APP_SECONDARY_CONTENT_COLLAPSED,
    true
  ),
  recommendedTableRouting: defineFlag(
    'recommendedTableRouting',
    process.env.REACT_APP_RECOMMENDED_TABLE_ROUTING,
    true
  ),
  lobbyActivityStrip: defineFlag('lobbyActivityStrip', process.env.REACT_APP_LOBBY_ACTIVITY_STRIP, true),
  lobbyIdentityPanel: defineFlag('lobbyIdentityPanel', process.env.REACT_APP_LOBBY_IDENTITY_PANEL, true),
  lobbyTableMomentum: defineFlag('lobbyTableMomentum', process.env.REACT_APP_LOBBY_TABLE_MOMENTUM, true),
  enhancedTableMoments: defineFlag('enhancedTableMoments', process.env.REACT_APP_ENHANCED_TABLE_MOMENTS, true),
  enhancedRunItBackRail: defineFlag(
    'enhancedRunItBackRail',
    process.env.REACT_APP_ENHANCED_RUN_IT_BACK_RAIL,
    true
  ),
  enhancedSeatPresence: defineFlag('enhancedSeatPresence', process.env.REACT_APP_ENHANCED_SEAT_PRESENCE, true),
} as const;
