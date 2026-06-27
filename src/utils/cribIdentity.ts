import { Table } from "../types/game";
import { formatRTCCompactAmount } from "./rtcCurrency";

export type ReputationTag =
  | "Drop Demon"
  | "Reem Hunter"
  | "Table Bully"
  | "Safe Player"
  | "Crash Out"
  | "Closer"
  | "Crown Holder"
  | "Run Back Ready";

export type CribTier = "quick_smoke" | "friday_night_reem" | "crown_room";
export type EventType = CribTier;

export type Crib = {
  id: string;
  name: string;
  stakeRtc: number;
  seatsTaken: number;
  maxSeats: number;
  vibe: string;
  isPrivate?: boolean;
  crownHolderName?: string;
  eventType?: EventType;
};

type CribIdentity = {
  name: string;
  vibe: string;
  crownFallback: string;
  eventType: EventType;
};

const stakeToRtc = (stakeTier: number) => stakeTier * 1000;

export const getCribIdentity = (
  table: Pick<Table, "_id" | "stake" | "isPrivate" | "name" | "hostNote">
): CribIdentity => {
  const customName = table.name?.trim();

  if (table.isPrivate) {
    return {
      name: customName || "Da Crown Room",
      vibe: table.hostNote?.trim() || "Crew tables. Rivalries. Receipts.",
      crownFallback: "Crown open.",
      eventType: "crown_room",
    };
  }

  if (table.stake <= 1) {
    return {
      name: customName || "The Basement",
      vibe: "Fast hands. New players welcome.",
      crownFallback: "Crown open.",
      eventType: "quick_smoke",
    };
  }

  if (table.stake <= 10) {
    return {
      name: customName || "Back Room",
      vibe: "For players who know when to drop.",
      crownFallback: "Take the crown.",
      eventType: "friday_night_reem",
    };
  }

  if (table.stake <= 50) {
    return {
      name: customName || "Kitchen Table",
      vibe: "Big talk. Bigger swings.",
      crownFallback: "Take the crown.",
      eventType: "friday_night_reem",
    };
  }

  return {
    name: customName || "Da Crown Room",
    vibe: "Invite only. Crew tables and rivalries.",
    crownFallback: "Crown open.",
    eventType: "crown_room",
  };
};

export const tableToCrib = (table: Table): Crib => {
  const identity = getCribIdentity(table);

  return {
    id: table._id,
    name: identity.name,
    stakeRtc: stakeToRtc(table.stake),
    seatsTaken: table.currentPlayerCount,
    maxSeats: table.maxPlayers,
    vibe: identity.vibe,
    isPrivate: table.isPrivate,
    crownHolderName: undefined,
    eventType: identity.eventType,
  };
};

export const formatCribStake = (stakeTier: number) => `${formatRTCCompactAmount(stakeToRtc(stakeTier))} RTC`;

export const getCrownLine = (table: Pick<Table, "_id" | "stake" | "isPrivate" | "name" | "hostNote">, crownHolderName?: string | null) => {
  const identity = getCribIdentity(table);
  return crownHolderName ? `King: ${crownHolderName}` : identity.crownFallback;
};

export const getLightReputationTag = (seed?: string | null): ReputationTag => {
  const tags: ReputationTag[] = ["Drop Demon", "Reem Hunter", "Safe Player", "Closer", "Run Back Ready"];
  const text = seed || "reemteam";
  const sum = text.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return tags[sum % tags.length];
};
