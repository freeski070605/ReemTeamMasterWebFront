import { IGameState, PlacementWinType } from "../types/game";

export type RoundDisplayCurrency = "USD" | "RTC";
export type RoundOutcomeKey =
  | "reem"
  | "tonk"
  | "point-win"
  | "drop-win"
  | "drop-caught"
  | "deck-out"
  | "tie"
  | "round-end";
export type RoundOutcomeTone = "gold" | "emerald" | "sky" | "rose" | "slate";

export interface RoundOutcomePresentation {
  key: RoundOutcomeKey;
  tone: RoundOutcomeTone;
  eyebrow: string;
  headline: string;
  secondary: string;
  explanation: string;
}

const is41Win = (state: Pick<IGameState, "roundEndedBy" | "lastAction">): boolean =>
  state.roundEndedBy === "AUTO_TRIPLE" && state.lastAction?.type === "declare41";

const isSuccessfulDrop = (state: Pick<IGameState, "roundEndedBy" | "lastAction">): boolean =>
  state.roundEndedBy === "REGULAR" && state.lastAction?.type === "drop" && !state.lastAction?.payload?.caught;

const formatStakeAmount = (amount: number, currency: RoundDisplayCurrency): string => {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return `${Math.max(0, Math.trunc(amount)).toLocaleString("en-US")} RTC`;
};

const findPlayerName = (state: Pick<IGameState, "players">, userId?: string): string | null => {
  if (!userId) return null;
  return state.players.find((player) => player.userId === userId)?.username ?? null;
};

const shouldConvertWinnerGrossToNet = (state: Pick<IGameState, "mode">): boolean =>
  !state.mode || state.mode === "FREE_RTC_TABLE" || state.mode === "RTC_TOURNAMENT";

const hasTieWinner = (state: Pick<IGameState, "placements">): boolean =>
  (state.placements ?? []).filter((placement) => placement.rank === 1).length > 1;

export const formatRoundDeltaAmount = (amount: number, currency: RoundDisplayCurrency): string => {
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  const absoluteAmount = Math.abs(amount);

  if (currency === "USD") {
    return `${sign}${new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absoluteAmount)}`;
  }

  return `${sign}${Math.trunc(absoluteAmount).toLocaleString("en-US")} RTC`;
};

export const getRoundReasonLabel = (state: Pick<IGameState, "roundEndedBy" | "lastAction">): string => {
  if (state.roundEndedBy === "REEM") return "Reem";
  if (state.roundEndedBy === "AUTO_TRIPLE") return is41Win(state) ? "41" : "11 and Under";
  if (state.roundEndedBy === "CAUGHT_DROP") return "Caught Dropping";
  if (state.roundEndedBy === "DECK_EMPTY") return "Deck Runs Out";
  if (isSuccessfulDrop(state)) return "Successful Drop";
  if (state.roundEndedBy === "REGULAR") return "Lowest Hand";
  return "Round End";
};

export const getPlacementWinTypeLabel = (
  state: Pick<IGameState, "roundEndedBy" | "lastAction">,
  winType?: PlacementWinType
): string => {
  if (!winType || winType === "LOSS") return "Loss";
  if (winType === "AUTO_TRIPLE") return is41Win(state) ? "41" : "11 and Under";
  if (winType === "CAUGHT_DROP") return "Caught Dropping";
  if (winType === "DECK_EMPTY") return "Deck Runs Out";
  if (winType === "REEM") return "Reem";
  return isSuccessfulDrop(state) ? "Successful Drop" : "Point Win";
};

export const resolveRoundOutcomeKey = (
  state: Pick<IGameState, "placements" | "roundEndedBy" | "lastAction">
): RoundOutcomeKey => {
  if (hasTieWinner(state)) return "tie";
  if (state.roundEndedBy === "REEM") return "reem";
  if (state.roundEndedBy === "AUTO_TRIPLE") return "tonk";
  if (state.roundEndedBy === "CAUGHT_DROP") return "drop-caught";
  if (state.roundEndedBy === "DECK_EMPTY") return "deck-out";
  if (isSuccessfulDrop(state)) return "drop-win";
  if (state.roundEndedBy === "REGULAR") return "point-win";
  return "round-end";
};

