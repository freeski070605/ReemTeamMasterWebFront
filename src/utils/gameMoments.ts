import { IGameState } from "../types/game";

export type TableMomentTone = "neutral" | "info" | "action" | "error";

export interface TableMoment {
  eyebrow: string;
  title: string;
  detail?: string;
  tone: TableMomentTone;
}

const findPlayerName = (state: Pick<IGameState, "players">, userId?: string | null) => {
  if (!userId) return "Player";
  return state.players.find((player) => player.userId === userId)?.username ?? "Player";
};

const formatCardLabel = (card?: { rank?: unknown; suit?: unknown } | null) => {
  if (!card?.rank || !card?.suit) {
    return "a card";
  }

  return `${String(card.rank)} of ${String(card.suit)}`;
};

export const buildTableMomentFromLastAction = (
  state: Pick<IGameState, "players" | "lastAction" | "caughtDroppingPlayerId">
): TableMoment | null => {
  if (!state.lastAction) {
    return null;
  }

  const actorId =
    state.lastAction.payload?.userId ??
    state.lastAction.payload?.playerId ??
    state.lastAction.payload?.actingPlayerId ??
    state.lastAction.payload?.currentPlayerId ??
    state.lastAction.payload?.winnerId;
  const actorName = findPlayerName(state, actorId);

  switch (state.lastAction.type) {
    case "drawCard":
      return {
        eyebrow: "Table Pulse",
        title:
          state.lastAction.payload?.source === "discard"
            ? `${actorName} pulled off discard`
            : `${actorName} drew from deck`,
        detail: "The hand is shifting.",
        tone: "info",
      };
    case "discardCard":
      return {
        eyebrow: "Table Pulse",
        title: `${actorName} discarded ${formatCardLabel(state.lastAction.payload?.card)}`,
        detail: "Turn pressure just changed.",
        tone: "neutral",
      };
    case "spread":
      return {
        eyebrow: "Action Landed",
        title: `${actorName} laid a spread`,
        detail: "Board control just got stronger.",
        tone: "action",
      };
    case "hit":
      return {
        eyebrow: "Action Landed",
        title: `${actorName} landed a hit`,
        detail: "Table pressure moved immediately.",
        tone: "action",
      };
    case "drop":
      return {
        eyebrow: "Action Landed",
        title:
          state.lastAction.payload?.caught
            ? `${actorName}'s drop got caught`
            : `${actorName} dropped the hand`,
        detail:
          state.lastAction.payload?.caught
            ? "The table punished the timing."
            : "The round is forcing resolution.",
        tone: state.lastAction.payload?.caught ? "error" : "action",
      };
    case "declare41":
      return {
        eyebrow: "Action Landed",
        title: `${actorName} declared 41`,
        detail: "Triple pressure hit the table.",
        tone: "action",
      };
    case "autoWin": {
      const handValue = state.lastAction.payload?.handValue;
      return {
        eyebrow: "Opening Hand",
        title: handValue === 47 || handValue === 50
          ? `${actorName} auto-won with ${handValue}`
          : `${actorName} won on the deal`,
        detail: handValue === 47 || handValue === 50
          ? "Regular stake payout, no declaration needed."
          : "The round ended immediately.",
        tone: "action",
      };
    }
    case "turnExpiredSkip":
    case "turnExpiredSkipNoDiscard":
      return {
        eyebrow: "Turn Expired",
        title: `${actorName} timed out`,
        detail: "Turn passed automatically.",
        tone: "error",
      };
    case "turnExpiredAutoDiscard":
      return {
        eyebrow: "Turn Expired",
        title: `${actorName} timed out`,
        detail: "A card was auto-discarded to keep the hand moving.",
        tone: "error",
      };
    default:
      return null;
  }
};
