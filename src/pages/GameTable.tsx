import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { Loader } from "../components/ui/Loader";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { Card as CardType } from "../types/game";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { toast } from "react-toastify";
import { trackEvent } from "../api/analytics";

import { PlayingCard as CardComponent } from "../components/ui/Card";
import PlayerAvatar from "../components/game/PlayerAvatar";
import TurnTimer from "../components/game/TurnTimer";
import GameActions from "../components/game/GameActions";
import { Button } from "../components/ui/Button";
import {
  formatRoundDeltaAmount,
  getPlacementWinTypeLabel,
  getRoundNetForPlayer,
  getRoundOutcomePresentation,
} from "../utils/roundResults";
import bgImage from '../assets/bg.png';
import backCardImage from "../assets/cards/back.png";

type TurnStatusBadge = "DRAWING" | "MUST DISCARD" | "HIT MODE" | "WAITING";

const CARD_RANK_ORDER: Array<CardType["rank"]> = [
  "Ace",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "Jack",
  "Queen",
  "King",
];
const CARD_SUIT_ORDER: Array<CardType["suit"]> = ["Hearts", "Diamonds", "Clubs", "Spades"];

const getCardRankOrder = (rank: CardType["rank"]) => CARD_RANK_ORDER.indexOf(rank);
const getCardSuitOrder = (suit: CardType["suit"]) => CARD_SUIT_ORDER.indexOf(suit);

