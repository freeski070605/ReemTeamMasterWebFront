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
import RtcParticleOverlay from "../components/game/RtcParticleOverlay";
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
type InlineFeedbackArea = "hand" | "discard" | "center" | "spreads" | "actions";
type InlineFeedbackTone = "error" | "info";

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
  const [, setShowGuidanceBanner] = useState(false);
  const [showGuidanceHelper, setShowGuidanceHelper] = useState(false);
  const [guidanceOverrideText, setGuidanceOverrideText] = useState<string | null>(null);
  const [guidanceOverrideHelper, setGuidanceOverrideHelper] = useState<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<{
    message: string;
    tone: InlineFeedbackTone;
    area: InlineFeedbackArea;
  } | null>(null);
  const [feedbackPulseArea, setFeedbackPulseArea] = useState<InlineFeedbackArea | null>(null);
  const [activityTick, setActivityTick] = useState(0);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const seatAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastAnimatedRoundKeyRef = useRef<string | null>(null);
  const hasInitializedLastActionRef = useRef(false);
  const lastObservedActionTimestampRef = useRef<number | null>(null);
  const guidanceBannerTimeoutRef = useRef<number | null>(null);
  const guidanceHelperTimeoutRef = useRef<number | null>(null);
  const idleGuidanceTimeoutRef = useRef<number | null>(null);
  const inlineFeedbackTimeoutRef = useRef<number | null>(null);
  const feedbackPulseTimeoutRef = useRef<number | null>(null);
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
    (message: string, tone: InlineFeedbackTone = "info", area: InlineFeedbackArea = "center") => {
      setInlineFeedback({ message, tone, area });
      setFeedbackPulseArea(area);

      if (inlineFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(inlineFeedbackTimeoutRef.current);
      }

      if (feedbackPulseTimeoutRef.current !== null) {
        window.clearTimeout(feedbackPulseTimeoutRef.current);
      }

      inlineFeedbackTimeoutRef.current = window.setTimeout(() => {
        setInlineFeedback((current) => (current?.message === message ? null : current));
      }, tone === "error" ? 2200 : 1800);

      feedbackPulseTimeoutRef.current = window.setTimeout(() => {
        setFeedbackPulseArea((current) => (current === area ? null : current));
      }, 560);
    },
    []
  );

  const setSeatAnchorRef = useCallback((userId: string, node: HTMLDivElement | null) => {
    seatAnchorRefs.current[userId] = node;
  }, []);

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
      if (inlineFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(inlineFeedbackTimeoutRef.current);
        inlineFeedbackTimeoutRef.current = null;
      }
      if (feedbackPulseTimeoutRef.current !== null) {
        window.clearTimeout(feedbackPulseTimeoutRef.current);
        feedbackPulseTimeoutRef.current = null;
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
      showActionToast("Select exactly one card to discard.", "error", "hand");
      triggerGuidance({
        bannerText: "Select exactly 1 card to discard",
        helperText: "Then tap Discard.",
      });
      return false;
    }

    if (isRestrictedDiscardCard(selectedCards[0])) {
      showActionToast("Cannot discard this card this turn.", "error", "hand");
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
        showActionToast("Discard pile is empty.", "error", "discard");
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
      showActionToast("Select at least 3 cards for a spread.", "error", "hand");
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
      showActionToast("Select one card to hit with.", "error", "hand");
      triggerGuidance({
        bannerText: "Select exactly 1 card for Hit",
      });
      return;
    }
    setIsHitMode(true);
    showActionToast("Select a spread to hit.", "info", "spreads");
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

  const leftSeatOffset = totalPlayers >= 3 ? 1 : null;
  const topSeatOffset = totalPlayers === 2 ? 1 : totalPlayers >= 3 ? 2 : null;
  const rightSeatOffset = totalPlayers >= 4 ? 3 : null;
  const leftPlayer = leftSeatOffset === null ? null : seatAt(leftSeatOffset);
  const topPlayer = topSeatOffset === null ? null : seatAt(topSeatOffset);
  const rightPlayer = rightSeatOffset === null ? null : seatAt(rightSeatOffset);
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

    if (seatOffset === 1) {
      return totalPlayersInRound >= 3 ? { x: -230, y: 20 } : { x: 0, y: -150 };
    }

    if (seatOffset === 2) return { x: 0, y: -150 };

    if (seatOffset === 3) return { x: 230, y: 20 };
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
    ? "cursor-pointer hover:scale-[1.03] drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]"
    : "cursor-not-allowed opacity-90";
  const discardPrimaryHighlightClass = canTapDiscardPileToFinishTurn
    ? "cursor-pointer hover:scale-[1.03] drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]"
    : canDrawFromDiscard
      ? "cursor-pointer hover:scale-[1.03] drop-shadow-[0_0_18px_rgba(56,189,248,0.35)]"
      : "cursor-default";
  const isDiscardReady =
    isDiscardStep &&
    selectedCards.length === 1 &&
    !selectedIllegalDiscardCard;
  const isPhoneLandscapeLayout = isTouchDevice && isUltraShortLandscape;
  const isHeadsUpTable = totalPlayers <= 2;
  const isThreeHandedTable = totalPlayers === 3;
  const lastActionType = gameState.lastAction?.type ?? null;
  const lastActionPayload = gameState.lastAction?.payload as Record<string, unknown> | undefined;
  const contextBannerText = isRoundEnd
    ? roundOutcome.secondary
    : isHitMode
      ? "Choose a spread to hit"
      : isMyTurn
        ? isDiscardStep
          ? selectedCards.length === 1
            ? selectedIllegalDiscardCard
              ? "Select another card to discard"
              : "Choose 1 card to discard"
            : "Choose 1 card to discard"
          : "Draw a card to begin your turn"
        : null;

  const discardHelperText = isDiscardStep
    ? selectedCards.length === 1
      ? selectedIllegalDiscardCard
        ? "This pickup cannot be discarded this turn."
        : "Tap the discard pile or flick the selected card upward."
      : "Pick exactly 1 card from your hand."
    : isHitMode
      ? "Select a highlighted spread on the table."
      : null;
  const guidanceBannerText = guidanceOverrideText ?? contextBannerText;
  const guidanceHelperText = guidanceOverrideHelper ?? discardHelperText;
  const shouldShowGuidanceHelper = showGuidanceHelper && !!guidanceHelperText;
  const showBottomGuidanceBanner = !!guidanceBannerText && !isRoundEnd;
  const handFeedback =
    inlineFeedback?.area === "hand" || inlineFeedback?.area === "actions" ? inlineFeedback : null;
  const centerFeedback =
    inlineFeedback?.area === "center" ||
    inlineFeedback?.area === "discard" ||
    inlineFeedback?.area === "spreads"
      ? inlineFeedback
      : null;

  const ambientCenterStatusText =
    !isRoundEnd && (promoModeRequested || isSpectator) ? `${activeTurnPlayerName} is playing...` : null;
  const roundMomentHeadlineClass =
    roundOutcome.tone === "gold"
      ? "text-amber-100 drop-shadow-[0_0_18px_rgba(251,191,36,0.52)]"
      : roundOutcome.tone === "emerald"
        ? "text-emerald-100 drop-shadow-[0_0_18px_rgba(74,222,128,0.45)]"
        : roundOutcome.tone === "rose"
          ? "text-rose-100 drop-shadow-[0_0_18px_rgba(251,113,133,0.42)]"
          : "text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.28)]";
  const roundMomentDeltaClass =
    winnerRoundNet !== null && winnerRoundNet > 0
      ? "text-emerald-200 drop-shadow-[0_0_18px_rgba(74,222,128,0.42)]"
      : winnerRoundNet !== null && winnerRoundNet < 0
        ? "text-rose-200 drop-shadow-[0_0_18px_rgba(251,113,133,0.4)]"
        : roundOutcome.tone === "gold"
          ? "text-amber-100 drop-shadow-[0_0_18px_rgba(251,191,36,0.42)]"
          : "text-white";
  const roundMomentMeta = `${countdownLabel ? `${countdownLabel} | ` : ""}${roundRailStatusLabel}${
    roundStatusDetail ? ` | ${roundStatusDetail}` : ""
  }`;

  const deckIsAnimating = lastActionType === "drawCard" && lastActionPayload?.source === "deck";
  const discardIsAnimating =
    lastActionType === "discardCard" ||
    (lastActionType === "drawCard" && lastActionPayload?.source === "discard");
  const showActionDock = !isSpectator && !hideCardsForPresentation && !isRoundEnd;
  const topSeatPositionClass = isHeadsUpTable
    ? isPhoneLandscapeLayout
      ? "left-1/2 top-[6%] -translate-x-1/2"
      : "left-1/2 top-[5.5%] -translate-x-1/2"
    : isPhoneLandscapeLayout
      ? "left-1/2 top-[5.5%] -translate-x-1/2"
      : "left-1/2 top-[4.75%] -translate-x-1/2";
  const leftSeatPositionClass = isPhoneLandscapeLayout
    ? "left-[2.4%] top-[38%] -translate-y-1/2"
    : "left-[2.5%] top-[39%] -translate-y-1/2";
  const rightSeatPositionClass = isPhoneLandscapeLayout
    ? "right-[2.4%] top-[38%] -translate-y-1/2"
    : "right-[2.5%] top-[39%] -translate-y-1/2";
  const topSpreadPositionClass = isHeadsUpTable
    ? isPhoneLandscapeLayout
      ? "left-1/2 top-[20%] -translate-x-1/2 w-[34%] max-w-[280px]"
      : "left-1/2 top-[20%] -translate-x-1/2 w-[34%] max-w-[320px]"
    : isPhoneLandscapeLayout
      ? "left-1/2 top-[18%] -translate-x-1/2 w-[34%] max-w-[280px]"
      : "left-1/2 top-[18.5%] -translate-x-1/2 w-[34%] max-w-[340px]";
  const leftSpreadPositionClass = isPhoneLandscapeLayout
    ? "left-[10%] top-[30%] w-[24%] max-w-[208px]"
    : "left-[10.5%] top-[29%] w-[24%] max-w-[230px]";
  const rightSpreadPositionClass = isPhoneLandscapeLayout
    ? "right-[10%] top-[30%] w-[24%] max-w-[208px]"
    : "right-[10.5%] top-[29%] w-[24%] max-w-[230px]";
  const mySpreadPositionClass = isPhoneLandscapeLayout
    ? "left-1/2 bottom-[31%] -translate-x-1/2 w-[42%] max-w-[340px]"
    : "left-1/2 bottom-[29%] -translate-x-1/2 w-[42%] max-w-[460px]";
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
    DRAWING: "border-emerald-300/55 bg-emerald-400/16 text-emerald-50 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[2px]",
    "MUST DISCARD": "border-amber-300/60 bg-amber-400/18 text-amber-50 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[2px]",
    "HIT MODE": "border-fuchsia-300/60 bg-fuchsia-500/20 text-fuchsia-50 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[2px]",
    WAITING: "border-white/14 bg-black/18 text-white/82 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[2px]",
  };

  const renderOpponentHand = (count: number, size: "sm" | "md" = "sm") => {
    if (count <= 0) {
      return <div className="text-[10px] uppercase tracking-[0.2em] text-white/32">Empty</div>;
    }
    const cardClass =
      size === "md"
        ? isPhoneLandscapeLayout
          ? "h-[3.05rem] w-[2.15rem]"
          : "h-[3.95rem] w-[2.8rem]"
        : isPhoneLandscapeLayout
          ? "h-[2.8rem] w-[1.95rem]"
          : "h-[3.35rem] w-[2.35rem]";
    return (
      <div className="relative flex items-center justify-center">
        <CardComponent
          suit="Spades"
          rank="Ace"
          isHidden
          className={`${cardClass} relative z-[1]`}
        />
        <div className="absolute -bottom-1 -right-1 rounded-full border border-white/14 bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.4)] backdrop-blur-[2px]">
          {count}
        </div>
      </div>
    );
  };

  const renderSeatInfo = (
    player: typeof gameState.players[number] | null,
    className: string,
    align: "left" | "right" = "left",
    tiltClass = ""
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
        ? "border-emerald-300/30 bg-black/10 shadow-[0_0_18px_rgba(52,211,153,0.1)]"
        : "border-white/8 bg-black/8 opacity-72"
      : isActive
        ? "border-amber-300/34 bg-black/10 shadow-[0_0_18px_rgba(251,191,36,0.12)]"
        : "border-white/8 bg-black/8 opacity-72";

    return (
      <motion.div
        className={`absolute z-30 pointer-events-none ${className}`}
        initial={false}
        animate={
          isActive && !isRoundEnd
            ? { scale: [1, 1.018, 1], y: [0, -2, 0] }
            : { scale: 1, y: 0 }
        }
        transition={
          isActive && !isRoundEnd
            ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.25 }
        }
      >
        <div
          className={`${
            isActive ? "active-seat" : "inactive-seat"
          } relative flex items-center gap-2 transition-all duration-300 ${
            align === "right" ? "flex-row-reverse text-right" : ""
          } ${tiltClass}`}
        >
          {isActive && !isRoundEnd ? (
            <div className="absolute -inset-2 rounded-[24px] bg-amber-300/10 blur-xl" aria-hidden />
          ) : null}
          {shouldHighlightSeatWinner ? (
            <div className="absolute -inset-2 rounded-[26px] bg-emerald-300/12 blur-2xl" aria-hidden />
          ) : null}
          <div
            className={`relative rounded-[18px] border transition-all duration-300 ${
              isPhoneLandscapeLayout ? "min-w-[96px] px-1.5 py-1" : "min-w-[116px] px-2 py-1.5"
            } ${seatShellClass}`}
          >
            <div className={`relative flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
              <div className="relative flex-shrink-0">
                {isActive && !isRoundEnd ? (
                  <motion.div
                    className="absolute -inset-1.5 rounded-full border border-amber-200/65 shadow-[0_0_22px_rgba(251,191,36,0.35)]"
                    animate={{ scale: [1, 1.08, 1], opacity: [0.72, 1, 0.72] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden
                  />
                ) : null}
                {shouldHighlightSeatWinner ? (
                  <div
                    className="absolute -inset-1.5 rounded-full border border-emerald-200/55 shadow-[0_0_22px_rgba(74,222,128,0.28)]"
                    aria-hidden
                  />
                ) : null}
                <div
                  ref={(node) => setSeatAnchorRef(player.userId, node)}
                  className="relative rounded-full"
                >
                  <PlayerAvatar player={{ name: player.username, avatarUrl: player.avatarUrl }} size="sm" />
                </div>
                <TurnTimer
                  duration={turnDurationMs}
                  timeRemaining={isActive ? turnTimeRemainingMs : turnDurationMs}
                  isActive={isActive}
                    size={isPhoneLandscapeLayout ? 40 : 48}
                    strokeWidth={isPhoneLandscapeLayout ? 2.4 : 3}
                  className={isActive ? "animate-pulse" : ""}
                />
              </div>
              <div className="min-w-0">
                {isRoundEnd ? (
                  <div
                    className={`mb-1 inline-flex rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.18em] ${
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
                    className={`mb-1 inline-flex rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.18em] ${
                      isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                    } ${turnStatusClasses[turnStatus]}`}
                  >
                    {turnStatus}
                  </div>
                )}
                <div
                  className={`${
                    isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"
                  } truncate font-semibold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.48)]`}
                >
                  {player.username}
                </div>
                <div
                  className={`${
                    isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                  } leading-tight text-white/78 drop-shadow-[0_2px_8px_rgba(0,0,0,0.44)]`}
                >
                  {formatSeatBalance(seatBalance)}
                </div>
                <div
                  className={`${
                    isPhoneLandscapeLayout ? "text-[8px]" : "text-[8px]"
                  } mt-0.5 leading-tight uppercase tracking-[0.14em] text-white/62 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]`}
                >
                  {player.hitLockCounter > 0 && !isRoundEnd
                    ? `Drop Locked ${player.hitLockCounter}`
                    : `${getVisibleCardCount(player.userId, player.hand.length)} cards`}
                </div>
                {roundSeatResult ? (
                  <>
                    <div
                      className={`mt-1 ${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} font-semibold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] ${
                        shouldHighlightSeatWinner
                          ? "text-emerald-200"
                          : shouldDimSeatLoser
                            ? "text-rose-200"
                            : "text-white/75"
                      }`}
                    >
                      {roundSeatResult.deltaLabel}
                    </div>
                    <div className={`${isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"} leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${
                      shouldHighlightSeatWinner ? "text-emerald-100/92" : "text-white/58"
                    }`}>
                      {roundSeatResult.seatLabel}
                    </div>
                  </>
                ) : null}
              </div>
              <div className={`${align === "right" ? "order-first" : ""}`}>
                {renderOpponentHand(getVisibleCardCount(player.userId, player.hand.length), "sm")}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const displayedBottomPlayer = isSpectator ? viewerSeatPlayer : currentPlayer;
  const hand = sortHandCards(displayedBottomPlayer?.hand ?? []);
  const visibleHand =
    displayedBottomPlayer ? hand.slice(0, getVisibleCardCount(displayedBottomPlayer.userId, hand.length)) : [];
  const myTurnStatus = getTurnStatus(displayedBottomPlayer?.userId ?? user._id, true);
  const canUseFlickDiscard = !isSpectator && isTouchDevice && isDiscardReady;
  const isBottomSeatActive = isSpectator
    ? gameState.players[gameState.currentPlayerIndex]?.userId === displayedBottomPlayer?.userId
    : isMyTurn;
  const bottomSeatName = isSpectator
    ? displayedBottomPlayer?.username ?? "AI Player"
    : user.username;
  const bottomSeatAvatarUrl = isSpectator
    ? displayedBottomPlayer?.avatarUrl
    : user.avatarUrl;
  const bottomSeatBalance = isSpectator
    ? "TABLE AI"
    : balanceLoading
      ? "..."
      : formatSeatBalance(balance);
  const bottomSeatRoundResult = displayedBottomPlayer ? roundResultByUserId.get(displayedBottomPlayer.userId) : null;
  const shouldHighlightBottomWinner = !!bottomSeatRoundResult?.isWinner;
  const shouldDimBottomLoser = !!bottomSeatRoundResult && !bottomSeatRoundResult.isWinner;
  const bottomSeatShellClass = isRoundEnd
    ? shouldHighlightBottomWinner
      ? "border-emerald-300/35 bg-black/12 shadow-[0_0_20px_rgba(52,211,153,0.12)]"
      : "border-white/10 bg-black/10 opacity-78"
    : isBottomSeatActive
      ? "border-amber-300/42 bg-black/10 shadow-[0_0_20px_rgba(251,191,36,0.14)]"
      : "border-white/10 bg-black/8 opacity-85";
  const bottomSeatSideColumnClass = isPhoneLandscapeLayout ? "w-[138px]" : "w-[170px]";
  const phoneHandCardClass =
    visibleHand.length >= 6
      ? "w-[2.45rem] h-[3.55rem]"
      : visibleHand.length >= 5
        ? "w-[2.65rem] h-[3.85rem]"
        : visibleHand.length >= 4
        ? "w-[2.85rem] h-[4.1rem]"
        : "w-[3.05rem] h-[4.4rem]";
  const desktopHandCardClass =
    visibleHand.length >= 6
      ? "h-[5.15rem] w-[3.45rem] sm:h-[5.55rem] sm:w-[3.7rem]"
      : visibleHand.length >= 5
        ? "h-[5.3rem] w-[3.55rem] sm:h-[5.7rem] sm:w-[3.85rem]"
        : "h-[5.45rem] w-[3.65rem] sm:h-[5.9rem] sm:w-[3.95rem]";
  const handOverlapPx = isPhoneLandscapeLayout
    ? visibleHand.length >= 6
      ? 16
      : visibleHand.length >= 5
        ? 15
        : 13
    : visibleHand.length >= 6
      ? 22
      : visibleHand.length >= 5
        ? 19
        : 15;
  const handFanLiftStep = isPhoneLandscapeLayout ? 4.5 : 6.5;
  const handRotateStep = isPhoneLandscapeLayout ? 4 : 5;
  const handSelectedLiftPx = isPhoneLandscapeLayout ? 15 : 20;
  const handHoverLiftPx = isPhoneLandscapeLayout ? 11 : 15;
  const revealedSpreadGroups = isRoundEnd ? winnerPlayer?.spreads.map(sortSpreadCards) ?? [] : [];

  const renderSpreadZone = (
    player: typeof gameState.players[number] | null,
    zone: "top" | "left" | "right" | "bottom",
    className: string
  ) => {
    if (hideCardsForPresentation) return null;
    if (!player || player.spreads.length === 0) return null;
    const sortedSpreads = player.spreads.map(sortSpreadCards);
    const isWinningSeat = isRoundEnd && player.userId === winnerPlayer?.userId;
    if (isRoundEnd && isWinningSeat) return null;
    const isSideZone = zone === "left" || zone === "right";
    const spreadLayoutClass =
      sortedSpreads.length <= 1
        ? "flex justify-center"
        : isSideZone
          ? "grid grid-cols-1"
          : sortedSpreads.length === 2
            ? "grid grid-cols-2"
            : "grid grid-cols-2";
    return (
      <div className={`absolute z-20 pointer-events-none ${className}`}>
          <div
            className={`${spreadLayoutClass} items-start justify-center gap-2 ${isPhoneLandscapeLayout ? "min-h-[48px]" : "min-h-[58px]"}`}
          >
          {sortedSpreads.map((spread, sIdx) => (
            <motion.div
              key={`${player.userId}-spread-${sIdx}`}
              className={`relative flex min-h-[52px] items-end justify-center px-1 py-1 ${
                isHitMode
                  ? "pointer-events-auto cursor-pointer rounded-2xl ring-1 ring-amber-300/45 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
                  : "pointer-events-none"
              } ${
                feedbackPulseArea === "spreads" ? "rt-table-shake border-rose-300/45" : ""
              }`}
              onClick={() => isHitMode && executeHit(player.userId, sIdx)}
              initial={{ opacity: 0, y: zone === "bottom" ? 42 : -18, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: isHitMode ? 1.01 : 1 }}
              transition={{ type: "spring", stiffness: 270, damping: 20, delay: sIdx * 0.06 }}
            >
              {spread.map((card, cIdx) => (
                <motion.div
                  key={cIdx}
                  className="origin-bottom"
                  style={{
                    marginLeft: cIdx === 0 ? 0 : `-${isPhoneLandscapeLayout ? 14 : spread.length >= 5 ? 18 : 15}px`,
                    zIndex: cIdx + 1,
                  }}
                  initial={{
                    opacity: 0,
                    y: 20,
                    x: (cIdx - (spread.length - 1) / 2) * 8,
                    rotate: (cIdx - (spread.length - 1) / 2) * 6,
                    scale: 0.86,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    x: (cIdx - (spread.length - 1) / 2) * 2,
                    rotate: (cIdx - (spread.length - 1) / 2) * 3.5,
                    scale: 1,
                  }}
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
                    className={
                      isPhoneLandscapeLayout
                        ? spread.length >= 5
                          ? "h-[2.85rem] w-[2rem]"
                          : "h-[3.05rem] w-[2.2rem]"
                        : spread.length >= 5
                          ? "h-[4rem] w-[2.8rem] sm:h-[4.45rem] sm:w-[3.05rem]"
                          : "h-[4.35rem] w-[3rem] sm:h-[4.8rem] sm:w-[3.35rem]"
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          ))}
          </div>
      </div>
    );
  };

  const renderRevealLane = () => {
    if (revealedSpreadGroups.length === 0) return null;

    return (
      <div
        className={`flex w-full flex-wrap items-start justify-center ${
          revealedSpreadGroups.length > 1 ? "gap-3 sm:gap-5" : "gap-3"
        } ${isPhoneLandscapeLayout ? "max-w-[88%]" : "max-w-[72%]"}`}
      >
        {revealedSpreadGroups.map((spread, spreadIndex) => (
          <motion.div
            key={`reveal-lane-${spreadIndex}`}
            className="flex items-end justify-center px-2 py-1"
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: spreadIndex * 0.08 }}
          >
            {spread.map((card, cardIndex) => (
              <motion.div
                key={`${card.rank}-${card.suit}-${cardIndex}`}
                className="origin-bottom"
                style={{
                  marginLeft: cardIndex === 0 ? 0 : `-${isPhoneLandscapeLayout ? 14 : 18}px`,
                  zIndex: cardIndex + 1,
                }}
                initial={{
                  opacity: 0,
                  y: 16,
                  x: (cardIndex - (spread.length - 1) / 2) * 8,
                  rotate: (cardIndex - (spread.length - 1) / 2) * 4,
                  scale: 0.9,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  x: (cardIndex - (spread.length - 1) / 2) * 2,
                  rotate: (cardIndex - (spread.length - 1) / 2) * 3.5,
                  scale: 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.03 * cardIndex }}
              >
                <CardComponent
                  suit={card.suit}
                  rank={card.rank}
                  className={isPhoneLandscapeLayout ? "h-[3.05rem] w-[2.2rem]" : "h-[4.8rem] w-[3.35rem]"}
                />
              </motion.div>
            ))}
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden" style={{ height: "var(--app-height)" }}>
      <div className="absolute inset-0 z-0" aria-hidden>
        <div
          className={`absolute inset-0 transition-[filter,transform] duration-300 ${
            isMyTurn ? "blur-0 scale-[1.002]" : "blur-0 scale-100"
          }`}
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.1)), url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_58%,rgba(2,6,8,0.12)_100%)]" />
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
              ref={tableRef}
              className={`table relative ${
                isPhoneLandscapeLayout
                  ? "w-full h-full rounded-[18px] border-[8px]"
                  : "aspect-[16/9] rounded-[28px] border-[12px] w-[96vw]"
              } overflow-hidden border-[#3b2c12] shadow-[0_28px_54px_rgba(0,0,0,0.4)] ${isReem ? "rt-reem-burst border-yellow-300" : ""}`}
              style={isPhoneLandscapeLayout ? undefined : { maxWidth: `${tableMaxWidthPx}px` }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%,transparent_82%,rgba(0,0,0,0.08))]" />
              <div
                className={`absolute inset-0 transition-opacity duration-300 ${
                  isMyTurn
                    ? "opacity-100 bg-[radial-gradient(circle_at_50%_60%,rgba(255,245,204,0.045),transparent_42%,rgba(0,0,0,0.04)_100%)]"
                    : "opacity-0"
                }`}
              />
              <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                  isRoundEnd
                    ? "opacity-100 bg-[radial-gradient(circle_at_50%_46%,rgba(255,236,179,0.045),transparent_36%,rgba(0,0,0,0.04)_100%)]"
                    : "opacity-0"
                }`}
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_68%,rgba(0,0,0,0.12)_100%)]" />
              <div
                className={`absolute z-30 flex items-center justify-between ${
                  isPhoneLandscapeLayout ? "top-2 left-2 right-2 gap-1.5" : "top-3 left-3 right-3 gap-2"
                }`}
              >
                <div
                  className={`flex min-w-0 items-center rounded-full border border-white/10 bg-black/22 text-white ${
                    isPhoneLandscapeLayout ? "gap-1 px-2 py-1" : "gap-2 px-3 py-1.5"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="absolute -inset-1 rounded-full bg-amber-300/20 blur-lg" />
                    <img
                      src={logoSrc}
                      alt="ReemTeam logo"
                      className={`relative object-contain ${isPhoneLandscapeLayout ? "w-5 h-5" : "w-6 h-6"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`${isPhoneLandscapeLayout ? "text-[10px]" : "text-[11px]"} font-bold uppercase tracking-[0.22em] truncate`}
                      style={{ fontFamily: displayFont }}
                    >
                      ReemTeam
                    </div>
                    {!isPhoneLandscapeLayout ? (
                      <div className="text-[9px] text-white/52 uppercase tracking-[0.28em]">Digital Table</div>
                    ) : null}
                  </div>
                </div>
                <div className={`flex items-center ${isPhoneLandscapeLayout ? "gap-1" : "gap-2"}`}>
                  <div
                    className={`flex items-center rounded-full border border-white/10 bg-black/22 text-white ${
                      isPhoneLandscapeLayout ? "gap-1 px-2 py-1 text-[10px]" : "gap-2 px-3 py-1.5 text-[10px]"
                    }`}
                  >
                    {!isPhoneLandscapeLayout ? (
                      <span className="uppercase tracking-[0.24em] text-[9px] text-white/55">Players</span>
                    ) : null}
                    <span className="font-bold">
                      {isPhoneLandscapeLayout ? "P " : ""}
                      {gameState.players.length}/{maxPlayers}
                    </span>
                  </div>
                  <div
                    className={`flex items-center rounded-full border border-white/10 bg-black/22 text-white ${
                      isPhoneLandscapeLayout ? "gap-1 px-2 py-1 text-[10px]" : "gap-2 px-3 py-1.5 text-[10px]"
                    }`}
                  >
                    {!isPhoneLandscapeLayout ? (
                      <span className="uppercase tracking-[0.24em] text-[9px] text-white/55">Table Pot</span>
                    ) : null}
                    <span className="font-bold">{formatSeatBalance(gameState.pot)}</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenHowToPlay}
                    className={isPhoneLandscapeLayout ? "h-9 px-3 text-[11px]" : "h-9"}
                  >
                    Rules
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleLeaveTable}
                    className={isPhoneLandscapeLayout ? "h-9 px-3 text-[11px]" : "h-9"}
                  >
                    Leave
                  </Button>
                </div>
              </div>

              {renderSeatInfo(topPlayer, topSeatPositionClass, "left", isThreeHandedTable ? "-rotate-[3deg]" : "")}
              {renderSeatInfo(leftPlayer, leftSeatPositionClass, "left", "-rotate-[4deg]")}
              {renderSeatInfo(rightPlayer, rightSeatPositionClass, "right", isThreeHandedTable ? "rotate-[3deg]" : "rotate-[4deg]")}

              {renderSpreadZone(topPlayer, "top", topSpreadPositionClass)}
              {renderSpreadZone(leftPlayer, "left", leftSpreadPositionClass)}
              {renderSpreadZone(rightPlayer, "right", rightSpreadPositionClass)}
              {renderSpreadZone(currentPlayer ?? null, "bottom", mySpreadPositionClass)}

              <RtcParticleOverlay
                gameState={gameState}
                winnerPlayerId={winnerPlayer?.userId}
                winnerRoundNet={winnerRoundNet}
                tableRef={tableRef}
                seatAnchorRefs={seatAnchorRefs}
                displayFont={displayFont}
                isPhoneLandscapeLayout={isPhoneLandscapeLayout}
              />

              {showDealAnimation && (
                <div className="absolute inset-0 z-40 pointer-events-none">
                  {shufflePhase ? (
                    <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <motion.div
                          key={`shuffle-${idx}`}
                          className="absolute h-16 w-11 rounded-lg border border-white/20 shadow-xl"
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
                        className="h-16 w-11 rounded-lg border border-white/20 shadow-xl"
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
                          className="h-16 w-11 rounded-lg border border-white/20 shadow-xl"
                          style={{ backgroundImage: `url(${backCardImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
                          initial={{ rotate: -16, scale: 0.95, opacity: 0.9 }}
                          animate={{ rotate: 16, scale: 1.02, opacity: 1 }}
                          transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.35 }}
                        />
                      </div>
                      {Array.from({ length: totalCardsToDeal || 20 }).map((_, idx) => (
                        <motion.div
                          key={`deal-${idx}`}
                          className="absolute left-1/2 top-1/2 h-[3.35rem] w-[2.35rem] rounded-md border border-white/20"
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

              {ambientCenterStatusText ? (
                <div
                  className={`pointer-events-none absolute left-1/2 z-20 ${
                    isPhoneLandscapeLayout ? "top-[20%]" : "top-[22%]"
                  } -translate-x-1/2`}
                >
                  <div
                    className={`rounded-full border border-white/8 bg-black/10 px-3 py-1 text-center font-medium text-white/58 backdrop-blur-[2px] ${
                      isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"
                    }`}
                  >
                    {ambientCenterStatusText}
                  </div>
                </div>
              ) : null}

              {isRoundEnd ? (
                <div
                  className={`pointer-events-none absolute left-1/2 z-30 ${
                    isPhoneLandscapeLayout ? "top-[18%]" : "top-[19%]"
                  } -translate-x-1/2`}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: [0.96, 1.03, 1] }}
                    transition={{ duration: 0.46, ease: "easeOut" }}
                    className="relative flex flex-col items-center text-center"
                  >
                    <motion.div
                      className="absolute -inset-x-10 -inset-y-6 rounded-full bg-[radial-gradient(circle,rgba(255,221,87,0.18),rgba(255,221,87,0.04)_42%,transparent_72%)] blur-2xl"
                      animate={{ opacity: [0.55, 0.95, 0.55], scale: [0.98, 1.04, 0.98] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      aria-hidden
                    />
                    <div
                      className={`relative font-black uppercase leading-none tracking-[0.24em] text-amber-100 drop-shadow-[0_0_18px_rgba(251,191,36,0.55)] ${
                        isPhoneLandscapeLayout ? "text-[20px]" : "text-[30px]"
                      }`}
                      style={{ fontFamily: displayFont }}
                    >
                      ROUND OVER
                    </div>
                    <div
                      className={`relative mt-1 font-semibold uppercase tracking-[0.2em] ${
                        isPhoneLandscapeLayout ? "text-[9px]" : "text-[11px]"
                      } ${roundMomentHeadlineClass}`}
                    >
                      {roundOutcome.headline}
                    </div>
                    <motion.div
                      className={`relative mt-2 font-black leading-none ${
                        isPhoneLandscapeLayout ? "text-[16px]" : "text-[24px]"
                      } ${roundMomentDeltaClass}`}
                      animate={{ scale: [1, 1.04, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
                    >
                      {winnerLine}
                    </motion.div>
                    <div
                      className={`relative mt-1 font-medium text-white/72 ${
                        isPhoneLandscapeLayout ? "text-[8px]" : "text-[10px]"
                      }`}
                    >
                      {roundMomentMeta}
                    </div>
                  </motion.div>
                </div>
              ) : null}
              <div
                className={`absolute left-1/2 z-30 ${
                  isPhoneLandscapeLayout ? "top-[48%]" : "top-[49%]"
                } -translate-x-1/2 -translate-y-1/2`}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`flex items-center ${isPhoneLandscapeLayout ? "gap-2.5" : "gap-4"}`}>
                    <motion.button
                      type="button"
                      onClick={handleDeckClick}
                      animate={deckIsAnimating ? { y: [0, -6, 0], scale: [1, 1.05, 1], rotate: [0, -2, 0] } : undefined}
                      transition={deckIsAnimating ? { duration: 0.42 } : undefined}
                      className={`group relative transition-all ${
                        feedbackPulseArea === "center" ? "rt-table-shake border-rose-300/45" : ""
                      } ${deckPrimaryHighlightClass}`}
                      aria-label="Draw from deck"
                    >
                      <div className={`relative ${isPhoneLandscapeLayout ? "h-12 w-[2.2rem]" : "h-[3.95rem] w-[2.8rem]"}`}>
                        <div
                          className="absolute left-1 top-1 h-full w-full rounded-lg border border-white/10 opacity-65"
                          style={{
                            backgroundImage: `url(${backCardImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                        <div
                          className="absolute left-0.5 top-0.5 h-full w-full rounded-lg border border-white/15"
                          style={{
                            backgroundImage: `url(${backCardImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                        <div
                          className="relative h-full w-full rounded-lg border border-white/20 shadow-xl"
                          style={{
                            backgroundImage: `url(${backCardImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                      </div>
                      <div className="mt-1 text-center text-[9px] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
                        {gameState.deck.length}
                      </div>
                    </motion.button>

                    <motion.div
                      animate={
                        isRoundEnd
                          ? {
                              scale: [1, 1.06, 1],
                              boxShadow: [
                                "0 0 0 rgba(0,0,0,0)",
                                "0 0 34px rgba(251,191,36,0.3)",
                                "0 0 0 rgba(0,0,0,0)",
                              ],
                            }
                          : isMyTurn
                            ? { scale: [1, 1.02, 1] }
                            : undefined
                      }
                      transition={{ duration: isRoundEnd ? 1.2 : 2.6 }}
                      className="relative text-white"
                    >
                      <div className="relative flex flex-col items-center justify-center">
                        <img
                          src={logoSrc}
                          alt="ReemTeam logo"
                          className={isPhoneLandscapeLayout ? "h-7 w-7 object-contain" : "h-9 w-9 object-contain"}
                        />
                        <div className="mt-1 text-[7px] uppercase tracking-[0.26em] text-white/58 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                          ReemTeam
                        </div>
                      </div>
                    </motion.div>

                    <motion.button
                      type="button"
                      onClick={() => {
                        if (!hideCardsForPresentation) handleDiscardPileClick();
                      }}
                      animate={discardIsAnimating ? { y: [0, -4, 0], scale: [1, 1.04, 1], rotate: [0, 2, 0] } : undefined}
                      transition={discardIsAnimating ? { duration: 0.42 } : undefined}
                      className={`group relative transition-all ${
                        feedbackPulseArea === "discard" ? "rt-table-shake border-rose-300/45" : ""
                      } ${discardPrimaryHighlightClass}`}
                      aria-label="Discard pile"
                    >
                      <div className={`relative ${isPhoneLandscapeLayout ? "h-12 w-[2.2rem]" : "h-[3.95rem] w-[2.8rem]"}`}>
                        {!hideCardsForPresentation && gameState.discardPile.length > 0 ? (
                          <CardComponent
                            suit={gameState.discardPile[gameState.discardPile.length - 1].suit}
                            rank={gameState.discardPile[gameState.discardPile.length - 1].rank}
                            className={isPhoneLandscapeLayout ? "h-12 w-[2.2rem]" : "h-[3.95rem] w-[2.8rem]"}
                          />
                        ) : !hideCardsForPresentation ? (
                          <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-white/22 bg-black/25 text-[9px] uppercase tracking-[0.22em] text-white/42">
                            Empty
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-center text-[9px] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
                        {gameState.discardPile.length}
                      </div>
                    </motion.button>
                  </div>

                  {centerFeedback ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-full border border-white/10 bg-black/16 px-3 py-1 text-center text-[10px] font-semibold tracking-[0.12em] shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[2px] ${
                        centerFeedback.tone === "error"
                          ? "text-rose-200 drop-shadow-[0_0_10px_rgba(251,113,133,0.35)]"
                          : "text-sky-100 drop-shadow-[0_0_10px_rgba(125,211,252,0.26)]"
                      }`}
                    >
                      {centerFeedback.message}
                    </motion.div>
                  ) : null}
                </div>
              </div>

              {isRoundEnd ? (
                <div
                  className={`pointer-events-none absolute left-1/2 z-20 ${
                    isPhoneLandscapeLayout ? "top-[61%]" : "top-[58%]"
                  } -translate-x-1/2`}
                >
                  <div className="flex flex-col items-center gap-2">{renderRevealLane()}</div>
                </div>
              ) : null}

              <div
                className={`seat absolute left-1/2 z-40 -translate-x-1/2 pointer-events-auto ${
                  isPhoneLandscapeLayout
                    ? "bottom-0 h-[186px] w-[99%]"
                    : isCompactLandscape
                      ? "bottom-1 h-[212px] w-[96%] max-w-[930px]"
                      : "bottom-2 h-[226px] w-[96%] max-w-[960px]"
                }`}
              >
                <div className="relative h-full w-full">
                  <div className={`absolute left-0 bottom-0 z-20 flex items-end ${isPhoneLandscapeLayout ? "gap-2" : "gap-3"}`}>
                    <div className={`${bottomSeatSideColumnClass} flex-shrink-0`}>
                      <div
                        className={`${
                          isBottomSeatActive ? "active-seat" : "inactive-seat"
                        } relative w-full rounded-[22px] border transition-all duration-300 ${
                          isPhoneLandscapeLayout ? "mb-2 px-2 py-2" : "mb-3 px-2.5 py-2.5"
                        } ${bottomSeatShellClass}`}
                      >
                        {isBottomSeatActive && !isRoundEnd ? (
                          <div className="absolute -inset-2 rounded-[24px] bg-amber-300/10 blur-xl" aria-hidden />
                        ) : null}
                        {shouldHighlightBottomWinner ? (
                          <div className="absolute -inset-2 rounded-[26px] bg-emerald-300/12 blur-2xl" aria-hidden />
                        ) : null}
                        <div className={`relative flex items-center ${isPhoneLandscapeLayout ? "gap-2" : "gap-3"}`}>
                          <div className="relative flex-shrink-0">
                            {isBottomSeatActive && !isRoundEnd ? (
                              <motion.div
                                className="absolute -inset-1.5 rounded-full border border-amber-200/65 shadow-[0_0_24px_rgba(251,191,36,0.35)]"
                                animate={{ scale: [1, 1.08, 1], opacity: [0.72, 1, 0.72] }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                                aria-hidden
                              />
                            ) : null}
                            {shouldHighlightBottomWinner ? (
                              <div
                                className="absolute -inset-1.5 rounded-full border border-emerald-200/55 shadow-[0_0_24px_rgba(74,222,128,0.3)]"
                                aria-hidden
                              />
                            ) : null}
            <div
              ref={(node) => setSeatAnchorRef(displayedBottomPlayer?.userId ?? user._id, node)}
              className="relative rounded-full"
            >
              <PlayerAvatar player={{ name: bottomSeatName, avatarUrl: bottomSeatAvatarUrl }} size="sm" />
            </div>
                            <TurnTimer
                              duration={turnDurationMs}
                              timeRemaining={isBottomSeatActive ? turnTimeRemainingMs : turnDurationMs}
                              isActive={isBottomSeatActive}
                              size={isPhoneLandscapeLayout ? 42 : 54}
                              strokeWidth={isPhoneLandscapeLayout ? 2.6 : 3.5}
                              className={isBottomSeatActive ? "animate-pulse" : ""}
                            />
                          </div>
                          <div className="min-w-0">
                            {isRoundEnd ? (
                              <div
                                className={`mb-1 inline-flex rounded-full border px-2 py-0.5 font-semibold tracking-[0.2em] ${
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
                                className={`mb-1 inline-flex rounded-full border px-2 py-0.5 font-semibold tracking-[0.2em] ${
                                  isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                                } ${turnStatusClasses[myTurnStatus]}`}
                              >
                                {myTurnStatus}
                              </div>
                            )}
                            <div
                              className={`${
                                isPhoneLandscapeLayout ? "text-[10px]" : "text-[11px]"
                              } truncate font-semibold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.48)]`}
                            >
                              {bottomSeatName}
                            </div>
                            <div
                              className={`${
                                isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"
                              } leading-tight text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.44)]`}
                            >
                              {bottomSeatBalance}
                            </div>
                            <div
                              className={`${
                                isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                              } mt-0.5 leading-tight uppercase tracking-[0.14em] text-white/62 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]`}
                            >
                              {visibleHand.length} cards
                            </div>
                            {bottomSeatRoundResult ? (
                              <>
                                <div
                                  className={`mt-1 ${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} font-semibold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] ${
                                    shouldHighlightBottomWinner
                                      ? "text-emerald-200"
                                      : shouldDimBottomLoser
                                        ? "text-rose-200"
                                        : "text-white/75"
                                  }`}
                                >
                                  {bottomSeatRoundResult.deltaLabel}
                                </div>
                                <div className={`${isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"} leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${
                                  shouldHighlightBottomWinner ? "text-emerald-100/92" : "text-white/58"
                                }`}>
                                  {bottomSeatRoundResult.seatLabel}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    {showActionDock || (isRoundEnd && isContinuousMode && !isSpectator) ? (
                      <div
                        className={`pointer-events-auto flex flex-col ${
                          isPhoneLandscapeLayout ? "w-[96px] gap-2 pb-2" : "w-[118px] gap-2.5 pb-3"
                        }`}
                      >
                        {showActionDock ? (
                          <div className="rounded-[22px] border border-white/12 bg-black/16 p-1.5 shadow-[0_14px_28px_rgba(0,0,0,0.22)] backdrop-blur-[2px]">
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
                        ) : null}
                        {isRoundEnd && isContinuousMode && !isSpectator ? (
                          <Button
                            onClick={handlePutIn}
                            variant="primary"
                            size="sm"
                            disabled={isReadyForNextRound}
                            className={`w-full ${isPhoneLandscapeLayout ? "h-10 px-2 text-[10px]" : "h-11 px-3 text-[11px]"}`}
                          >
                            {isReadyForNextRound ? "Ready For Next Hand" : "Run It Back"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="absolute left-1/2 z-10 -translate-x-1/2"
                    style={{
                      bottom: isPhoneLandscapeLayout ? "2px" : "4px",
                      width: isPhoneLandscapeLayout ? "min(100%, 420px)" : "min(100%, 560px)",
                    }}
                  >
                    <div className="flex w-full flex-col items-center">
                      <div className="pointer-events-none select-none px-2 text-center">
                        {showBottomGuidanceBanner ? (
                          <div
                            className={`inline-flex items-center rounded-full border border-white/10 bg-black/16 px-3 py-1 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[2px] ${
                              isPhoneLandscapeLayout ? "text-[10px]" : "text-[12px]"
                            } font-semibold ${
                              isRoundEnd
                                ? "text-white"
                                : handFeedback?.tone === "error"
                                  ? "text-rose-200 drop-shadow-[0_0_10px_rgba(251,113,133,0.28)]"
                                  : isDiscardStep
                                    ? "text-amber-50 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                                    : isMyTurn
                                      ? "text-sky-50 drop-shadow-[0_0_10px_rgba(125,211,252,0.24)]"
                                      : "text-white/88"
                            }`}
                          >
                            {guidanceBannerText}
                          </div>
                        ) : null}
                        {(isRoundEnd || shouldShowGuidanceHelper) && (
                          <div
                            className={`${showBottomGuidanceBanner ? "mt-1" : ""} inline-flex items-center rounded-full border border-white/8 bg-black/14 px-3 py-0.5 shadow-[0_8px_20px_rgba(0,0,0,0.14)] backdrop-blur-[2px] ${
                              isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                            } ${
                              handFeedback?.tone === "error" || selectedIllegalDiscardCard
                                ? "text-rose-200/90"
                                : "text-white/82"
                            }`}
                          >
                            {isRoundEnd
                              ? roundMomentMeta
                              : `${guidanceHelperText ?? ""}${canUseFlickDiscard && !isPhoneLandscapeLayout ? " Or flick upward." : ""}`}
                          </div>
                        )}
                      </div>
                      <div
                        className={`hand relative w-full pointer-events-auto ${feedbackPulseArea === "hand" ? "rt-table-shake" : ""} ${
                          isPhoneLandscapeLayout ? "mt-1 h-[108px]" : "mt-1 h-[132px]"
                        }`}
                      >
                        <div
                          className={`pointer-events-none absolute inset-x-8 top-6 h-12 rounded-full blur-2xl ${
                            isRoundEnd
                              ? "bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_72%)]"
                              : isDiscardStep
                                ? "bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_72%)]"
                                : isMyTurn
                                  ? "bg-[radial-gradient(circle,rgba(125,211,252,0.14),transparent_72%)]"
                                  : "bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_72%)]"
                          }`}
                        />
                        <AnimatePresence>
                          <div className={`flex flex-nowrap items-end justify-center overflow-visible ${isPhoneLandscapeLayout ? "px-1 pt-4" : "px-1 pt-5"}`}>
                            {visibleHand.map((card, cardIndex) => {
                              const isSelectedCard = selectedCards.some(
                                (c) => c.rank === card.rank && c.suit === card.suit
                              );
                              const isIllegalDiscardSelection =
                                isSelectedCard && isDiscardStep && isRestrictedDiscardCard(card);
                              const enableFlickDrag =
                                canUseFlickDiscard && isSelectedCard && !isIllegalDiscardSelection;
                              const centerOffset = cardIndex - (visibleHand.length - 1) / 2;
                              const fanLift = Math.abs(centerOffset) * handFanLiftStep;
                              const baseRotate = centerOffset * handRotateStep;

                              return (
                                <motion.div
                                  key={`${card.rank}-${card.suit}`}
                                  className="card origin-bottom"
                                  style={{
                                    marginLeft: cardIndex === 0 ? 0 : `-${handOverlapPx}px`,
                                    zIndex: isSelectedCard ? 60 + cardIndex : cardIndex + 1,
                                  }}
                                  initial={{ y: 36, opacity: 0, rotate: 0 }}
                                  animate={{
                                    y: isSelectedCard ? -(fanLift + handSelectedLiftPx) : -fanLift,
                                    rotate: isSelectedCard ? baseRotate * 0.6 : baseRotate,
                                    scale: isSelectedCard ? 1.06 : 1,
                                    opacity: 1,
                                  }}
                                  exit={{ y: -20, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                                  whileHover={
                                    isMyTurn
                                      ? { y: -(fanLift + handHoverLiftPx), scale: 1.04 }
                                      : undefined
                                  }
                                  whileTap={isMyTurn ? { scale: 0.98 } : undefined}
                                >
                                  <CardComponent
                                    suit={card.suit}
                                    rank={card.rank}
                                    isSelected={isSelectedCard}
                                    onClick={isSpectator ? undefined : () => toggleCardSelection(card)}
                                    className={isPhoneLandscapeLayout ? phoneHandCardClass : desktopHandCardClass}
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
