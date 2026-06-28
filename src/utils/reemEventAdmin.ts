import { RoundReceipt } from "./reemEvents";

export type ReemEventType = "quick_smoke" | "friday_night_reem" | "crown_room" | "custom";
export type ReemEventStatus =
  | "draft"
  | "scheduled"
  | "registration_open"
  | "live"
  | "paused"
  | "completed"
  | "canceled";

export type EventWinnerRule = "net_rtc_profit";
export type EventTiebreaker =
  | "most_hands_won"
  | "most_reems"
  | "lowest_final_hand_score"
  | "sudden_death_or_shared_crown";

export type EventPlayerStats = {
  playerId: string;
  playerName: string;
  startingStackRtc: number;
  currentStackRtc: number;
  netRtc: number;
  handsWon: number;
  reems: number;
  successfulDrops: number;
  failedDrops: number;
  biggestPayoutRtc: number;
  finalHandScore?: number;
  averagePoints?: number;
};

export type ReemEventSession = {
  eventId: string;
  tableId: string;
  players: EventPlayerStats[];
  currentHandNumber: number;
  status: ReemEventStatus;
  leaderboard: EventPlayerStats[];
  receipts: RoundReceipt[];
  completedAt?: string | null;
};

export type ReemEvent = {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  eventType: ReemEventType;
  status: ReemEventStatus;
  cribId?: string | null;
  cribName: string;
  isPublic: boolean;
  isPrivate: boolean;
  handLimit: number;
  startingStackRtc: number;
  stakeRtc: number;
  maxPlayers: number;
  maxTables?: number;
  startTime?: string;
  registrationOpenAt?: string;
  registrationCloseAt?: string;
  prizeLabel?: string;
  rewardText?: string;
  winnerBadgeLabel?: string;
  crownDurationText?: string;
  tagline?: string;
  winnerRule: EventWinnerRule;
  tiebreakers: EventTiebreaker[];
  createdBy?: string | null;
  adminId?: string | null;
  createdAt: string;
  updatedAt: string;
  registeredPlayers: EventPlayerStats[];
  sessions: ReemEventSession[];
  receipts: RoundReceipt[];
};

export type EventAwards = {
  cribWinner?: EventPlayerStats;
  reemKing?: EventPlayerStats;
  dropDemon?: EventPlayerStats;
  crashOut?: EventPlayerStats;
  biggestHand?: EventPlayerStats;
  survivor?: EventPlayerStats;
};

export const EVENT_TIEBREAKERS: EventTiebreaker[] = [
  "most_hands_won",
  "most_reems",
  "lowest_final_hand_score",
  "sudden_death_or_shared_crown",
];

export const EVENT_TYPE_LABELS: Record<ReemEventType, string> = {
  quick_smoke: "Quick Smoke",
  friday_night_reem: "Friday Night Reem",
  crown_room: "Crown Room",
  custom: "Custom",
};

export const EVENT_DEFAULTS: Record<ReemEventType, Pick<ReemEvent, "handLimit" | "startingStackRtc" | "stakeRtc" | "maxPlayers" | "maxTables" | "tagline" | "rewardText" | "crownDurationText">> = {
  quick_smoke: {
    handLimit: 8,
    startingStackRtc: 10000,
    stakeRtc: 1000,
    maxPlayers: 4,
    maxTables: 1,
    tagline: "Get in. Run 8. Crown somebody.",
    rewardText: "Quick Smoke crown",
    crownDurationText: "Crown lasts until the next run.",
  },
  friday_night_reem: {
    handLimit: 12,
    startingStackRtc: 10000,
    stakeRtc: 5000,
    maxPlayers: 4,
    maxTables: 4,
    tagline: "12 hands. Top stack owns the crib.",
    rewardText: "Friday crown",
    crownDurationText: "Crown stays until next week.",
  },
  crown_room: {
    handLimit: 16,
    startingStackRtc: 50000,
    stakeRtc: 10000,
    maxPlayers: 4,
    maxTables: 2,
    tagline: "No excuses after 16.",
    rewardText: "Crown Room badge",
    crownDurationText: "Crown stays until challenged.",
  },
  custom: {
    handLimit: 12,
    startingStackRtc: 10000,
    stakeRtc: 1000,
    maxPlayers: 4,
    maxTables: 1,
    tagline: "Custom crib event.",
    rewardText: "Crew crown",
    crownDurationText: "Crown duration set by host.",
  },
};

const STORAGE_KEY = "reemteam-admin-events:v1";

const nowIso = () => new Date().toISOString();
const fallbackRandom = () => Math.random().toString(36).slice(2, 8);

export const slugifyEvent = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || `event-${fallbackRandom()}`;

export const makeInviteCode = (name: string) => `${slugifyEvent(name).replace(/-/g, "").slice(0, 8)}${fallbackRandom()}`.toUpperCase();