const sortHandCards = (cards: CardType[]): CardType[] =>
  [...cards].sort((a, b) => {
    const suitDiff = getCardSuitOrder(a.suit) - getCardSuitOrder(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return getCardRankOrder(a.rank) - getCardRankOrder(b.rank);
  });

const sortSpreadCards = (cards: CardType[]): CardType[] => {
  if (cards.length <= 1) return [...cards];

  const allSameRank = cards.every((card) => card.rank === cards[0].rank);
  if (allSameRank) {
    return [...cards].sort((a, b) => getCardSuitOrder(a.suit) - getCardSuitOrder(b.suit));
  }

  const allSameSuit = cards.every((card) => card.suit === cards[0].suit);
  if (allSameSuit) {
    return [...cards].sort((a, b) => getCardRankOrder(a.rank) - getCardRankOrder(b.rank));
  }

  return sortHandCards(cards);
};

const getViewportSize = () => ({
  width: window.visualViewport?.width ?? window.innerWidth,
  height: window.visualViewport?.height ?? window.innerHeight,
});

const readSafeAreaInset = (token: "--safe-area-top" | "--safe-area-right" | "--safe-area-bottom" | "--safe-area-left") => {
  const rawValue = getComputedStyle(document.documentElement).getPropertyValue(token);
  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : 0;
};

const syncAppHeight = () => {
  const viewport = getViewportSize();
  document.documentElement.style.setProperty("--app-height", `${Math.round(viewport.height)}px`);
};

const GameTable: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const logoSrc = "/assets/logo.png";
  const displayFont = '"Oswald", "Gabarito", sans-serif';
  const {
    socket,
    connect,
    disconnect,
    gameState,
    isConnected,
    leaveTable,
    drawCard,
    discardCard,
    spread,
    hit,
    drop,
    requestLeaveTable,
    putIn,
  } = useGameStore();

  const [selectedCards, setSelectedCards] = useState<CardType[]>([]);
  const [isHitMode, setIsHitMode] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [showDealAnimation, setShowDealAnimation] = useState(false);
  const [shufflePhase, setShufflePhase] = useState(false);
  const [placeDeckPhase, setPlaceDeckPhase] = useState(false);
  const [dealingCardIndex, setDealingCardIndex] = useState(0);
  const [roundCountdownSeconds, setRoundCountdownSeconds] = useState<number | null>(null);
  const [playerBalances, setPlayerBalances] = useState<Record<string, number>>({});
  const [tableMaxWidthPx, setTableMaxWidthPx] = useState(860);
  const [isCompactLandscape, setIsCompactLandscape] = useState(false);
  const [isUltraShortLandscape, setIsUltraShortLandscape] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showGuidanceBanner, setShowGuidanceBanner] = useState(false);
  const [showGuidanceHelper, setShowGuidanceHelper] = useState(false);
  const [guidanceOverrideText, setGuidanceOverrideText] = useState<string | null>(null);
  const [guidanceOverrideHelper, setGuidanceOverrideHelper] = useState<string | null>(null);
  const [activityTick, setActivityTick] = useState(0);
  const lastAnimatedRoundKeyRef = useRef<string | null>(null);
  const hasInitializedLastActionRef = useRef(false);
  const lastObservedActionTimestampRef = useRef<number | null>(null);
  const guidanceBannerTimeoutRef = useRef<number | null>(null);
  const guidanceHelperTimeoutRef = useRef<number | null>(null);
  const idleGuidanceTimeoutRef = useRef<number | null>(null);
  const myTurnStartCountRef = useRef(0);
  const wasMyTurnRef = useRef(false);
  const previousTurnStepRef = useRef<"waiting" | "draw" | "discard">("waiting");
  const maxPlayers = 4;
  const walletCurrency = gameState?.mode === "USD_CONTEST" ? "usd" : "rtc";
  const {
    balance,
    loading: balanceLoading,
    refresh: refreshBalance,
  } = useWalletBalance({ refreshIntervalMs: 15000, currency: walletCurrency });
  const contestId = searchParams.get("contestId") ?? undefined;
  const inviteCode = searchParams.get("inviteCode") ?? undefined;
  const spectatorModeRequested = searchParams.get("spectator") === "1";
  const promoModeRequested = searchParams.get("promo") === "1";
  const previousStatusRef = useRef<string | null>(null);

  const clearGuidanceTimers = useCallback(() => {
    if (guidanceBannerTimeoutRef.current !== null) {
      window.clearTimeout(guidanceBannerTimeoutRef.current);
      guidanceBannerTimeoutRef.current = null;
    }
    if (guidanceHelperTimeoutRef.current !== null) {
      window.clearTimeout(guidanceHelperTimeoutRef.current);
      guidanceHelperTimeoutRef.current = null;
    }
  }, []);

  const triggerGuidance = useCallback(
    (options?: {
      bannerText?: string | null;
      helperText?: string | null;
      bannerDurationMs?: number;
      helperDurationMs?: number;
    }) => {
      const bannerDurationMs = options?.bannerDurationMs ?? (isTouchDevice ? 2600 : 3600);
      const helperDurationMs =
        options?.helperDurationMs ?? (isTouchDevice ? 1400 : bannerDurationMs);

      setGuidanceOverrideText(options?.bannerText ?? null);
      setGuidanceOverrideHelper(options?.helperText ?? null);
      setShowGuidanceBanner(true);
      setShowGuidanceHelper(true);

      clearGuidanceTimers();

      guidanceBannerTimeoutRef.current = window.setTimeout(() => {
        setShowGuidanceBanner(false);
        setGuidanceOverrideText(null);
      }, bannerDurationMs);

      guidanceHelperTimeoutRef.current = window.setTimeout(() => {
        setShowGuidanceHelper(false);
        setGuidanceOverrideHelper(null);
      }, helperDurationMs);
    },
    [clearGuidanceTimers, isTouchDevice]
  );

  const markActionActivity = useCallback(() => {
    setActivityTick((tick) => tick + 1);
  }, []);

  const showActionToast = useCallback(
    (message: string, tone: "error" | "info" = "info") => {
      const options = { position: "top-center" as const, autoClose: 2000, hideProgressBar: true };
      if (tone === "error") {
        toast.error(message, options);
        return;
      }
      toast.info(message, options);
    },
    []
  );

  useEffect(() => {
    if (tableId && user) {
      connect(tableId, user._id, user.username, user.avatarUrl, contestId, inviteCode, spectatorModeRequested);
      trackEvent('table_joined', { tableId, contestId, inviteCode });
    }

    const handlePlayerLeft = ({ userId: leftPlayerId }: { userId: string }) => {
      if (!spectatorModeRequested && leftPlayerId === user?._id) {
        toast.info("You have left the table.");
        navigate("/tables");
      }
    };

    useGameStore.getState().socket?.on('playerLeft', handlePlayerLeft);

    return () => {
      useGameStore.getState().socket?.off('playerLeft', handlePlayerLeft);
      disconnect();
      if (tableId) {
        trackEvent('table_left', { tableId });
      }
    };
  }, [tableId, user, connect, disconnect, navigate, contestId, inviteCode, spectatorModeRequested]);

  useEffect(() => {
    if (!tableId || spectatorModeRequested) return;
    localStorage.setItem('last_table_id', tableId);
    if (inviteCode) {
      localStorage.setItem('last_table_invite_code', inviteCode);
    }
  }, [tableId, inviteCode, spectatorModeRequested]);

  useEffect(() => {
    if (!gameState) return;
    const currentStatus = gameState.status;
    const previousStatus = previousStatusRef.current;

    if (previousStatus !== currentStatus && currentStatus === "in-progress") {
      trackEvent('game_start', { tableId, mode: gameState.mode ?? 'FREE_RTC_TABLE' });
    }

    if (previousStatus !== currentStatus && currentStatus === "round-end") {
      trackEvent('round_end', { tableId, mode: gameState.mode ?? 'FREE_RTC_TABLE', endedBy: gameState.roundEndedBy });
    }

    previousStatusRef.current = currentStatus;
  }, [gameState, tableId]);

  useEffect(() => {
    if (gameState?.status === "round-end") {
      refreshBalance();
    }
  }, [gameState?.status, refreshBalance]);

  useEffect(() => {
    if (!socket || !user?._id) return;

    const handleWalletBalanceUpdate = (payload: { userId: string; balance: number }) => {
      setPlayerBalances((prev) => ({ ...prev, [payload.userId]: payload.balance }));
      if (payload.userId === user._id) {
        window.dispatchEvent(new Event("wallet-balance-refresh"));
      }
    };

    socket.on("walletBalanceUpdate", handleWalletBalanceUpdate);
    return () => {
      socket.off("walletBalanceUpdate", handleWalletBalanceUpdate);
    };
  }, [socket, user?._id]);

  useEffect(() => {
    if (!user?._id || balance === null) return;
    setPlayerBalances((prev) => ({ ...prev, [user._id]: balance }));
  }, [user?._id, balance]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1024px) and (orientation: portrait)");
    const applyOrientationState = () => {
      setIsMobilePortrait(mediaQuery.matches);
    };
    applyOrientationState();
    mediaQuery.addEventListener("change", applyOrientationState);
    window.addEventListener("resize", applyOrientationState);

    return () => {
      mediaQuery.removeEventListener("change", applyOrientationState);
      window.removeEventListener("resize", applyOrientationState);
    };
  }, []);

  useEffect(() => {
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const updateTouchState = () => {
      setIsTouchDevice(coarsePointerQuery.matches || navigator.maxTouchPoints > 0);
    };

    updateTouchState();
    coarsePointerQuery.addEventListener("change", updateTouchState);
    return () => {
      coarsePointerQuery.removeEventListener("change", updateTouchState);
    };
  }, []);

  useEffect(() => {
    syncAppHeight();
    window.addEventListener("resize", syncAppHeight, { passive: true });
    window.addEventListener("orientationchange", syncAppHeight, { passive: true });
    window.visualViewport?.addEventListener("resize", syncAppHeight);

    return () => {
      window.removeEventListener("resize", syncAppHeight);
      window.removeEventListener("orientationchange", syncAppHeight);
      window.visualViewport?.removeEventListener("resize", syncAppHeight);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearGuidanceTimers();
      if (idleGuidanceTimeoutRef.current !== null) {
        window.clearTimeout(idleGuidanceTimeoutRef.current);
        idleGuidanceTimeoutRef.current = null;
      }
    };
  }, [clearGuidanceTimers]);

  useEffect(() => {
    const updateTableMaxWidth = () => {
      const viewport = getViewportSize();
      const safeAreaTop = readSafeAreaInset("--safe-area-top");
      const safeAreaRight = readSafeAreaInset("--safe-area-right");
      const safeAreaBottom = readSafeAreaInset("--safe-area-bottom");
      const safeAreaLeft = readSafeAreaInset("--safe-area-left");
      const usableWidth = Math.max(0, viewport.width - safeAreaLeft - safeAreaRight);
      const usableHeight = Math.max(0, viewport.height - safeAreaTop - safeAreaBottom);
      const isLandscape = usableWidth > usableHeight;
      const compactLandscape = isLandscape && usableHeight <= 520;
      const veryShortLandscape = isLandscape && usableHeight <= 430;
      const tableHeightRatio = veryShortLandscape ? 0.9 : compactLandscape ? 0.94 : isLandscape ? 0.96 : 0.92;
      const maxByViewport = usableWidth * 0.96;
      const maxByHeight = usableHeight * tableHeightRatio * (16 / 9);
      const maxByTV = 1800;
      setTableMaxWidthPx(Math.floor(Math.min(maxByViewport, maxByHeight, maxByTV)));
      setIsCompactLandscape(compactLandscape);
      setIsUltraShortLandscape(veryShortLandscape);
    };

    updateTableMaxWidth();
    window.addEventListener("resize", updateTableMaxWidth);
    window.addEventListener("orientationchange", updateTableMaxWidth, { passive: true });
    window.visualViewport?.addEventListener("resize", updateTableMaxWidth);
    return () => {
      window.removeEventListener("resize", updateTableMaxWidth);
      window.removeEventListener("orientationchange", updateTableMaxWidth);
      window.visualViewport?.removeEventListener("resize", updateTableMaxWidth);
    };
  }, []);

  useEffect(() => {
    if (gameState?.status !== "round-end") {
      setRoundCountdownSeconds(null);
      return;
    }

    const roundRestartAt = gameState.roundReadyDeadline ?? ((gameState.lastAction?.timestamp ?? Date.now()) + 30000);

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((roundRestartAt - Date.now()) / 1000));
      setRoundCountdownSeconds(remaining);
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => {
      window.clearInterval(interval);
    };
  }, [gameState?.status, gameState?.lastAction?.timestamp, gameState?.roundReadyDeadline]);

  const roundAnimationPlan = (() => {
    if (!gameState) return null;
    const status = gameState.status;
    const isRoundStartState =
      (status === "starting" || status === "in-progress") &&
      gameState.turn === 1 &&
      gameState.discardPile.length === 0 &&
      gameState.players.length > 0 &&
      gameState.players.every((p) => p.hand.length === 5);

    if (!isRoundStartState) return null;

    const playersInRound = Math.max(1, gameState.players.length);
    const cardsPerPlayer = Math.max(0, ...gameState.players.map((player) => player.hand.length));
    const cardsToDeal = playersInRound * cardsPerPlayer;

    const stableHandSignature = [...gameState.players]
      .map((player) => ({
        userId: player.userId,
        handSignature: player.hand
          .map((card) => `${card.rank}-${card.suit}`)
          .sort()
          .join("."),
      }))
      .sort((a, b) => a.userId.localeCompare(b.userId))
      .map((entry) => `${entry.userId}:${entry.handSignature}`)
      .join("|");

    const key = [
      `table:${gameState.tableId}`,
      `dealer:${gameState.currentDealerIndex}`,
      `players:${gameState.players.map((p) => p.userId).sort().join(",")}`,
      `hands:${stableHandSignature}`,
    ].join(";");

    return {
      key,
      playersInRound,
      cardsPerPlayer,
      cardsToDeal,
    };
  })();
  const roundAnimationKey = roundAnimationPlan?.key ?? null;
  const roundAnimationCardsToDeal = roundAnimationPlan?.cardsToDeal ?? 0;

  useEffect(() => {
    if (!roundAnimationKey) return;

    const playDealAnimation = () => {
      const cardsToDeal = roundAnimationCardsToDeal;
      const dealDurationMs = Math.max(2200, cardsToDeal * 130 + 450);
      let startedDeckPlacement = false;

      const startDeckPlacement = () => {
        if (startedDeckPlacement) return;
        startedDeckPlacement = true;
        if (interval !== null) {
          window.clearInterval(interval);
          interval = null;
        }
        if (dealTimeout !== null) {
          window.clearTimeout(dealTimeout);
          dealTimeout = null;
        }
        setPlaceDeckPhase(true);
        placeDeckTimeout = window.setTimeout(() => {
          setPlaceDeckPhase(false);
          setShowDealAnimation(false);
        }, 450);
      };

      setShufflePhase(true);
      setPlaceDeckPhase(false);
      setShowDealAnimation(true);
      setDealingCardIndex(0);
      let interval: number | null = null;
      let dealTimeout: number | null = null;
      let placeDeckTimeout: number | null = null;

      const shuffleTimeout = window.setTimeout(() => {
        setShufflePhase(false);
        if (cardsToDeal === 0) {
          startDeckPlacement();
          return;
        }
        interval = window.setInterval(() => {
          setDealingCardIndex((idx) => {
            const nextIdx = Math.min(idx + 1, cardsToDeal);
            if (nextIdx >= cardsToDeal) {
              startDeckPlacement();
            }
            return nextIdx;
          });
        }, 130);
        dealTimeout = window.setTimeout(() => {
          startDeckPlacement();
        }, dealDurationMs);
      }, 750);

      const failsafeTimeout = window.setTimeout(() => {
        setShufflePhase(false);
        setPlaceDeckPhase(false);
        setShowDealAnimation(false);
      }, 9000);

      return () => {
        window.clearTimeout(shuffleTimeout);
        window.clearTimeout(failsafeTimeout);
        if (interval !== null) window.clearInterval(interval);
        if (dealTimeout !== null) window.clearTimeout(dealTimeout);
        if (placeDeckTimeout !== null) window.clearTimeout(placeDeckTimeout);
        setShufflePhase(false);
        setPlaceDeckPhase(false);
        setShowDealAnimation(false);
      };
    };

    if (lastAnimatedRoundKeyRef.current === roundAnimationKey) {
      return undefined;
    }

    lastAnimatedRoundKeyRef.current = roundAnimationKey;
    return playDealAnimation();
  }, [roundAnimationCardsToDeal, roundAnimationKey]);

  useEffect(() => {
    if (showDealAnimation) {
      setSelectedCards([]);
      setIsHitMode(false);
    }
  }, [showDealAnimation]);

  const currentPlayer = gameState?.players.find((p) => p.userId === user?._id);
  const isSpectator = spectatorModeRequested && !currentPlayer;
  const isMyTurn = !!(
    gameState &&
    user &&
    !isSpectator &&
    gameState.players[gameState.currentPlayerIndex]?.userId === user._id
  );
  const turnDurationMs = gameState?.turnDurationMs ?? 20_000;
  const turnTimeRemainingMs = Math.max(0, (gameState?.turnExpiresAt ?? Date.now()) - Date.now());
  const hasCurrentPlayer = !!currentPlayer;
  const hasDrawnThisTurn = !!(currentPlayer?.hasDrawnThisTurn ?? currentPlayer?.hasTakenActionThisTurn);
  const hasDiscardedThisTurn = !!currentPlayer?.hasDiscardedThisTurn;

  useEffect(() => {
    if (!gameState || hasInitializedLastActionRef.current) return;
    hasInitializedLastActionRef.current = true;
    lastObservedActionTimestampRef.current = gameState.lastAction?.timestamp ?? null;
  }, [gameState]);

  useEffect(() => {
    if (!hasInitializedLastActionRef.current) return;
    const actionTimestamp = gameState?.lastAction?.timestamp ?? null;

    if (actionTimestamp === null || actionTimestamp === lastObservedActionTimestampRef.current) {
      return;
    }

    lastObservedActionTimestampRef.current = actionTimestamp;
  }, [gameState?.lastAction?.timestamp]);

  useEffect(() => {
    if (!isMyTurn || !hasCurrentPlayer) {
      setSelectedCards([]);
      setIsHitMode(false);
      return;
    }

    if (!hasDrawnThisTurn || hasDiscardedThisTurn) {
      setSelectedCards([]);
      setIsHitMode(false);
    }
  }, [isMyTurn, hasCurrentPlayer, hasDrawnThisTurn, hasDiscardedThisTurn, gameState?.turn]);

  const currentTurnStep: "waiting" | "draw" | "discard" = !isMyTurn
    ? "waiting"
    : hasDrawnThisTurn
      ? "discard"
      : "draw";

  useEffect(() => {
    if (!gameState || gameState.status !== "in-progress") {
      wasMyTurnRef.current = false;
      previousTurnStepRef.current = "waiting";
      return;
    }

    if (isMyTurn && !wasMyTurnRef.current) {
      myTurnStartCountRef.current += 1;
      if (myTurnStartCountRef.current <= 2) {
        triggerGuidance();
      }
    }

    if (
      isMyTurn &&
      wasMyTurnRef.current &&
      previousTurnStepRef.current !== currentTurnStep
    ) {
      triggerGuidance();
    }

    if (!isMyTurn && wasMyTurnRef.current) {
      clearGuidanceTimers();
      setShowGuidanceBanner(false);
      setShowGuidanceHelper(false);
      setGuidanceOverrideText(null);
      setGuidanceOverrideHelper(null);
    }

    wasMyTurnRef.current = isMyTurn;
    previousTurnStepRef.current = currentTurnStep;
  }, [clearGuidanceTimers, currentTurnStep, gameState, isMyTurn, triggerGuidance]);

  useEffect(() => {
    if (idleGuidanceTimeoutRef.current !== null) {
      window.clearTimeout(idleGuidanceTimeoutRef.current);
      idleGuidanceTimeoutRef.current = null;
    }

    if (!isMyTurn || gameState?.status !== "in-progress" || showDealAnimation) {
      return;
    }

    idleGuidanceTimeoutRef.current = window.setTimeout(() => {
      triggerGuidance({
        bannerDurationMs: isTouchDevice ? 2200 : 3000,
        helperDurationMs: isTouchDevice ? 1200 : 2600,
      });
    }, 4500);

    return () => {
      if (idleGuidanceTimeoutRef.current !== null) {
        window.clearTimeout(idleGuidanceTimeoutRef.current);
        idleGuidanceTimeoutRef.current = null;
      }
    };
  }, [activityTick, gameState?.status, isMyTurn, isTouchDevice, showDealAnimation, triggerGuidance]);

  if (!isConnected || !gameState || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
        <Loader />
        <p className="mt-4 text-gray-400">Connecting to table...</p>
      </div>
    );
  }

  const getCardId = (card: CardType) => `${card.rank}-${card.suit}`;
  const restrictedDiscardCardId = currentPlayer?.restrictedDiscardCard ?? null;
  const isRestrictedDiscardCard = (card: CardType) =>
    restrictedDiscardCardId !== null && getCardId(card) === restrictedDiscardCardId;

  const toggleCardSelection = (card: CardType) => {
    markActionActivity();
    if (selectedCards.some((c) => c.rank === card.rank && c.suit === card.suit)) {
      setSelectedCards(
        selectedCards.filter((c) => c.rank !== card.rank || c.suit !== card.suit)
      );
    } else {
      if (isHitMode) {
        setSelectedCards([card]);
      } else {
        setSelectedCards([...selectedCards, card]);
      }
    }
  };

  const discardSelectedCard = (): boolean => {
    markActionActivity();

    if (selectedCards.length !== 1) {
      showActionToast("Select exactly one card to discard.", "error");
      triggerGuidance({
        bannerText: "Select exactly 1 card to discard",
        helperText: "Then tap Discard.",
      });
      return false;
    }

    if (isRestrictedDiscardCard(selectedCards[0])) {
      showActionToast("Cannot discard this card this turn.", "error");
      triggerGuidance({
        bannerText: "Cannot discard this card this turn.",
        helperText: "Select another card, then tap Discard.",
      });
      return false;
    }

    if (tableId && user) {
      discardCard(tableId, user._id, selectedCards[0]);
      setSelectedCards([]);
      setIsHitMode(false);
      return true;
    }

    return false;
  };

  const handleDeckClick = () => {
    markActionActivity();

    if (!isMyTurn) {
      triggerGuidance({ bannerText: "Wait for your turn." });
      return;
    }

    if (hasDrawnThisTurn) {
      triggerGuidance({
        bannerText: "Discard to finish your turn.",
        helperText: "Select 1 card, then tap Discard.",
      });
      return;
    }

    if (tableId && user) {
      drawCard(tableId, user._id, "deck");
    }
  };

  const handleDiscardPileClick = () => {
    markActionActivity();

    if (!isMyTurn) {
      triggerGuidance({ bannerText: "Wait for your turn." });
      return;
    }

    if (!hasDrawnThisTurn) {
      if (gameState.discardPile.length === 0) {
        showActionToast("Discard pile is empty.", "error");
        triggerGuidance({
          bannerText: "Discard pile is empty.",
          helperText: "Draw from deck instead.",
        });
        return;
      }
      if (tableId && user) {
        drawCard(tableId, user._id, "discard");
      }
    } else {
      discardSelectedCard();
    }
  };

  const handleFlickDiscard = (card: CardType, info: PanInfo) => {
    markActionActivity();
    const isDiscardStep = isMyTurn && hasDrawnThisTurn;
    if (!isTouchDevice || !isDiscardStep || selectedCards.length !== 1) return;
    if (selectedCards[0].rank !== card.rank || selectedCards[0].suit !== card.suit) return;

    const movedTowardDiscard = info.offset.y < -85 && Math.abs(info.offset.x) < 170;
    const quickFlickTowardDiscard = info.velocity.y < -700 && Math.abs(info.velocity.x) < 900;

    if (!movedTowardDiscard && !quickFlickTowardDiscard) return;
    discardSelectedCard();
  };

  const handleSpread = () => {
    markActionActivity();

    if (selectedCards.length < 3) {
      showActionToast("Select at least 3 cards for a spread.", "error");
      triggerGuidance({
        bannerText: "Select at least 3 cards.",
      });
      return;
    }
    if (tableId && user) {
      spread(tableId, user._id, selectedCards);
      setSelectedCards([]);
    }
  };

  const handleHitClick = () => {
    markActionActivity();

    if (selectedCards.length !== 1) {
      showActionToast("Select one card to hit with.", "error");
      triggerGuidance({
        bannerText: "Select exactly 1 card for Hit",
      });
      return;
    }
    setIsHitMode(true);
    showActionToast("Select a spread to hit.");
  };

  const executeHit = (targetPlayerId: string, targetSpreadIndex: number) => {
    markActionActivity();

    if (selectedCards.length !== 1) return;
    if (tableId && user) {
      hit(tableId, user._id, selectedCards[0], targetPlayerId, targetSpreadIndex);
      setIsHitMode(false);
      setSelectedCards([]);
    }
  };

  const handleDrop = () => {
    markActionActivity();

    if (tableId && user) {
      drop(tableId, user._id);
    }
  };

  const handleOpenHowToPlay = () => {
    window.open("/how-to-play", "_blank", "noopener,noreferrer");
  };

  const handleLeaveTable = () => {
    if (isSpectator) {
      navigate("/tables");
      return;
    }
    if (tableId && user) {
      if (
        window.confirm(
          "Are you sure you want to leave the table? You will be removed from the game."
        )
      ) {
        leaveTable(tableId, user._id, user.username);
        navigate("/tables");
      }
    }
  };

  const handleRequestLeaveTable = () => {
    if (isSpectator) {
      navigate("/tables");
      return;
    }
    if (tableId && user) {
      if (gameState.status === "round-end") {
        leaveTable(tableId, user._id, user.username);
        navigate("/tables");
        return;
      }
      requestLeaveTable(tableId, user._id);
    }
  };

  const handlePutIn = () => {
    if (
      tableId &&
      user &&
      gameState.status === "round-end" &&
      (!gameState.mode || gameState.mode === "FREE_RTC_TABLE")
    ) {
      putIn(tableId, user._id);
    }
  };

  const localIndex = isSpectator
    ? 0
    : Math.max(0, gameState.players.findIndex((p) => p.userId === user._id));
  const totalPlayers = gameState.players.length;
  const seatAt = (offset: number) => {
    if (offset >= totalPlayers) return null;
    const idx = (localIndex + offset) % totalPlayers;
    return gameState.players[idx] ?? null;
  };

  const topPlayer = seatAt(1);
  const rightPlayer = seatAt(2);
  const leftPlayer = seatAt(3);
  const viewerSeatPlayer = seatAt(0);
  const totalPlayersInRound = Math.max(1, gameState.players.length);
  const cardsPerPlayerAtDeal = Math.max(
    0,
    ...gameState.players.map((player) => player.hand.length)
  );
  const totalCardsToDeal = totalPlayersInRound * cardsPerPlayerAtDeal;
  const isRoundPresentationPending =
    !!roundAnimationKey && lastAnimatedRoundKeyRef.current !== roundAnimationKey;
  const hideCardsForPresentation = showDealAnimation || isRoundPresentationPending;

  const getVisibleCardCount = (playerUserId: string, actualCount: number) => {
    if (!hideCardsForPresentation) return actualCount;
    if (shufflePhase || placeDeckPhase || isRoundPresentationPending) return 0;

    const playerIndex = gameState.players.findIndex((player) => player.userId === playerUserId);
    if (playerIndex < 0) return actualCount;
    if (dealingCardIndex <= playerIndex) return 0;

    const dealtToPlayer =
      Math.floor((dealingCardIndex - 1 - playerIndex) / totalPlayersInRound) + 1;

    return Math.max(0, Math.min(actualCount, dealtToPlayer));
  };

  const getDealTargetOffset = (dealIndex: number) => {
    const recipientPlayerIndex = dealIndex % totalPlayersInRound;
    const seatOffset =
      ((recipientPlayerIndex - localIndex) % totalPlayersInRound + totalPlayersInRound) %
      totalPlayersInRound;

    if (seatOffset === 1) return { x: 0, y: -150 };
    if (seatOffset === 2) return { x: 230, y: 20 };
    if (seatOffset === 3) return { x: -230, y: 20 };
    return { x: 0, y: 145 };
  };

  const isReem = gameState.status === 'round-end' && gameState.roundEndedBy === 'REEM';
  const readyPlayerIds = new Set(gameState.roundReadyPlayerIds ?? []);
  const isReadyForNextRound = !!user && readyPlayerIds.has(user._id);
  const readyCount = readyPlayerIds.size;
  const totalRoundPlayers = gameState.players.length;
  const formatSeatBalance = (amount: number | null | undefined) => {
    if (walletCurrency === "usd") {
      if (amount === null || amount === undefined) return "$0.00";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(amount);
    }

    if (amount === null || amount === undefined) return "-- RTC";
    return `${Math.max(0, Math.floor(amount)).toLocaleString("en-US")} RTC`;
  };
  const placementByUserId = new Map((gameState.placements ?? []).map((placement) => [placement.userId, placement]));
  const isContinuousMode = !gameState.mode || gameState.mode === "FREE_RTC_TABLE";
  const rankedRoundPlayers = [...gameState.players].sort((a, b) => {
    const aRank = placementByUserId.get(a.userId)?.rank ?? Number.MAX_SAFE_INTEGER;
    const bRank = placementByUserId.get(b.userId)?.rank ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
  const winnerPlacement = (gameState.placements ?? []).find((placement) => placement.rank === 1);
  const winnerPlayer = winnerPlacement
    ? gameState.players.find((player) => player.userId === winnerPlacement.userId)
    : gameState.players.find((player) => player.userId === gameState.roundWinnerId);
  const displayCurrency = walletCurrency === "usd" ? "USD" : "RTC";
  const winnerRoundNet = winnerPlayer ? getRoundNetForPlayer(gameState, winnerPlayer.userId) : null;
  const roundOutcome = getRoundOutcomePresentation(gameState, {
    currency: displayCurrency,
    winnerName: winnerPlayer?.username,
    winnerAmount: winnerRoundNet,
  });
  const roundResultRows = rankedRoundPlayers.map((player) => {
    const placement = placementByUserId.get(player.userId);
    const isWinner = placement?.rank === 1 || player.userId === gameState.roundWinnerId;
    const roundNet = getRoundNetForPlayer(gameState, player.userId);
    const handScore = gameState.handScores?.[player.userId];
    const resultLabel = isWinner ? getPlacementWinTypeLabel(gameState, placement?.winType) : "LOSS";

    return {
      userId: player.userId,
      username: player.username,
      rank: placement?.rank ?? null,
      resultLabel,
      scoreLabel: isWinner
        ? `Score ${handScore ?? 0}`
        : handScore !== undefined
          ? `${handScore} in hand`
          : "Score unavailable",
      seatLabel: isWinner
        ? roundOutcome.headline
        : handScore !== undefined
          ? `${handScore} in hand`
          : resultLabel,
      deltaLabel: roundNet === null ? "--" : formatRoundDeltaAmount(roundNet, displayCurrency),
      deltaValue: roundNet,
      isWinner,
    };
  });
  const roundResultByUserId = new Map(roundResultRows.map((row) => [row.userId, row]));
  const waitingPlayerCount = Math.max(0, totalRoundPlayers - readyCount);
  const roundRailStatusLabel = isContinuousMode
    ? waitingPlayerCount === 0
      ? "All players ready"
      : `Waiting on ${waitingPlayerCount} player${waitingPlayerCount === 1 ? "" : "s"}`
    : "Match complete";
  const roundStatusDetail =
    isContinuousMode && isReadyForNextRound ? "Your seat is locked for the next hand." : null;
  const countdownLabel = isContinuousMode ? `Next hand in ${roundCountdownSeconds ?? 30}s` : null;
  const winnerLine = winnerPlayer
    ? `${winnerPlayer.username}${winnerRoundNet !== null ? ` ${formatRoundDeltaAmount(winnerRoundNet, displayCurrency)}` : ""}`
    : roundOutcome.secondary;
  const isRoundEnd = gameState.status === "round-end";

  const activeTurnPlayer = gameState.players[gameState.currentPlayerIndex] ?? null;
  const activeTurnPlayerName = activeTurnPlayer?.username ?? "Player";
  const activeTurnHasDrawn = !!(
    activeTurnPlayer?.hasDrawnThisTurn ?? activeTurnPlayer?.hasTakenActionThisTurn
  );
  const isDrawStep = isMyTurn && !hasDrawnThisTurn;
  const isDiscardStep =
    isMyTurn && hasDrawnThisTurn && !hasDiscardedThisTurn;
  const selectedIllegalDiscardCard =
    isDiscardStep &&
    selectedCards.length === 1 &&
    isRestrictedDiscardCard(selectedCards[0]);
  const canDrawFromDeck =
    isDrawStep && gameState.deck.length > 0 && !hideCardsForPresentation;
  const canDrawFromDiscard =
    isDrawStep && gameState.discardPile.length > 0 && !hideCardsForPresentation;
  const canTapDiscardPileToFinishTurn = isDiscardStep && !hideCardsForPresentation;
  const deckPrimaryHighlightClass = canDrawFromDeck
    ? "cursor-pointer hover:scale-105 ring-2 ring-cyan-300/90 shadow-[0_0_22px_rgba(56,189,248,0.45)] animate-pulse"
    : "cursor-not-allowed opacity-90";
  const discardPrimaryHighlightClass = canTapDiscardPileToFinishTurn
    ? "cursor-pointer hover:scale-105 ring-2 ring-emerald-300/90 shadow-[0_0_22px_rgba(52,211,153,0.46)] animate-pulse"
    : canDrawFromDiscard
      ? "cursor-pointer hover:scale-105 ring-2 ring-cyan-300/90 shadow-[0_0_20px_rgba(56,189,248,0.35)] animate-pulse"
      : "cursor-default";
  const isDiscardReady =
    isDiscardStep &&
    selectedCards.length === 1 &&
    !selectedIllegalDiscardCard;
  const flowActorLabel = isMyTurn ? "Your Turn" : `${activeTurnPlayerName}'s Turn`;
  const activeTurnStepLabel = activeTurnHasDrawn ? "Discard" : "Draw";
  const isPhoneLandscapeLayout = isTouchDevice && isUltraShortLandscape;
  const roundOutcomePositionClass = isPhoneLandscapeLayout
    ? isReem
      ? "top-[19%]"
      : "top-[25%]"
    : isReem
      ? "top-[27%]"
      : "top-[34%]";
  const roundActionRailPositionClass = isPhoneLandscapeLayout
    ? isReem
      ? "bottom-[5.8rem] left-1/2 -translate-x-1/2"
      : "bottom-[7.2rem] left-1/2 -translate-x-1/2"
    : isReem
      ? "bottom-3 left-1/2 -translate-x-1/2"
      : "bottom-5 left-1/2 -translate-x-1/2";
  const isHeadsUpTable = totalPlayers <= 2;
  const topSeatPositionClass = isPhoneLandscapeLayout
    ? isHeadsUpTable
      ? "right-[18%] top-[11%]"
      : "left-1/2 top-[9.5%] -translate-x-1/2"
    : "top-2 left-[58%] -translate-x-1/2";
  const topSeatAlign: "left" | "right" = "left";
  const leftSeatPositionClass = isPhoneLandscapeLayout
    ? "left-[3%] top-[40%] -translate-y-1/2"
    : "left-[1.5%] top-1/2 -translate-y-1/2";
  const rightSeatPositionClass = isPhoneLandscapeLayout
    ? "right-[3%] top-[40%] -translate-y-1/2"
    : "right-[1.5%] top-1/2 -translate-y-1/2";
  const topSpreadPositionClass = isPhoneLandscapeLayout
    ? isHeadsUpTable
      ? "right-[8%] top-[34%] w-[24%] max-w-[210px]"
      : "left-1/2 top-[24%] -translate-x-1/2 w-[36%] max-w-[260px]"
    : "left-1/2 top-[28%] -translate-x-1/2 w-[34%] max-w-[300px]";
  const leftSpreadPositionClass = isPhoneLandscapeLayout
    ? "left-[11%] top-[36%] -translate-y-1/2 w-[24%] max-w-[210px]"
    : "left-[18%] top-[36%] -translate-y-1/2 w-[23%] max-w-[210px]";
  const rightSpreadPositionClass = isPhoneLandscapeLayout
    ? "right-[11%] top-[36%] -translate-y-1/2 w-[24%] max-w-[210px]"
    : "right-[18%] top-[36%] -translate-y-1/2 w-[23%] max-w-[210px]";
  const mySpreadPositionClass = isPhoneLandscapeLayout
    ? isHeadsUpTable
      ? "left-1/2 bottom-[33%] -translate-x-1/2 w-[34%] max-w-[250px]"
      : "left-1/2 bottom-[33%] -translate-x-1/2 w-[34%] max-w-[260px]"
    : "left-1/2 bottom-[30%] -translate-x-1/2 w-[30%] max-w-[260px]";

  const contextBannerText = isSpectator
    ? promoModeRequested
      ? `Watching promo action: ${activeTurnPlayerName}.`
      : `Spectating ${activeTurnPlayerName}.`
    : isMyTurn
    ? isDiscardStep
      ? selectedCards.length === 1
        ? selectedIllegalDiscardCard
          ? "Select 1 card, then tap Discard"
          : "Tap discard pile to finish turn."
        : "Select 1 card, then tap Discard"
      : "Draw from deck or discard pile"
    : `You are waiting for ${activeTurnPlayerName}.`;

  const discardHelperText = isDiscardStep
    ? selectedCards.length === 1
      ? selectedIllegalDiscardCard
        ? "Cannot discard this card this turn."
        : "Tap discard pile to finish turn."
      : "Select exactly 1 card to discard"
    : null;
  const guidanceBannerText = guidanceOverrideText ?? contextBannerText;
  const guidanceHelperText = guidanceOverrideHelper ?? discardHelperText;
  const shouldShowGuidanceBanner = showGuidanceBanner && !!guidanceBannerText;
  const shouldShowGuidanceHelper = showGuidanceHelper && !!guidanceHelperText;
  const dropLockTurnsRemaining = currentPlayer?.hitLockCounter ?? 0;

  const canDrop = !!(
    isMyTurn &&
    !hasDrawnThisTurn &&
    dropLockTurnsRemaining <= 0
  );
  const dropDisabledReason = !isMyTurn
    ? "Wait for your turn."
    : hasDrawnThisTurn
      ? "Drop is only available before drawing."
      : dropLockTurnsRemaining > 0
        ? `Drop blocked for ${dropLockTurnsRemaining} turn${dropLockTurnsRemaining === 1 ? "" : "s"}.`
        : undefined;

  const canSpread = !!(
    isMyTurn &&
    hasDrawnThisTurn &&
    !hasDiscardedThisTurn &&
    selectedCards.length >= 3
  );
  const spreadDisabledReason = !isMyTurn
    ? "Wait for your turn."
    : !hasDrawnThisTurn
      ? "Draw first."
      : hasDiscardedThisTurn
        ? "Turn already ended."
      : selectedCards.length >= 3
        ? undefined
        : "Select at least 3 cards.";

  const canHit = !!(
    isMyTurn &&
    hasDrawnThisTurn &&
    !hasDiscardedThisTurn &&
    selectedCards.length === 1
  );
  const hitDisabledReason = !isMyTurn
    ? "Wait for your turn."
    : !hasDrawnThisTurn
      ? "Draw first."
      : hasDiscardedThisTurn
        ? "Turn already ended."
      : selectedCards.length === 1
        ? undefined
        : "Select exactly 1 card.";

  const getTurnStatus = (playerUserId: string, isSelfPanel = false): TurnStatusBadge => {
    if (!activeTurnPlayer || activeTurnPlayer.userId !== playerUserId) {
      return "WAITING";
    }
    if (isSelfPanel && isHitMode) {
      return "HIT MODE";
    }
    return activeTurnPlayer.hasDrawnThisTurn ? "MUST DISCARD" : "DRAWING";
  };

  const turnStatusClasses: Record<TurnStatusBadge, string> = {
    DRAWING: "border-emerald-300/60 bg-emerald-400/15 text-emerald-200",
    "MUST DISCARD": "border-amber-300/60 bg-amber-400/20 text-amber-100",
    "HIT MODE": "border-fuchsia-300/60 bg-fuchsia-500/18 text-fuchsia-100",
    WAITING: "border-white/20 bg-white/5 text-white/75",
  };

  const renderOpponentHand = (count: number, size: "sm" | "md" = "sm") => {
    if (count <= 0) {
      return <div className="text-xs text-white/40">No cards</div>;
    }
    const cardClass =
      size === "md"
        ? "w-11 h-16"
        : isPhoneLandscapeLayout
          ? "w-8 h-11"
          : "w-9 h-14";
    return (
      <div className="relative">
        <CardComponent
          suit="Spades"
          rank="Ace"
          isHidden
          className={cardClass}
        />
        <div className="absolute -bottom-2 -right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full border border-white/10">
          {count}
        </div>
      </div>
    );
  };

  const renderSeatInfo = (
    player: typeof gameState.players[number] | null,
    className: string,
    align: "left" | "right" = "left"
  ) => {
    if (!player) return null;
    const isActive = gameState.players[gameState.currentPlayerIndex]?.userId === player.userId;
    const turnStatus = getTurnStatus(player.userId);
    const seatBalance = playerBalances[player.userId];
    const roundSeatResult = isRoundEnd ? roundResultByUserId.get(player.userId) : null;
    const shouldHighlightSeatWinner = !!roundSeatResult?.isWinner;
    const shouldDimSeatLoser = !!roundSeatResult && !roundSeatResult.isWinner;
    const seatShellClass = isRoundEnd
      ? shouldHighlightSeatWinner
        ? "border-emerald-300/75 bg-emerald-400/14 brightness-100 opacity-100 shadow-[0_0_28px_rgba(52,211,153,0.16)]"
        : "border-white/12 bg-black/45 brightness-75 opacity-72"
      : isActive
        ? "border-yellow-400/80 bg-yellow-400/10 brightness-100 opacity-100"
        : "border-white/10 bg-black/35 brightness-90 opacity-60";

    return (
      <div className={`absolute z-20 pointer-events-none ${className}`}>
        <div
          className={`${
            isActive ? "active-seat" : "inactive-seat"
          } relative flex items-center gap-2 transition-all duration-300 ${
            align === "right" ? "flex-row-reverse text-right" : ""
          }`}
        >
          {isActive && !isRoundEnd ? (
            <div className="absolute -inset-1 rounded-2xl bg-amber-300/15 blur-xl" aria-hidden />
          ) : null}
          {shouldHighlightSeatWinner ? (
            <div className="absolute -inset-2 rounded-[28px] bg-emerald-300/14 blur-2xl" aria-hidden />
          ) : null}
          {renderOpponentHand(getVisibleCardCount(player.userId, player.hand.length), "sm")}
          <div
            className={`relative rounded-lg border transition-all duration-300 ${
              isPhoneLandscapeLayout ? "px-1.5 py-1 min-w-[102px]" : "px-2 py-1 min-w-[118px]"
            } ${seatShellClass}`}
          >
            <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
              <div className="relative">
                <PlayerAvatar player={{ name: player.username, avatarUrl: player.avatarUrl }} size="sm" />
                <TurnTimer
                  duration={turnDurationMs}
                  timeRemaining={isActive ? turnTimeRemainingMs : turnDurationMs}
                  isActive={isActive}
                  size={isPhoneLandscapeLayout ? 44 : 54}
                  strokeWidth={isPhoneLandscapeLayout ? 2.8 : 3.5}
                  className={isActive ? "animate-pulse" : ""}
                />
              </div>
              <div>
                {isRoundEnd ? (
                  <div
                    className={`mb-1 inline-flex rounded-full border px-2 py-0.5 font-semibold tracking-wide ${
                      isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                    } ${
                      shouldHighlightSeatWinner
                        ? "border-emerald-200/40 bg-emerald-300/14 text-emerald-100"
                        : shouldDimSeatLoser
                          ? "border-rose-200/35 bg-rose-400/12 text-rose-100"
                          : "border-white/12 bg-white/6 text-white/72"
                    }`}
                  >
                    {roundSeatResult?.resultLabel ?? "Round End"}
                  </div>
                ) : (
                  <div
                    className={`mb-1 inline-flex rounded-full border px-2 py-0.5 font-semibold tracking-wide ${
                      isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                    } ${turnStatusClasses[turnStatus]}`}
                  >
                    {turnStatus}
                  </div>
                )}
                <div className={`${isPhoneLandscapeLayout ? "text-[10px]" : "text-[11px]"} text-white font-semibold leading-tight`}>
                  {player.username}
                </div>
                <div className={`${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} text-white/60 leading-tight`}>
                  Cards: {getVisibleCardCount(player.userId, player.hand.length)}
                </div>
                <div className={`${isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"} text-yellow-300/95 leading-tight`}>
                  {formatSeatBalance(seatBalance)}
                </div>
                {roundSeatResult ? (
                  <>
                    <div
                      className={`mt-1 ${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} font-semibold leading-tight ${
                        shouldHighlightSeatWinner
                          ? "text-emerald-200"
                          : shouldDimSeatLoser
                            ? "text-rose-200"
                            : "text-white/75"
                      }`}
                    >
                      {roundSeatResult.deltaLabel}
                    </div>
                    <div className={`${isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"} leading-tight ${
                      shouldHighlightSeatWinner ? "text-emerald-100/92" : "text-white/58"
                    }`}>
                      {roundSeatResult.seatLabel}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const displayedBottomPlayer = isSpectator ? viewerSeatPlayer : currentPlayer;
  const hand = sortHandCards(displayedBottomPlayer?.hand ?? []);
  const visibleHand =
    displayedBottomPlayer ? hand.slice(0, getVisibleCardCount(displayedBottomPlayer.userId, hand.length)) : [];
  const myTurnStatus = getTurnStatus(displayedBottomPlayer?.userId ?? user._id, true);
  const canUseFlickDiscard = !isSpectator && isTouchDevice && isDiscardReady;
  const showSideActionStack = !isSpectator && isMyTurn && !hideCardsForPresentation;
  const isBottomSeatActive = isSpectator
    ? gameState.players[gameState.currentPlayerIndex]?.userId === displayedBottomPlayer?.userId
    : isMyTurn;
  const bottomSeatName = isSpectator
    ? displayedBottomPlayer?.username ?? "Promo AI"
    : user.username;
  const bottomSeatAvatarUrl = isSpectator
    ? displayedBottomPlayer?.avatarUrl
    : user.avatarUrl;
  const bottomSeatBalance = isSpectator
    ? "PROMO AI"
    : balanceLoading
      ? "..."
      : formatSeatBalance(balance);
  const bottomSeatRoundResult = displayedBottomPlayer ? roundResultByUserId.get(displayedBottomPlayer.userId) : null;
  const shouldHighlightBottomWinner = !!bottomSeatRoundResult?.isWinner;
  const shouldDimBottomLoser = !!bottomSeatRoundResult && !bottomSeatRoundResult.isWinner;
  const bottomSeatShellClass = isRoundEnd
    ? shouldHighlightBottomWinner
      ? "border-emerald-300/75 bg-emerald-400/14 brightness-100 opacity-100 shadow-[0_0_30px_rgba(52,211,153,0.16)]"
      : "border-white/12 bg-black/45 brightness-75 opacity-72"
    : isBottomSeatActive
      ? "border-yellow-400/80 bg-yellow-400/10 brightness-100 opacity-100"
      : "border-white/10 bg-black/30 brightness-90 opacity-60";
  const phoneHandCardClass =
    visibleHand.length >= 6
      ? "w-[2.2rem] h-[3.2rem]"
      : visibleHand.length >= 5
        ? "w-[2.4rem] h-[3.5rem]"
        : visibleHand.length >= 4
          ? "w-[2.6rem] h-[3.8rem]"
          : "w-[2.8rem] h-[4.1rem]";
  const reemShowcaseSpreads = isReem ? winnerPlayer?.spreads.map(sortSpreadCards) ?? [] : [];

  const renderSpreadZone = (
    player: typeof gameState.players[number] | null,
    _label: string,
    className: string
  ) => {
    if (hideCardsForPresentation) return null;
    if (!player || player.spreads.length === 0) return null;
    const sortedSpreads = player.spreads.map(sortSpreadCards);
    const isWinningSeat = isRoundEnd && player.userId === winnerPlayer?.userId;
    if (isReem && isWinningSeat) return null;

    return (
      <div className={`absolute z-10 pointer-events-none ${className}`}>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {sortedSpreads.map((spread, sIdx) => (
            <motion.div
              key={`${player.userId}-spread-${sIdx}`}
              className={`flex ${isPhoneLandscapeLayout ? "-space-x-4" : "-space-x-5"} ${
                isHitMode ? "cursor-pointer pointer-events-auto ring-2 ring-yellow-400 rounded-lg p-1 bg-yellow-400/10" : "pointer-events-none"
              } ${
                isWinningSeat ? "rounded-xl bg-emerald-300/8 p-1 ring-1 ring-emerald-300/35 shadow-[0_0_22px_rgba(52,211,153,0.16)]" : ""
              }`}
              onClick={() => isHitMode && executeHit(player.userId, sIdx)}
              initial={{
                opacity: 0,
                y: player.userId === user._id ? 68 : -28,
                scale: 0.84,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 270, damping: 20, delay: sIdx * 0.06 }}
            >
              {spread.map((card, cIdx) => (
                <motion.div
                  key={cIdx}
                  initial={{
                    opacity: 0,
                    y: 20,
                    x: (cIdx - (spread.length - 1) / 2) * 10,
                    rotate: (cIdx - (spread.length - 1) / 2) * 5,
                    scale: 0.86,
                  }}
                  animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 24,
                    delay: 0.03 * cIdx,
                  }}
                >
                  <CardComponent
                    suit={card.suit}
                    rank={card.rank}
                    className={isPhoneLandscapeLayout ? "w-8 h-11 text-[8px]" : "w-8 h-12 sm:w-9 sm:h-14 text-[9px]"}
                  />
                </motion.div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const renderReemShowcaseRow = () => {
    if (!isReem || reemShowcaseSpreads.length === 0) return null;

    return (
      <div
        className={`absolute left-1/2 z-20 w-full -translate-x-1/2 -translate-y-1/2 pointer-events-none ${
          isPhoneLandscapeLayout ? "top-[66%]" : "top-[62%]"
        }`}
      >
        <div
          className={`mx-auto flex items-start justify-center ${
            reemShowcaseSpreads.length > 1 ? "gap-5 sm:gap-8" : "gap-3"
          } ${isPhoneLandscapeLayout ? "max-w-[86%]" : "max-w-[72%]"}`}
        >
          {reemShowcaseSpreads.map((spread, spreadIndex) => (
            <motion.div
              key={`reem-showcase-${spreadIndex}`}
              className={`rounded-2xl px-2 py-1 ${
                isPhoneLandscapeLayout ? "-space-x-4" : "-space-x-5"
              } flex bg-emerald-300/8 ring-1 ring-emerald-300/30 shadow-[0_0_26px_rgba(52,211,153,0.15)]`}
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24, delay: spreadIndex * 0.08 }}
            >
              {spread.map((card, cardIndex) => (
                <motion.div
                  key={`${card.rank}-${card.suit}-${cardIndex}`}
                  initial={{
                    opacity: 0,
                    y: 16,
                    x: (cardIndex - (spread.length - 1) / 2) * 8,
                    rotate: (cardIndex - (spread.length - 1) / 2) * 4,
                    scale: 0.9,
                  }}
                  animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.03 * cardIndex }}
                >
                  <CardComponent
                    suit={card.suit}
                    rank={card.rank}
                    className={isPhoneLandscapeLayout ? "w-8 h-11 text-[8px]" : "w-9 h-14 text-[9px]"}
                  />
                </motion.div>
              ))}
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden" style={{ height: "var(--app-height)" }}>
      <div className="absolute inset-0 z-0" aria-hidden>
        <div
          className={`absolute inset-0 transition-[filter,transform] duration-300 ${
            isMyTurn ? "blur-[1px] scale-[1.01]" : "blur-0 scale-100"
          }`}
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.5)), url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,199,74,0.22),transparent_55%)]" />
      </div>

      <div
        className="relative z-10 h-full flex flex-col"
        style={{
          paddingTop: "var(--safe-area-top)",
          paddingRight: "var(--safe-area-right)",
          paddingBottom: isPhoneLandscapeLayout
            ? "calc(var(--safe-area-bottom) + 14px)"
            : "calc(var(--safe-area-bottom) + 8px)",
          paddingLeft: "var(--safe-area-left)",
        }}
      >
        {isMobilePortrait && (
          <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm flex items-center justify-center px-6 text-center">
            <div className="max-w-sm">
              <div className="text-white text-lg font-semibold">Landscape mode required</div>
              <p className="text-white/70 text-sm mt-2">
                Rotate your device to landscape to play at this game table.
              </p>
            </div>
          </div>
        )}

        <div
          className={`game-wrapper flex-1 relative overflow-hidden touch-manipulation ${
            isPhoneLandscapeLayout ? "pb-0" : isCompactLandscape ? "pb-2" : "pb-6"
          } ${isMobilePortrait ? "pointer-events-none" : ""}`}
        >
          <div className="table-area relative w-full h-full flex items-center justify-center">
            <div
              className={`table relative ${
                isPhoneLandscapeLayout
                  ? "w-full h-full rounded-[18px] border-[8px]"
                  : "aspect-[16/9] rounded-[28px] border-[12px] w-[96vw]"
              } shadow-2xl overflow-hidden bg-black/20 ${isReem ? 'border-yellow-400 animate-pulse' : 'border-[#3b2c12]'}`}
              style={isPhoneLandscapeLayout ? undefined : { maxWidth: `${tableMaxWidthPx}px` }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.06),transparent_60%)]" />
              <div
                className={`absolute inset-0 transition-opacity duration-300 ${
                  isMyTurn
                    ? "opacity-100 bg-[radial-gradient(circle_at_50%_54%,rgba(255,255,255,0.12),rgba(0,0,0,0.08)_46%,rgba(0,0,0,0.22)_100%)]"
                    : "opacity-0"
                }`}
              />
              <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                  isRoundEnd
                    ? "opacity-100 bg-[radial-gradient(circle_at_50%_46%,rgba(255,236,179,0.08),rgba(0,0,0,0.08)_34%,rgba(0,0,0,0.2)_100%)]"
                    : "opacity-0"
                }`}
              />
              <div
                className={`absolute z-20 flex items-center justify-between ${
                  isPhoneLandscapeLayout ? "top-2 left-2 right-2 gap-1.5" : "top-3 left-3 right-3 gap-2"
                }`}
              >
                <div
                  className={`flex items-center bg-black/50 text-white rounded-full border border-white/10 backdrop-blur-sm min-w-0 ${
                    isPhoneLandscapeLayout ? "gap-1 px-2 py-0.5" : "gap-2 px-2 py-1"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="absolute -inset-1 rounded-full bg-yellow-400/20 blur-lg" />
                    <img
                      src={logoSrc}
                      alt="ReemTeam logo"
                      className={`relative object-contain ${isPhoneLandscapeLayout ? "w-5 h-5" : "w-6 h-6"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`${isPhoneLandscapeLayout ? "text-[10px]" : "text-[11px]"} font-bold tracking-wide truncate`}
                      style={{ fontFamily: displayFont }}
                    >
                      ReemTeam
                    </div>
                    {!isPhoneLandscapeLayout ? (
                      <div className="text-[9px] text-white/60 uppercase tracking-[0.3em]">Tonk Arena</div>
                    ) : null}
                  </div>
                </div>
                <div className={`flex items-center ${isPhoneLandscapeLayout ? "gap-1" : "gap-2"}`}>
                  <div
                    className={`flex items-center bg-black/50 text-white rounded-full border border-white/10 backdrop-blur-sm ${
                      isPhoneLandscapeLayout ? "gap-1 px-2 py-0.5 text-[10px]" : "gap-2 px-2 py-1 text-[10px]"
                    }`}
                  >
                    {!isPhoneLandscapeLayout ? (
                      <span className="uppercase tracking-widest text-[9px] text-white/60">Players</span>
                    ) : null}
                    <span className="font-bold">
                      {isPhoneLandscapeLayout ? "P " : ""}
                      {gameState.players.length}/{maxPlayers}
                    </span>
                  </div>
                  <div
                    className={`flex items-center bg-black/50 text-white rounded-full border border-white/10 backdrop-blur-sm ${
                      isPhoneLandscapeLayout ? "gap-1 px-2 py-0.5 text-[10px]" : "gap-2 px-2 py-1 text-[10px]"
                    }`}
                  >
                    {!isPhoneLandscapeLayout ? (
                      <span className="uppercase tracking-widest text-[9px] text-white/60">Table Pot</span>
                    ) : null}
                    <span className="font-bold">{formatSeatBalance(gameState.pot)}</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenHowToPlay}
                    className={isPhoneLandscapeLayout ? "h-9 px-3 text-[11px]" : ""}
                  >
                    Rules
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleLeaveTable}
                    className={isPhoneLandscapeLayout ? "h-9 px-3 text-[11px]" : ""}
                  >
                    Leave
                  </Button>
                </div>
              </div>

              {!isPhoneLandscapeLayout && !isRoundEnd ? (
                <div className="absolute right-3 top-14 z-30 pointer-events-none">
                  <div className="max-w-[240px] rounded-lg border border-cyan-200/60 bg-black/72 px-3 py-2 text-right shadow-[0_0_18px_rgba(34,211,238,0.2)] backdrop-blur-sm">
                    <div className="text-[10px] font-semibold text-cyan-100">{flowActorLabel}</div>
                    <div className="mt-1 flex items-center justify-end gap-2 text-[10px] uppercase tracking-wide">
                      <span
                        className={`transition-all ${
                          activeTurnStepLabel === "Draw"
                            ? "text-cyan-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.65)]"
                            : "text-cyan-200/60"
                        }`}
                      >
                        Draw
                      </span>
                      <div className="relative h-[2px] w-16 rounded-full bg-cyan-100/20">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                            activeTurnStepLabel === "Draw" ? "w-1/3 bg-cyan-300" : "w-full bg-emerald-300"
                          }`}
                        />
                      </div>
                      <span
                        className={`transition-all ${
                          activeTurnStepLabel === "Discard"
                            ? "text-emerald-100 drop-shadow-[0_0_10px_rgba(52,211,153,0.68)]"
                            : "text-cyan-200/60"
                        }`}
                      >
                        Discard
                      </span>
                    </div>
                    {isMyTurn ? (
                      <div className="mt-1 text-[9px] font-medium text-cyan-200/90">
                        {isDiscardStep ? "Select 1 card, then tap Discard." : "Draw from deck or discard pile."}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {renderSeatInfo(topPlayer, topSeatPositionClass, topSeatAlign)}
              {renderSeatInfo(leftPlayer, leftSeatPositionClass, "left")}
              {renderSeatInfo(rightPlayer, rightSeatPositionClass, "right")}

              {renderSpreadZone(topPlayer, "Top Spread", topSpreadPositionClass)}
              {renderSpreadZone(leftPlayer, "Left Spread", leftSpreadPositionClass)}
              {renderSpreadZone(rightPlayer, "Right Spread", rightSpreadPositionClass)}
              {renderSpreadZone(currentPlayer ?? null, "Your Spread", mySpreadPositionClass)}
              {renderReemShowcaseRow()}

              {showDealAnimation && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                  {shufflePhase ? (
                    <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <motion.div
                          key={`shuffle-${idx}`}
                          className="absolute w-9 h-14 rounded-lg border border-white/20 shadow-xl"
                          style={{
                            backgroundImage: `url(${backCardImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            left: `${idx * 4}px`,
                            top: `${idx * 2}px`,
                          }}
                          initial={{ y: -130, rotate: -20 + idx * 10, opacity: 0 }}
                          animate={{ y: 0, rotate: 10 - idx * 7, opacity: 1 }}
                          transition={{ duration: 0.32, delay: idx * 0.08, ease: "easeOut" }}
                        />
                      ))}
                    </div>
                  ) : placeDeckPhase ? (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <motion.div
                        className="w-9 h-14 rounded-lg border border-white/20 shadow-xl"
                        style={{ backgroundImage: `url(${backCardImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
                        initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                        animate={{ x: -96, y: -6, rotate: -3, opacity: 1 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <motion.div
                          className="w-9 h-14 rounded-lg border border-white/20 shadow-xl"
                          style={{ backgroundImage: `url(${backCardImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
                          initial={{ rotate: -16, scale: 0.95, opacity: 0.9 }}
                          animate={{ rotate: 16, scale: 1.02, opacity: 1 }}
                          transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.35 }}
                        />
                      </div>
                      {Array.from({ length: totalCardsToDeal || 20 }).map((_, idx) => (
                        <motion.div
                          key={`deal-${idx}`}
                          className="absolute left-1/2 top-1/2 w-8 h-12 rounded-md border border-white/20"
                          style={{ backgroundImage: `url(${backCardImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
                          initial={{ x: 0, y: 0, opacity: 0 }}
                          animate={{
                            x: getDealTargetOffset(idx).x,
                            y: getDealTargetOffset(idx).y,
                            opacity: dealingCardIndex > idx ? 1 : 0,
                          }}
                          transition={{ duration: 0.28, ease: "easeOut" }}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}

              {isRoundEnd ? (
                <div
                  className={`pointer-events-none absolute left-1/2 z-20 ${roundOutcomePositionClass} -translate-x-1/2 -translate-y-1/2`}
                >
                  <div className="flex max-w-[78vw] flex-col items-center text-center sm:max-w-[520px]">
                    <div
                      className={`font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.58)] ${
                        isPhoneLandscapeLayout ? "text-lg" : "text-2xl sm:text-3xl"
                      }`}
                    >
                      {roundOutcome.headline}
                    </div>
                    <div className={`${isPhoneLandscapeLayout ? "mt-2 text-[11px]" : "mt-3 text-sm sm:text-base"} font-semibold text-amber-100`}>
                      {winnerLine}
                    </div>
                    <div className={`${isPhoneLandscapeLayout ? "mt-2 text-[9px]" : "mt-3 text-[11px] sm:text-sm"} text-white/72`}>
                      {roundOutcome.explanation}
                    </div>
                  </div>
                </div>
              ) : null}
              <div
                className={`center-pile absolute left-1/2 ${
                  isPhoneLandscapeLayout ? "top-[43%]" : "top-1/2"
                } -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${
                  isPhoneLandscapeLayout ? "gap-1.5" : "gap-2"
                } transition-all duration-300 ${
                  isRoundEnd
                    ? "opacity-90 brightness-90"
                    : isMyTurn
                      ? "brightness-110"
                      : "brightness-100"
                }`}
              >
                <div className={`flex items-center ${isPhoneLandscapeLayout ? "gap-3" : "gap-4"}`}>
                  <div className={`relative ${isPhoneLandscapeLayout ? "w-8 h-11" : "w-8 h-12 sm:w-10 sm:h-14"}`}>
                    {!hideCardsForPresentation && gameState.deck.length > 0 && (
                      <div
                        className={`w-full h-full rounded-lg border border-white/20 shadow-xl flex items-center justify-center relative transition-transform ${deckPrimaryHighlightClass}`}
                        style={{
                          backgroundImage: `url(${backCardImage})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        onClick={handleDeckClick}
                      >
                      </div>
                    )}
                  </div>
                  <div
                    className={`relative ${isPhoneLandscapeLayout ? "w-8 h-11" : "w-8 h-12 sm:w-10 sm:h-14"}`}
                    onClick={() => {
                      if (!hideCardsForPresentation) handleDiscardPileClick();
                    }}
                  >
                    {!hideCardsForPresentation && gameState.discardPile.length > 0 ? (
                      <div className={`relative transition-all ${discardPrimaryHighlightClass}`}>
                        <CardComponent
                          suit={gameState.discardPile[gameState.discardPile.length - 1].suit}
                          rank={gameState.discardPile[gameState.discardPile.length - 1].rank}
                          className={isPhoneLandscapeLayout ? "w-8 h-11" : "w-8 h-12 sm:w-10 sm:h-14"}
                        />
                      </div>
                    ) : !hideCardsForPresentation ? (
                      <div className={`w-full h-full border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/40 relative ${discardPrimaryHighlightClass}`}>
                        Discard
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {isRoundEnd ? (
                <div
                  className={`absolute z-30 pointer-events-auto ${roundActionRailPositionClass}`}
                >
                  <div className={`flex flex-col ${isPhoneLandscapeLayout ? "items-center gap-1.5" : "items-center gap-2"}`}>
                    <div className="flex items-center gap-2">
                      {isContinuousMode && !isSpectator ? (
                        <Button onClick={handlePutIn} variant="primary" size="sm" disabled={isReadyForNextRound}>
                          Run It Back
                        </Button>
                      ) : null}
                      <Button
                        onClick={isContinuousMode ? handleRequestLeaveTable : handleLeaveTable}
                        variant="secondary"
                        size="sm"
                      >
                        Leave
                      </Button>
                    </div>
                    <div className={`${isPhoneLandscapeLayout ? "text-[9px]" : "text-[11px]"} text-white/72`}>
                      {countdownLabel ? (
                        <>
                          {countdownLabel}
                          {" • "}
                          {roundRailStatusLabel}
                        </>
                      ) : (
                        roundRailStatusLabel
                      )}
                    </div>
                    {roundStatusDetail ? (
                      <div className={`${isPhoneLandscapeLayout ? "text-[8px]" : "text-[10px]"} uppercase tracking-[0.16em] text-white/46`}>
                        {roundStatusDetail}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div
                className={`seat absolute left-1/2 -translate-x-1/2 pointer-events-auto ${
                  isPhoneLandscapeLayout
                    ? "w-[99%] h-[160px] bottom-0"
                    : isCompactLandscape
                      ? "w-[96%] max-w-[820px] h-[168px] bottom-1"
                      : "w-[96%] max-w-[820px] h-[176px] bottom-2"
                }`}
              >
                <div className={`flex w-full h-full ${isPhoneLandscapeLayout ? "items-end gap-1.5" : "items-end gap-2"}`}>
                  <div
                    className={`${
                      isBottomSeatActive ? "active-seat" : "inactive-seat"
                    } relative rounded-lg border transition-all duration-300 ${
                      isPhoneLandscapeLayout
                        ? "min-w-[128px] px-1.5 py-1 mb-1"
                        : `min-w-[140px] px-2 py-2 ${isCompactLandscape ? "mb-4" : "mb-6"}`
                    } ${bottomSeatShellClass}`}
                  >
                    {isBottomSeatActive && !isRoundEnd ? (
                      <div className="absolute -inset-1 rounded-2xl bg-amber-300/15 blur-xl" aria-hidden />
                    ) : null}
                    {shouldHighlightBottomWinner ? (
                      <div className="absolute -inset-2 rounded-[28px] bg-emerald-300/14 blur-2xl" aria-hidden />
                    ) : null}
                    <div className={`flex items-center ${isPhoneLandscapeLayout ? "gap-1.5" : "gap-2"}`}>
                      <div className="relative">
                        <PlayerAvatar player={{ name: bottomSeatName, avatarUrl: bottomSeatAvatarUrl }} size="sm" />
                        <TurnTimer
                          duration={turnDurationMs}
                          timeRemaining={isBottomSeatActive ? turnTimeRemainingMs : turnDurationMs}
                          isActive={isBottomSeatActive}
                          size={isPhoneLandscapeLayout ? 42 : 54}
                          strokeWidth={isPhoneLandscapeLayout ? 2.6 : 3.5}
                          className={isBottomSeatActive ? "animate-pulse" : ""}
                        />
                      </div>
                      <div>
                        {isRoundEnd ? (
                          <div
                            className={`mb-1 inline-flex rounded-full border px-2 py-0.5 font-semibold tracking-wide ${
                              isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                            } ${
                              shouldHighlightBottomWinner
                                ? "border-emerald-200/40 bg-emerald-300/14 text-emerald-100"
                                : shouldDimBottomLoser
                                  ? "border-rose-200/35 bg-rose-400/12 text-rose-100"
                                  : "border-white/12 bg-white/6 text-white/72"
                            }`}
                          >
                            {bottomSeatRoundResult?.resultLabel ?? "Round End"}
                          </div>
                        ) : (
                          <div
                            className={`mb-1 inline-flex rounded-full border px-2 py-0.5 font-semibold tracking-wide ${
                              isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                            } ${turnStatusClasses[myTurnStatus]}`}
                          >
                            {myTurnStatus}
                          </div>
                        )}
                        {isPhoneLandscapeLayout && !isRoundEnd ? (
                          <div className="mb-1 rounded-md border border-cyan-200/40 bg-black/35 px-1.5 py-1 text-cyan-100">
                            <div className="truncate text-[8px] font-semibold">{flowActorLabel}</div>
                            <div className="mt-0.5 flex items-center gap-1 text-[8px] uppercase tracking-wide">
                              <span
                                className={`transition-all ${
                                  activeTurnStepLabel === "Draw"
                                    ? "text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]"
                                    : "text-cyan-200/60"
                                }`}
                              >
                                D
                              </span>
                              <div className="relative h-[2px] w-10 rounded-full bg-cyan-100/20">
                                <div
                                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                                    activeTurnStepLabel === "Draw" ? "w-1/3 bg-cyan-300" : "w-full bg-emerald-300"
                                  }`}
                                />
                              </div>
                              <span
                                className={`transition-all ${
                                  activeTurnStepLabel === "Discard"
                                    ? "text-emerald-100 drop-shadow-[0_0_8px_rgba(52,211,153,0.58)]"
                                    : "text-cyan-200/60"
                                }`}
                              >
                                X
                              </span>
                            </div>
                          </div>
                        ) : null}
                        <div className={`${isPhoneLandscapeLayout ? "text-[10px]" : "text-[11px]"} text-white font-semibold leading-tight`}>
                          {bottomSeatName}
                        </div>
                        <div className={`${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} text-white/60 leading-tight`}>
                          Cards: {visibleHand.length}
                        </div>
                        <div className={`${isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"} text-yellow-300/95 leading-tight`}>
                          {bottomSeatBalance}
                        </div>
                        {bottomSeatRoundResult ? (
                          <>
                            <div
                              className={`mt-1 ${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} font-semibold leading-tight ${
                                shouldHighlightBottomWinner
                                  ? "text-emerald-200"
                                  : shouldDimBottomLoser
                                    ? "text-rose-200"
                                    : "text-white/75"
                              }`}
                            >
                              {bottomSeatRoundResult.deltaLabel}
                            </div>
                            <div className={`${isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"} leading-tight ${
                              shouldHighlightBottomWinner ? "text-emerald-100/92" : "text-white/58"
                            }`}>
                              {bottomSeatRoundResult.seatLabel}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {showSideActionStack && (
                    <div
                      className={`actions pointer-events-auto self-end ${
                        isPhoneLandscapeLayout
                          ? "mb-1 ml-1 w-[80px]"
                          : `${isCompactLandscape ? "mb-4 ml-2 w-[94px]" : "mb-6 ml-2 w-[98px]"}`
                      }`}
                    >
                      <GameActions
                        drop={{
                          enabled: canDrop,
                          reason: canDrop ? undefined : dropDisabledReason,
                          isPrimary: canDrop && isDrawStep,
                        }}
                        spread={{
                          enabled: canSpread,
                          reason: canSpread ? undefined : spreadDisabledReason,
                          isPrimary: canSpread,
                        }}
                        hit={{
                          enabled: canHit,
                          reason: canHit ? undefined : hitDisabledReason,
                          isPrimary: canHit,
                        }}
                        onDrop={handleDrop}
                        onSpread={handleSpread}
                        onHit={handleHitClick}
                        orientation="vertical"
                        layout="side-stack"
                      />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col items-center justify-end">
                    {shouldShowGuidanceBanner ? (
                      <div
                        className={`w-full rounded-lg border border-sky-300/30 bg-black/45 text-center font-medium text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.18)] pointer-events-none select-none ${
                          isPhoneLandscapeLayout
                            ? "mb-0.5 max-w-[460px] px-2 py-0.5 text-[9px]"
                            : "mb-1 max-w-[520px] px-3 py-1.5 text-[11px]"
                        }`}
                      >
                        {guidanceBannerText}
                      </div>
                    ) : null}
                    {shouldShowGuidanceHelper && !isPhoneLandscapeLayout ? (
                      <div
                        className={`${isPhoneLandscapeLayout ? "mb-0.5 text-[9px]" : "mb-1 text-[10px]"} font-semibold pointer-events-none select-none ${
                          selectedIllegalDiscardCard ? "text-rose-300" : "text-emerald-200"
                        }`}
                      >
                        {guidanceHelperText}
                        {canUseFlickDiscard && !isPhoneLandscapeLayout ? " Or flick selected card toward discard pile." : ""}
                      </div>
                    ) : null}
                    <div
                      className={`w-full flex flex-col items-center ${
                        isPhoneLandscapeLayout
                          ? "-translate-x-3 translate-y-0"
                          : isCompactLandscape
                            ? "-translate-x-10 translate-y-4"
                            : "-translate-x-14 translate-y-6"
                      }`}
                    >
                      <div
                        className={`hand relative w-full pointer-events-auto ${
                          isPhoneLandscapeLayout ? "h-[86px] max-w-none px-1" : "h-28 max-w-[760px]"
                        }`}
                      >
                        <AnimatePresence>
                          <div
                            className={`flex flex-nowrap items-end justify-center ${
                              isPhoneLandscapeLayout ? "gap-1" : "gap-1 sm:gap-1.5"
                            }`}
                          >
                            {visibleHand.map((card) => {
                              const isSelectedCard = selectedCards.some(
                                (c) => c.rank === card.rank && c.suit === card.suit
                              );
                              const isIllegalDiscardSelection =
                                isSelectedCard && isDiscardStep && isRestrictedDiscardCard(card);
                              const enableFlickDrag =
                                canUseFlickDiscard && isSelectedCard && !isIllegalDiscardSelection;

                              return (
                                <motion.div
                                  key={`${card.rank}-${card.suit}`}
                                  className="card"
                                  initial={{ y: 30, opacity: 0 }}
                                  animate={{
                                    y: 0,
                                    scale: isSelectedCard ? 1.04 : 1,
                                    opacity: 1,
                                  }}
                                  exit={{ y: -20, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                  whileHover={isMyTurn ? { scale: 1.03 } : undefined}
                                  whileTap={isMyTurn ? { scale: 0.98 } : undefined}
                                >
                                  <CardComponent
                                    suit={card.suit}
                                    rank={card.rank}
                                    isSelected={isSelectedCard}
                                    onClick={isSpectator ? undefined : () => toggleCardSelection(card)}
                                    className={isPhoneLandscapeLayout ? phoneHandCardClass : "w-11 h-16 sm:w-12 sm:h-[4.5rem]"}
                                    badgeText={
                                      isIllegalDiscardSelection
                                        ? "Cannot discard this card this turn."
                                        : undefined
                                    }
                                    badgeTone="danger"
                                    dragEnabled={enableFlickDrag}
                                    onDragEnd={(_, info) => handleFlickDiscard(card, info)}
                                  />
                                </motion.div>
                              );
                            })}
                          </div>
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GameTable;
