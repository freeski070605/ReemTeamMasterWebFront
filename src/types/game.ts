export type CardSuit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type CardRank = 'Ace' | '2' | '3' | '4' | '5' | '6' | '7' | 'Jack' | 'Queen' | 'King';

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
  roundEndedBy: 'REGULAR' | 'REEM' | 'AUTO_TRIPLE' | 'CAUGHT_DROP' | 'DECK_EMPTY' | null;
  roundWinnerId?: string;
  roundLoserId?: string;
  caughtDroppingPlayerId?: string;
  handScores?: { [userId: string]: number };
  payouts?: { [userId: string]: number };
}

export interface Table {
  _id: string;
  stake: number;
  minPlayers: number;
  maxPlayers: number;
  currentPlayerCount: number;
  status: 'waiting' | 'in-game';
  name?: string;
}
