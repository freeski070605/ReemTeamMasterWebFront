import { IGameState } from "../types/game";
import { formatRoundDeltaAmount, getRoundNetForPlayer, resolveRoundOutcomeKey } from "./roundResults";

export type EventType = "quick_smoke" | "friday_night_reem" | "crown_room";

export type EventConfig = {
  type: EventType;
  label: string;
  handLimit: number;
  tagline: string;
  startingStackRtc: number;
};

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
  totalScoreAcrossHands?: number;
  finalHandScore?: number;
};

export type RoundReceipt = {
  id: string;
  cribName: string;
  winnerName: string;
  title: string;
  playerNames: string[];
  reason: "REEM" | "DROP_WIN" | "BAD_DROP" | "LOW_SCORE" | "STOCK";
  handType: string;
  timestamp: number;
  score?: number;
  payoutRtc: number;
  receiptText: string;
};

export const EVENT_CONFIGS: Record<EventType, EventConfig> = {
  quick_smoke: {
    type: "quick_smoke",
    label: "Quick Smoke",
    handLimit: 8,
    tagline: "Get in. Run 8. Crown somebody.",
    startingStackRtc: 10000,
  },
  friday_night_reem: {
    type: "friday_night_reem",
    label: "Friday Night Reem",
    handLimit: 12,
    tagline: "12 hands. Top stack owns the crib.",
    startingStackRtc: 10000,
  },
  crown_room: {
    type: "crown_room",
    label: "Crown Room",
    handLimit: 16,
    tagline: "No excuses after 16.",
    startingStackRtc: 50000,
  },
};

const getActorName = (state: Pick<IGameState, "players">, userId?: string | null) =>
  state.players.find((player) => player.userId === userId)?.username ?? "Somebody";

export const getTableHypeMessage = (
  lastAction: IGameState["lastAction"],
  state: Pick<IGameState, "players" | "roundEndedBy" | "caughtDroppingPlayerId">
): string | null => {
  if (!lastAction) return null;
  const actorId = lastAction.payload?.userId ?? lastAction.payload?.playerId ?? lastAction.payload?.winnerId;
  const actorName = getActorName(state, actorId);

  if (state.roundEndedBy === "REEM") return "Final hand energy.";
  if (state.roundEndedBy === "CAUGHT_DROP") return "Bad drop pressure is live.";

  switch (lastAction.type) {
    case "spread":
      return `${actorName} opened the board.`;
    case "hit":
      return `${actorName} is sitting low.`;
    case "drop":
      return lastAction.payload?.caught ? `${actorName} got caught playing dangerous.` : `${actorName} put the table on notice.`;
    case "drawCard":
      return lastAction.payload?.source === "discard" ? `${actorName} might be setting up a Reem.` : null;
    default:
      return null;
  }
};

export const buildRoundReceipt = (
  state: IGameState,
  options: { cribName: string; winnerName?: string | null; payoutRtc?: number | null }
): RoundReceipt | null => {
  const winnerId = state.roundWinnerId ?? state.placements?.find((placement) => placement.rank === 1)?.userId;
  if (!winnerId) return null;

  const winnerName = options.winnerName ?? getActorName(state, winnerId);
  const score = state.handScores?.[winnerId];
  const payoutRtc = options.payoutRtc ?? getRoundNetForPlayer(state, winnerId) ?? 0;
  const outcomeKey = resolveRoundOutcomeKey(state);
  const title =
    outcomeKey === "reem"
      ? `${winnerName.toUpperCase()} GOT REEM`
      : outcomeKey === "drop-win"
        ? `${winnerName.toUpperCase()} CAUGHT THE TABLE`
        : outcomeKey === "drop-caught"
          ? "BAD DROP"
          : `${winnerName.toUpperCase()} TOOK THE HAND`;
  const reason =
    outcomeKey === "reem"
      ? "REEM"
      : outcomeKey === "drop-win"
        ? "DROP_WIN"
        : outcomeKey === "drop-caught"
          ? "BAD_DROP"
          : outcomeKey === "deck-out"
            ? "STOCK"
            : "LOW_SCORE";
  const scoreLine = score === undefined ? null : `Score: ${score}`;
  const payoutLine = formatRoundDeltaAmount(payoutRtc, "RTC");
  const playerNames = state.players.map((player) => player.username);
  const handType =
    reason === "REEM"
      ? "Reem win"
      : reason === "DROP_WIN"
        ? "Drop win"
        : reason === "BAD_DROP"
          ? "Bad drop"
          : reason === "STOCK"
            ? "Stock hand"
            : "Round win";
  const timestamp = state.lastAction?.timestamp ?? Date.now();
  const receiptText = [title, `Won ${payoutLine}`, scoreLine, `Crib: ${options.cribName}`, handType, "Run it back?"]
    .filter(Boolean)
    .join("\n");

  return {
    id: `${state.tableId}-${timestamp}`,
    cribName: options.cribName,
    winnerName,
    title,
    playerNames,
    reason,
    handType,
    timestamp,
    score,
    payoutRtc,
    receiptText,
  };
};

export const getEventWinner = (stats: EventPlayerStats[]): EventPlayerStats | null => {
  if (stats.length === 0) return null;
  return [...stats].sort((a, b) => {
    if (b.netRtc !== a.netRtc) return b.netRtc - a.netRtc;
    if (b.handsWon !== a.handsWon) return b.handsWon - a.handsWon;
    if (b.reems !== a.reems) return b.reems - a.reems;
    return (a.finalHandScore ?? Number.MAX_SAFE_INTEGER) - (b.finalHandScore ?? Number.MAX_SAFE_INTEGER);
  })[0];
};
