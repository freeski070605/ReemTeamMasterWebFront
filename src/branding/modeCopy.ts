import { Contest, GameMode, Table } from '../types/game';

const DEFAULT_MODE: GameMode = 'FREE_RTC_TABLE';

interface ModeCopyEntry {
  label: string;
  badge: string;
  description: string;
}

const MODE_COPY: Record<GameMode, ModeCopyEntry> = {
  FREE_RTC_TABLE: {
    label: 'Reem Team Cash Crib',
    badge: 'Crib',
    description: 'Reem Team Cash games with continuous hands and between-round seat rotation.',
  },
  PRIVATE_USD_TABLE: {
    label: 'Private Cash Table',
    badge: 'Private Cash',
    description: 'Invite-only USD table hosted by a VIP player with human-only seats.',
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
  if (resolveMode(mode) === 'USD_CONTEST' || resolveMode(mode) === 'PRIVATE_USD_TABLE') {
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

export const getStakeTierHeading = (stakeTier: number, mode?: GameMode): string => {
  if (resolveMode(mode) === 'USD_CONTEST') {
    return `$${stakeTier} Tournament Tier`;
  }

  if (resolveMode(mode) === 'PRIVATE_USD_TABLE') {
    return `$${stakeTier} Private Cash Table`;
  }

  return `${formatRtcStake(stakeTier)} Tier`;
};

export const getTableDisplayName = (table: Pick<Table, '_id' | 'name' | 'mode' | 'stake'>): string => {
  const mode = resolveMode(table.mode);
  const normalizedName = table.name?.trim();

  const suffix = table._id.slice(-4).toUpperCase();
  if ((table as Table).isPrivate && normalizedName) {
    return normalizedName;
  }

  if (mode === 'USD_CONTEST') {
    if (normalizedName) {
      return normalizedName;
    }
    return `Cash Crown Tournament ${suffix}`;
  }

  if (mode === 'PRIVATE_USD_TABLE') {
    if (normalizedName) {
      return normalizedName;
    }
    return `Private Cash Table ${suffix}`;
  }

  if (typeof table.stake === 'number' && Number.isFinite(table.stake)) {
    return `Crib ${rtcFromTier(table.stake).toLocaleString()} Reem Team Cash`;
  }

  return `Crib ${suffix}`;
};

export const getContestDisplayName = (contestId: string): string => {
  const shortId = contestId.slice(-6).toUpperCase();
  return `Cash Crown #${shortId}`;
};

export const getContestStatusLabel = (status: Contest['status']): string => CONTEST_STATUS_COPY[status];
