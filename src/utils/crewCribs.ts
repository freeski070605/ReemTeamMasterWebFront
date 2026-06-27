import { Table } from "../types/game";
import { RoundReceipt } from "./reemEvents";
import { formatRoundDeltaAmount } from "./roundResults";
import { formatRTCCompactAmount } from "./rtcCurrency";
import { getCribIdentity } from "./cribIdentity";

export type ReputationTag =
  | "Drop Demon"
  | "Reem Hunter"
  | "Table Bully"
  | "Crash Out"
  | "Safe Player"
  | "Closer"
  | "Crown Holder"
  | "Run Back Ready";

export type CrewCrib = {
  id: string;
  name: string;
  ownerId?: string | null;
  hostId?: string | null;
  isPrivate: boolean;
  inviteCode?: string | null;
  inviteSlug?: string | null;
  members: Array<{ userId: string; username?: string }>;
  crownHolder?: string;
  weeklyHandsPlayed: number;
  biggestReem?: string;
  worstDrop?: string;
  mostRtcWon?: string;
  recentReceipts: RoundReceipt[];
};

export type PlayerReputationStats = {
  isCrownHolder?: boolean;
  handsPlayed?: number;
  handsWon?: number;
  reems?: number;
  successfulDrops?: number;
  failedDrops?: number;
  biggestPayoutRtc?: number;
  rtcBalance?: number;
};

export const getPlayerReputationTag = (stats: PlayerReputationStats): ReputationTag => {
  if (stats.isCrownHolder) return "Crown Holder";
  if ((stats.failedDrops ?? 0) >= 3 && (stats.failedDrops ?? 0) >= (stats.successfulDrops ?? 0)) return "Crash Out";
  if ((stats.reems ?? 0) >= 2) return "Reem Hunter";
  if ((stats.successfulDrops ?? 0) >= 2) return "Drop Demon";
  if ((stats.handsWon ?? 0) >= 4 || (stats.biggestPayoutRtc ?? 0) >= 8000) return "Table Bully";
  if ((stats.handsPlayed ?? 0) >= 10 && (stats.handsWon ?? 0) >= 2) return "Closer";
  if ((stats.handsPlayed ?? 0) >= 6) return "Run Back Ready";
  return "Safe Player";
};

export const tableToCrewCrib = (table: Table, receipts: RoundReceipt[] = []): CrewCrib => {
  const identity = getCribIdentity(table);
  const reemReceipt = receipts.find((receipt) => receipt.reason === "REEM");
  const badDropReceipt = receipts.find((receipt) => receipt.reason === "BAD_DROP");
  const biggestReceipt = [...receipts].sort((a, b) => Math.abs(b.payoutRtc) - Math.abs(a.payoutRtc))[0];

  return {
    id: table._id,
    name: identity.name,
    ownerId: table.createdBy,
    hostId: table.createdBy,
    isPrivate: !!table.isPrivate,
    inviteCode: table.inviteCode,
    inviteSlug: table.inviteSlug,
    members: table.members ?? (table.players ?? []).map((player) => ({ userId: player.userId })),
    crownHolder: table.crownHolder,
    weeklyHandsPlayed: table.weeklyHandsPlayed ?? Math.max(12, receipts.length || table.currentPlayerCount * 9 + table.stake),
    biggestReem: table.biggestReem ?? (reemReceipt ? `${reemReceipt.winnerName} ${formatRoundDeltaAmount(reemReceipt.payoutRtc, "RTC")}` : "Blaze +8K"),
    worstDrop: table.worstDrop ?? (badDropReceipt ? `${badDropReceipt.winnerName} caught a bad drop` : "Drift caught at 27"),
    mostRtcWon: table.mostRtcWon ?? (biggestReceipt ? `${biggestReceipt.winnerName} ${formatRTCCompactAmount(biggestReceipt.payoutRtc)}` : undefined),
    recentReceipts: receipts.slice(0, 8),
  };
};

export const buildCribInviteCopy = (crib: Pick<CrewCrib, "name" | "weeklyHandsPlayed">, eventHands = 12) =>
  `Pull up to ${crib.name} on ReemTeam. ${eventHands} hands. Top stack takes the crown. Seat open now.`;

export const buildReceiptInviteCopy = (receipt: Pick<RoundReceipt, "winnerName" | "cribName" | "reason" | "title">) => {
  if (receipt.reason === "BAD_DROP") {
    return `${receipt.winnerName} caught a bad drop in ${receipt.cribName}. Run it back?`;
  }
  return `${receipt.title} in ${receipt.cribName}. Pull up and run it back?`;
};

export const buildEventInviteCopy = (eventName: string, cribName: string, handLimit: number) =>
  `${eventName} at ${cribName}. ${handLimit} hands. Top stack owns the crib. Crown stays until next week.`;