export const createEmptyEvent = (adminId?: string | null, eventType: ReemEventType = "friday_night_reem"): ReemEvent => {
  const defaults = EVENT_DEFAULTS[eventType];
  const createdAt = nowIso();
  const name = EVENT_TYPE_LABELS[eventType];

  return {
    id: `evt_${Date.now()}_${fallbackRandom()}`,
    name,
    slug: slugifyEvent(name),
    inviteCode: makeInviteCode(name),
    eventType,
    status: "draft",
    cribName: "Free's Crib",
    isPublic: true,
    isPrivate: false,
    handLimit: defaults.handLimit,
    startingStackRtc: defaults.startingStackRtc,
    stakeRtc: defaults.stakeRtc,
    maxPlayers: defaults.maxPlayers,
    maxTables: defaults.maxTables,
    startTime: "",
    registrationOpenAt: "",
    registrationCloseAt: "",
    prizeLabel: defaults.rewardText,
    rewardText: defaults.rewardText,
    winnerBadgeLabel: "Crib Winner",
    crownDurationText: defaults.crownDurationText,
    tagline: defaults.tagline,
    winnerRule: "net_rtc_profit",
    tiebreakers: EVENT_TIEBREAKERS,
    createdBy: adminId,
    adminId,
    createdAt,
    updatedAt: createdAt,
    registeredPlayers: [],
    sessions: [],
    receipts: [],
  };
};

const seedPlayers = (startingStackRtc: number): EventPlayerStats[] => [
  {
    playerId: "ace",
    playerName: "Ace",
    startingStackRtc,
    currentStackRtc: startingStackRtc + 8000,
    netRtc: 8000,
    handsWon: 4,
    reems: 2,
    successfulDrops: 1,
    failedDrops: 0,
    biggestPayoutRtc: 5000,
    finalHandScore: 9,
    averagePoints: 14,
  },
  {
    playerId: "cash",
    playerName: "Cash",
    startingStackRtc,
    currentStackRtc: startingStackRtc + 2500,
    netRtc: 2500,
    handsWon: 3,
    reems: 1,
    successfulDrops: 2,
    failedDrops: 1,
    biggestPayoutRtc: 3000,
    finalHandScore: 11,
    averagePoints: 16,
  },
  {
    playerId: "blaze",
    playerName: "Blaze",
    startingStackRtc,
    currentStackRtc: startingStackRtc - 1500,
    netRtc: -1500,
    handsWon: 2,
    reems: 0,
    successfulDrops: 1,
    failedDrops: 1,
    biggestPayoutRtc: 2000,
    finalHandScore: 13,
    averagePoints: 12,
  },
  {
    playerId: "drift",
    playerName: "Drift",
    startingStackRtc,
    currentStackRtc: startingStackRtc - 9000,
    netRtc: -9000,
    handsWon: 1,
    reems: 0,
    successfulDrops: 0,
    failedDrops: 3,
    biggestPayoutRtc: 1000,
    finalHandScore: 27,
    averagePoints: 21,
  },
];

const createSeedEvents = (): ReemEvent[] => {
  const friday = createEmptyEvent("seed-admin", "friday_night_reem");
  friday.status = "registration_open";
  friday.name = "Friday Night Reem";
  friday.slug = "friday-night-reem";
  friday.inviteCode = "FNR12";
  friday.registeredPlayers = seedPlayers(friday.startingStackRtc).slice(0, 3);

  const quick = createEmptyEvent("seed-admin", "quick_smoke");
  quick.status = "scheduled";
  quick.name = "Quick Smoke: Late Table";
  quick.slug = "quick-smoke-late-table";
  quick.inviteCode = "SMOKE8";
  quick.cribName = "The Basement";

  const crown = createEmptyEvent("seed-admin", "crown_room");
  crown.status = "completed";
  crown.name = "Crown Room Invite";
  crown.slug = "crown-room-invite";
  crown.inviteCode = "CROWN16";
  crown.isPublic = false;
  crown.isPrivate = true;
  crown.registeredPlayers = seedPlayers(crown.startingStackRtc);
  crown.sessions = [
    {
      eventId: crown.id,
      tableId: "table-crown-room",
      players: crown.registeredPlayers,
      currentHandNumber: crown.handLimit,
      status: "completed",
      leaderboard: calculateEventLeaderboard(crown.registeredPlayers),
      receipts: [],
      completedAt: nowIso(),
    },
  ];

  return [friday, quick, crown].map((event) => ({ ...event, updatedAt: nowIso() }));
};

const readStoredEvents = (): ReemEvent[] => {
  if (typeof window === "undefined") return createSeedEvents();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = createSeedEvents();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(raw) as ReemEvent[];
  } catch {
    const seeded = createSeedEvents();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
};

