export type CardSuit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type CardRank = 'Ace' | '2' | '3' | '4' | '5' | '6' | '7' | 'Jack' | 'Queen' | 'King';
export type GameMode = 'FREE_RTC_TABLE' | 'RTC_TOURNAMENT' | 'RTC_SATELLITE' | 'USD_CONTEST';
export type RoundEndType = 'REGULAR' | 'REEM' | 'AUTO_TRIPLE' | 'CAUGHT_DROP' | 'DECK_EMPTY';
export type PlacementWinType = RoundEndType | 'LOSS';

export interface Card {
  suit: CardSuit;
  rank: CardRank;
  value: number;
}

export interface Player {
  userId: string;
  username: string;
  avatarUrl?: string;
  hand: Card[];
  isAI: boolean;
  isHitLocked: boolean;
  hitLockCounter: number;
  spreads: Card[][];
  hasSpreadThisTurn: boolean;
  numberOfSpreadsThisTurn: number;
  hasTakenActionThisTurn: boolean;
  currentBuyIn: number;
  restrictedDiscardCard?: string | null;
}

export interface IGameState {
  tableId: string;
  mode?: GameMode;
  contestId?: string | null;
  currentDealerIndex: number;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  turn: number;
  currentPlayerIndex: number;
  lastAction: { type: string; payload: any; timestamp: number } | null;
  status: 'waiting' | 'starting' | 'in-progress' | 'round-end' | 'game-end';
  baseStake: number;
  pot: number;
  lockedAntes: { [userId: string]: number };
  roundEndedBy: RoundEndType | null;
  roundWinnerId?: string;
  roundLoserId?: string;
  caughtDroppingPlayerId?: string;
  handScores?: { [userId: string]: number };
  placements?: Placement[];
  roundEntryApplied?: boolean;
  roundSettlementStatus?: 'pending' | 'settled' | 'failed';
  roundSettlementError?: string | null;
  roundSettledAt?: number | null;
  roundSettlementReference?: string | null;
  payouts?: { [userId: string]: number };
  roundReadyPlayerIds?: string[];
  roundReadyDeadline?: number | null;
}

export interface Placement {
  userId: string;
  rank: number;
  winType: PlacementWinType;
}

export interface RoundResult {
  sessionId: string;
  mode: GameMode;
  placements: Placement[];
}

export interface Table {
  _id: string;
  stake: number;
  mode?: GameMode;
  activeContestId?: string;
  minPlayers: number;
  maxPlayers: number;
  currentPlayerCount: number;
  status: 'waiting' | 'in-game';
  name?: string;
}

export interface Contest {
  _id: string;
  contestId: string;
  mode: GameMode;
  entryFee: number;
  playerCount: number;
  prizePool: number;
  platformFee: number;
  status: 'draft' | 'open' | 'locked' | 'in-progress' | 'completed' | 'cancelled';
  participants?: string[];
}

export interface TournamentTicket {
  _id: string;
  contestType: string;
  targetMode: GameMode;
  sourceMode: GameMode;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
}
