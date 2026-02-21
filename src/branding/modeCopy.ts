import { Contest, GameMode, Table } from '../types/game';

const DEFAULT_MODE: GameMode = 'FREE_RTC_TABLE';

interface ModeCopyEntry {
  label: string;
  badge: string;
  description: string;
}

const MODE_COPY: Record<GameMode, ModeCopyEntry> = {
  FREE_RTC_TABLE: {
    label: 'Crib Run',
    badge: 'Open Crib',
    description: 'Continuous RTC hands where players can rotate in between rounds.',
  },
  RTC_TOURNAMENT: {
    label: 'Block Bracket',
    badge: 'Bracket Play',
    description: 'Locked RTC bracket with fixed seats, fixed pool, and placement payout.',
  },
  RTC_SATELLITE: {
    label: 'Ticket Grind',
    badge: 'Ticket Hunt',
    description: 'RTC qualifier tables where top finishers earn contest tickets.',
  },
  USD_CONTEST: {
    label: 'Cash Crown',
    badge: 'Cash Crown',
    description: 'Fixed USD buy-in contests with locked pools and post-match settlement.',
  },
};

const CONTEST_STATUS_COPY: Record<Contest['status'], string> = {
  draft: 'Building',
  open: 'Open Seats',
  locked: 'Seats Locked',
  'in-progress': 'Hand Live',
  completed: 'Paid Out',
  cancelled: 'Canceled',
};

export const resolveMode = (mode?: GameMode): GameMode => mode ?? DEFAULT_MODE;

export const getModeCopy = (mode?: GameMode): ModeCopyEntry => MODE_COPY[resolveMode(mode)];

export const getModeLabel = (mode?: GameMode): string => getModeCopy(mode).label;

export const getModeBadge = (mode?: GameMode): string => getModeCopy(mode).badge;

export const getModeDescription = (mode?: GameMode): string => getModeCopy(mode).description;

const rtcFromTier = (stakeTier: number): number => stakeTier * 1000;

export const formatRtcStake = (stakeTier: number): string => `${rtcFromTier(stakeTier).toLocaleString()} RTC`;

export const getStakeDisplay = (
  stakeTier: number,
  mode?: GameMode
): { amount: string; unit: string } => {
  if (resolveMode(mode) === 'USD_CONTEST') {
    return {
      amount: `$${stakeTier}`,
      unit: 'Cash Buy-In',
    };
  }

  return {
    amount: rtcFromTier(stakeTier).toLocaleString(),
    unit: 'RTC Ante',
  };
};

export const getStakeTierHeading = (stakeTier: number): string =>
  `$${stakeTier} Tier / ${formatRtcStake(stakeTier)}`;

export const getTableDisplayName = (table: Pick<Table, '_id' | 'name' | 'mode'>): string => {
  if (table.name && table.name.trim().length > 0) {
    return table.name;
  }

  const suffix = table._id.slice(-4).toUpperCase();
  if (resolveMode(table.mode) === 'USD_CONTEST') {
    return `Cash Crown Crib ${suffix}`;
  }

  return `Crib ${suffix}`;
};

export const getContestDisplayName = (contestId: string): string => {
  const shortId = contestId.slice(-6).toUpperCase();
  return `Cash Crown #${shortId}`;
};

export const getContestStatusLabel = (status: Contest['status']): string => CONTEST_STATUS_COPY[status];
