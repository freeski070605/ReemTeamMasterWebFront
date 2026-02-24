import { Contest, GameMode, Table } from '../types/game';

const DEFAULT_MODE: GameMode = 'FREE_RTC_TABLE';

interface ModeCopyEntry {
  label: string;
  badge: string;
  description: string;
}

const MODE_COPY: Record<GameMode, ModeCopyEntry> = {
  FREE_RTC_TABLE: {
    label: 'Free Reem Team Cash Crib',
    badge: 'Free Crib',
    description: 'Free Reem Team Cash games with continuous hands and between-round seat rotation.',
  },
  RTC_TOURNAMENT: {
    label: 'Reem Team Cash Tournament',
    badge: 'Reem Team Cash Tournament',
    description: 'Locked-seat Reem Team Cash tournament with fixed pool and placement payout.',
  },
  RTC_SATELLITE: {
    label: 'Reem Team Cash Satellite',
    badge: 'Satellite Tournament',
    description: 'Reem Team Cash qualifier tournament where top finishers earn Cash Crown tickets.',
  },
  USD_CONTEST: {
    label: 'Cash Crown Tournament',
    badge: 'Cash Crown Tournament',
    description: 'USD tournament with a fixed buy-in, locked pool, and placement payout.',
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

export const formatRtcStake = (stakeTier: number): string =>
  `${rtcFromTier(stakeTier).toLocaleString()} Reem Team Cash`;

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
    unit: 'Reem Team Cash',
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
    return `Cash Crown Tournament ${suffix}`;
  }

  return `Crib ${suffix}`;
};

export const getContestDisplayName = (contestId: string): string => {
  const shortId = contestId.slice(-6).toUpperCase();
  return `Cash Crown #${shortId}`;
};

export const getContestStatusLabel = (status: Contest['status']): string => CONTEST_STATUS_COPY[status];