export const getRoundOutcomePresentation = (
  state: Pick<IGameState, "placements" | "roundEndedBy" | "lastAction">,
  options: {
    currency: RoundDisplayCurrency;
    winnerName?: string | null;
    winnerAmount?: number | null;
  }
): RoundOutcomePresentation => {
  const winnerName = options.winnerName ?? "Unknown";
  const amountText =
    options.winnerAmount === null || options.winnerAmount === undefined
      ? `${winnerName} takes the hand`
      : `${winnerName} takes ${formatRoundDeltaAmount(options.winnerAmount, options.currency)}`;

  switch (resolveRoundOutcomeKey(state)) {
    case "reem":
      return {
        key: "reem",
        tone: "gold",
        eyebrow: "ROUND OVER",
        headline: "REEEM HIT",
        secondary: amountText,
        explanation: "Second spread completed. Hand cleared instantly.",
      };
    case "tonk":
      return {
        key: "tonk",
        tone: "emerald",
        eyebrow: "ROUND OVER",
        headline: is41Win(state) ? "TONK 41" : "TONK CALLED",
        secondary: amountText,
        explanation: is41Win(state)
          ? "Declared 41 for the triple-stake finish."
          : "11 and under locked the hand at triple stakes.",
      };
    case "drop-caught":
      return {
        key: "drop-caught",
        tone: "rose",
        eyebrow: "ROUND OVER",
        headline: "DROP CAUGHT",
        secondary: amountText,
        explanation: "The fold attempt got punished before it could stand.",
      };
    case "drop-win":
      return {
        key: "drop-win",
        tone: "sky",
        eyebrow: "ROUND OVER",
        headline: "DROP HOLDS",
        secondary: amountText,
        explanation: "The drop stood up and the hand ended on the spot.",
      };
    case "deck-out":
      return {
        key: "deck-out",
        tone: "slate",
        eyebrow: "ROUND OVER",
        headline: "POINT WIN",
        secondary: amountText,
        explanation: "Deck ran dry. Lowest hand on the table took the win.",
      };
    case "point-win":
      return {
        key: "point-win",
        tone: "sky",
        eyebrow: "ROUND OVER",
        headline: "POINT WIN",
        secondary: amountText,
        explanation: "Lowest hand at showdown sealed the round.",
      };
    case "tie":
      return {
        key: "tie",
        tone: "slate",
        eyebrow: "ROUND OVER",
        headline: "HAND TIED",
        secondary: "No payout swing on this finish.",
        explanation: "The table finished level and moves on to the next hand.",
      };
    default:
      return {
        key: "round-end",
        tone: "slate",
        eyebrow: "ROUND OVER",
        headline: "HAND COMPLETE",
        secondary: amountText,
        explanation: "Settlement is wrapping up for the next hand.",
      };
  }
};

export const getRoundNetForPlayer = (
  state: Pick<IGameState, "mode" | "payouts" | "lockedAntes" | "baseStake" | "roundWinnerId">,
  playerId: string
): number | null => {
  const payout = state.payouts?.[playerId];
  if (payout === undefined) return null;

  if (playerId === state.roundWinnerId && shouldConvertWinnerGrossToNet(state)) {
    const ante = state.lockedAntes?.[playerId] ?? state.baseStake;
    return payout - ante;
  }

  return payout;
};

export const buildRoundDeltaMessage = (
  state: Pick<IGameState, "mode" | "players" | "payouts" | "lockedAntes" | "baseStake" | "roundWinnerId">
): string | null => {
  if (!state.payouts) {
    return null;
  }

  const currency: RoundDisplayCurrency = state.mode === "USD_CONTEST" ? "USD" : "RTC";
  const parts = state.players
    .filter((player) => !player.isAI)
    .map((player) => {
      const net = getRoundNetForPlayer(state, player.userId);
      if (net === null) return null;
      return `${player.username} ${formatRoundDeltaAmount(net, currency)}`;
    })
    .filter((entry): entry is string => !!entry);

  if (parts.length === 0) {
    return null;
  }

  return `W/L: ${parts.join(" | ")}`;
};

export const getRoundAnnouncement = (
  state: Pick<
    IGameState,
    "roundEndedBy" | "lastAction" | "players" | "roundWinnerId" | "caughtDroppingPlayerId"
  >
): string | null => {
  const winnerName = findPlayerName(state, state.roundWinnerId) ?? "Unknown";

  if (state.roundEndedBy === "REEM") {
    return `${winnerName} reemed the table.`;
  }

  if (state.roundEndedBy === "AUTO_TRIPLE") {
    return is41Win(state) ? `${winnerName} declared 41.` : `${winnerName} won with 11 and under.`;
  }

  if (state.roundEndedBy === "CAUGHT_DROP") {
    const dropperName = findPlayerName(state, state.caughtDroppingPlayerId);
    return dropperName
      ? `${winnerName} caught ${dropperName} dropping.`
      : `${winnerName} caught the drop.`;
  }

  if (state.roundEndedBy === "DECK_EMPTY") {
    return `Deck ran out. ${winnerName} won on lowest hand.`;
  }

  if (isSuccessfulDrop(state)) {
    return `${winnerName} won on a successful drop.`;
  }

  if (state.roundEndedBy === "REGULAR") {
    return `${winnerName} won the round.`;
  }

  return null;
};

export const getRoundPayoutSummary = (
  state: Pick<
    IGameState,
    "roundEndedBy" | "lastAction" | "baseStake" | "players" | "caughtDroppingPlayerId"
  >,
  currency: RoundDisplayCurrency
): string | null => {
  const singleStake = formatStakeAmount(state.baseStake, currency);
  const doubleStake = formatStakeAmount(state.baseStake * 2, currency);
  const tripleStake = formatStakeAmount(state.baseStake * 3, currency);

  if (state.roundEndedBy === "CAUGHT_DROP") {
    const dropperName = findPlayerName(state, state.caughtDroppingPlayerId);
    if (dropperName) {
      return `${dropperName} paid ${doubleStake}; all other opponents paid ${singleStake}.`;
    }
    return `The dropper paid ${doubleStake}; all other opponents paid ${singleStake}.`;
  }

  if (state.roundEndedBy === "AUTO_TRIPLE") {
    return `Each opponent paid ${tripleStake}.`;
  }

  if (state.roundEndedBy === "REEM") {
    return `Each opponent paid ${doubleStake}.`;
  }

  if (state.roundEndedBy === "DECK_EMPTY") {
    return `Each opponent paid ${singleStake}.`;
  }

  if (isSuccessfulDrop(state)) {
    return `Each opponent paid ${singleStake}.`;
  }

  if (state.roundEndedBy === "REGULAR") {
    return `Each opponent paid ${singleStake}.`;
  }

  return null;
};
