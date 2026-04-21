export const ANALYTICS_EVENTS = {
  appOpen: 'app_open',
  signedIn: 'signed_in',
  quickPlayImpression: 'quick_play_impression',
  quickPlayClick: 'quick_play_click',
  browseCribsClick: 'browse_cribs_click',
  howToPlayClick: 'how_to_play_click',
  recommendedTableImpression: 'recommended_table_impression',
  tableCardClick: 'table_card_click',
  joinTableAttempt: 'join_table_attempt',
  joinTableSuccess: 'join_table_success',
  joinTableFail: 'join_table_fail',
  firstGameStarted: 'first_game_started',
  firstGameCompleted: 'first_game_completed',
  firstGameAbandon: 'first_game_abandon',
  returnAfterFirstGame: 'return_after_first_game',
  firstTimeUserDetected: 'first_time_user_detected',
  firstTimeUserRoutedToQuickPlay: 'first_time_user_routed_to_quick_play',
} as const;

export const ACTIVATION_FUNNEL_STEPS = [
  {
    id: 'signed_in',
    description: 'Authenticated player session is ready to enter the pre-game experience.',
  },
  {
    id: 'quick_play_impression',
    description: 'Player saw the dominant play CTA on the launch-first screen.',
  },
  {
    id: 'quick_play_click',
    description: 'Player chose the primary quick-play path.',
  },
  {
    id: 'join_table_attempt',
    description: 'ReemTeam attempted to seat the player into a crib.',
  },
  {
    id: 'first_game_started',
    description: 'Player reached their first live hand.',
  },
  {
    id: 'first_game_completed',
    description: 'Player finished their first recorded game.',
  },
] as const;