const writeStoredEvents = (events: ReemEvent[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

export const eventRepository = {
  list: () => readStoredEvents(),
  get: (idOrSlug: string) => readStoredEvents().find((event) => event.id === idOrSlug || event.slug === idOrSlug || event.inviteCode === idOrSlug) ?? null,
  save: (event: ReemEvent) => {
    const events = readStoredEvents();
    const nextEvent = { ...event, slug: event.slug || slugifyEvent(event.name), inviteCode: event.inviteCode || makeInviteCode(event.name), updatedAt: nowIso() };
    const index = events.findIndex((item) => item.id === nextEvent.id);
    const next = index >= 0 ? events.map((item) => (item.id === nextEvent.id ? nextEvent : item)) : [nextEvent, ...events];
    writeStoredEvents(next);
    return nextEvent;
  },
  updateStatus: (id: string, status: ReemEventStatus) => {
    const event = eventRepository.get(id);
    if (!event) return null;
    return eventRepository.save({
      ...event,
      status,
      sessions:
        status === "live" && event.sessions.length === 0
          ? [
              {
                eventId: event.id,
                tableId: `evt_table_${event.id.slice(-6)}`,
                players: event.registeredPlayers,
                currentHandNumber: 1,
                status,
                leaderboard: calculateEventLeaderboard(event.registeredPlayers),
                receipts: event.receipts,
              },
            ]
          : event.sessions.map((session) => ({ ...session, status })),
    });
  },
  registerPlayer: (idOrSlug: string, player: Pick<EventPlayerStats, "playerId" | "playerName">) => {
    const event = eventRepository.get(idOrSlug);
    if (!event) return null;
    if (event.registeredPlayers.some((entry) => entry.playerId === player.playerId)) return event;
    if (event.registeredPlayers.length >= event.maxPlayers * (event.maxTables ?? 1)) return event;
    return eventRepository.save({
      ...event,
      registeredPlayers: [
        ...event.registeredPlayers,
        {
          ...player,
          startingStackRtc: event.startingStackRtc,
          currentStackRtc: event.startingStackRtc,
          netRtc: 0,
          handsWon: 0,
          reems: 0,
          successfulDrops: 0,
          failedDrops: 0,
          biggestPayoutRtc: 0,
        },
      ],
    });
  },
};

export const calculateEventLeaderboard = (eventPlayers: EventPlayerStats[]): EventPlayerStats[] =>
  [...eventPlayers].sort((a, b) => {
    if (b.netRtc !== a.netRtc) return b.netRtc - a.netRtc;
    if (b.handsWon !== a.handsWon) return b.handsWon - a.handsWon;
    if (b.reems !== a.reems) return b.reems - a.reems;
    return (a.finalHandScore ?? Number.MAX_SAFE_INTEGER) - (b.finalHandScore ?? Number.MAX_SAFE_INTEGER);
  });

export const resolveEventWinner = (eventPlayers: EventPlayerStats[]) => calculateEventLeaderboard(eventPlayers)[0] ?? null;

const topBy = (players: EventPlayerStats[], score: (player: EventPlayerStats) => number) =>
  [...players].sort((a, b) => score(b) - score(a))[0];

const lowBy = (players: EventPlayerStats[], score: (player: EventPlayerStats) => number | undefined) =>
  [...players].sort((a, b) => (score(a) ?? Number.MAX_SAFE_INTEGER) - (score(b) ?? Number.MAX_SAFE_INTEGER))[0];

export const calculateEventAwards = (eventStats: EventPlayerStats[]): EventAwards => ({
  cribWinner: resolveEventWinner(eventStats) ?? undefined,
  reemKing: topBy(eventStats, (player) => player.reems),
  dropDemon: topBy(eventStats, (player) => player.successfulDrops),
  crashOut: topBy(eventStats, (player) => player.failedDrops),
  biggestHand: topBy(eventStats, (player) => player.biggestPayoutRtc),
  survivor: lowBy(eventStats, (player) => player.averagePoints),
});

export const buildEventInviteCopy = (event: Pick<ReemEvent, "name" | "handLimit" | "isPrivate" | "cribName">) =>
  event.isPrivate
    ? `Pull up to ${event.cribName}. Invite-only ReemTeam event. Run hands tonight.`
    : `Pull up to ${event.name} on ReemTeam. ${event.handLimit} hands. Top stack takes the crown. Seat open now.`;

export const buildEventRecapCopy = (event: ReemEvent) => {
  const winner = resolveEventWinner(event.registeredPlayers);
  const delta = winner ? `${winner.netRtc >= 0 ? "+" : ""}${winner.netRtc.toLocaleString("en-US")} RTC` : "crown open";
  return winner
    ? `${winner.playerName} won ${event.name}. ${event.handLimit} hands. ${delta}. ${event.crownDurationText || "Crown stays until next week."}`
    : `${event.name} results are live. ${event.handLimit} hands. ${event.crownDurationText || "Crown stays until next week."}`;
};

export const formatEventStatus = (status: ReemEventStatus) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
