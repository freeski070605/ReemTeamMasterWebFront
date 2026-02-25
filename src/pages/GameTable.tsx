import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { Loader } from "../components/ui/Loader";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { Card as CardType } from "../types/game";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { toast } from "react-toastify";

import { PlayingCard as CardComponent } from "../components/ui/Card";
import PlayerAvatar from "../components/game/PlayerAvatar";
import TurnTimer from "../components/game/TurnTimer";
import GameActions from "../components/game/GameActions";
import { Button } from "../components/ui/Button";
import bgImage from '../assets/bg.png';
import backCardImage from "../assets/cards/back.png";

type TurnStatusBadge = "DRAWING" | "MUST DISCARD" | "HIT MODE" | "WAITING";

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
  const [useLargeScreenTableSizing, setUseLargeScreenTableSizing] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showTurnCompleteFeedback, setShowTurnCompleteFeedback] = useState(false);
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
    error: balanceError,
    refresh: refreshBalance,
  } = useWalletBalance({ refreshIntervalMs: 15000, currency: walletCurrency });
  const contestId = searchParams.get("contestId") ?? undefined;

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

  useEffect(() => {
    if (tableId && user) {
      connect(tableId, user._id, user.username, user.avatarUrl, contestId);
    }

    const handlePlayerLeft = ({ userId: leftPlayerId }: { userId: string }) => {
      if (leftPlayerId === user?._id) {
        toast.info("You have left the table.");
        navigate("/tables");
      }
    };

    useGameStore.getState().socket?.on('playerLeft', handlePlayerLeft);

    return () => {
      useGameStore.getState().socket?.off('playerLeft', handlePlayerLeft);
      disconnect();
    };
  }, [tableId, user, connect, disconnect, navigate, contestId]);

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
      const maxByViewport = window.innerWidth * 0.96;
      const maxByHeight = window.innerHeight * 0.92 * (16 / 9);
      const maxByTV = 1800;
      setTableMaxWidthPx(Math.floor(Math.min(maxByViewport, maxByHeight, maxByTV)));
      setUseLargeScreenTableSizing(window.innerWidth > 1024);
    };

    updateTableMaxWidth();
    window.addEventListener("resize", updateTableMaxWidth);
    return () => {
      window.removeEventListener("resize", updateTableMaxWidth);
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
  const isMyTurn = !!(
    gameState &&
    user &&
    gameState.players[gameState.currentPlayerIndex]?.userId === user._id
  );
  const hasCurrentPlayer = !!currentPlayer;
  const hasTakenActionThisTurn = !!currentPlayer?.hasTakenActionThisTurn;

  useEffect(() => {
    if (!gameState || hasInitializedLastActionRef.current) return;
    hasInitializedLastActionRef.current = true;
    lastObservedActionTimestampRef.current = gameState.lastAction?.timestamp ?? null;
  }, [gameState]);

  useEffect(() => {
    if (!hasInitializedLastActionRef.current) return;
    const action = gameState?.lastAction;
    const actionTimestamp = action?.timestamp ?? null;

    if (actionTimestamp === null || actionTimestamp === lastObservedActionTimestampRef.current) {
      return;
    }

    lastObservedActionTimestampRef.current = actionTimestamp;

    if (action?.type === "discardCard" && action.payload?.userId === user?._id) {
      setShowTurnCompleteFeedback(true);
      const timeoutId = window.setTimeout(() => {
        setShowTurnCompleteFeedback(false);
      }, 1600);
      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [gameState?.lastAction, user?._id]);

  useEffect(() => {
    if (!isMyTurn || !hasCurrentPlayer) {
      setSelectedCards([]);
      setIsHitMode(false);
      return;
    }

    if (!hasTakenActionThisTurn) {
      setSelectedCards([]);
      setIsHitMode(false);
    }
  }, [isMyTurn, hasCurrentPlayer, hasTakenActionThisTurn, gameState?.turn]);

  const currentTurnStep: "waiting" | "draw" | "discard" = !isMyTurn
    ? "waiting"
    : hasTakenActionThisTurn
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
      toast.error("Select exactly one card to discard.");
      triggerGuidance({
        bannerText: "Select exactly 1 card to discard",
        helperText: "Then tap Discard.",
      });
      return false;
    }

    if (isRestrictedDiscardCard(selectedCards[0])) {
      toast.error("Cannot discard this card this turn.");
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

    if (currentPlayer?.hasTakenActionThisTurn) {
      triggerGuidance({
        bannerText: "Step 2/2: Discard",
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

    if (!currentPlayer?.hasTakenActionThisTurn) {
      if (gameState.discardPile.length === 0) {
        toast.error("Discard pile is empty!");
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
    const isDiscardStep = isMyTurn && !!currentPlayer?.hasTakenActionThisTurn;
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
      toast.error("A spread must have at least 3 cards.");
      triggerGuidance({
        bannerText: "Need 3+ cards selected",
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
      toast.error("Select one card to hit with.");
      triggerGuidance({
        bannerText: "Select exactly 1 card for Hit",
      });
      return;
    }
    setIsHitMode(true);
    toast.info("Select a spread to hit.");
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

  const handleLeaveTable = () => {
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

  const localIndex = gameState.players.findIndex((p) => p.userId === user._id);
  const totalPlayers = gameState.players.length;
  const seatAt = (offset: number) => {
    if (offset >= totalPlayers) return null;
    const idx = (localIndex + offset) % totalPlayers;
    return gameState.players[idx] ?? null;
  };

  const topPlayer = seatAt(1);
  const rightPlayer = seatAt(2);
  const leftPlayer = seatAt(3);
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
  const formatBalance = (amount: number | null) => {
    if (walletCurrency === "usd") {
      if (amount === null) return "$0.00";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    }

    if (amount === null) return "0 Reem Team Cash";
    return `${Math.max(0, Math.floor(amount)).toLocaleString("en-US")} Reem Team Cash`;
  };
  const roundReasonLabel =
    gameState.roundEndedBy === "REGULAR"
      ? "Drop / Hand Empty"
      : gameState.roundEndedBy === "REEM"
        ? "Reem"
        : gameState.roundEndedBy === "AUTO_TRIPLE"
          ? "Automatic Win (41/<=11)"
          : gameState.roundEndedBy === "DECK_EMPTY"
            ? "Deck Empty"
            : gameState.roundEndedBy === "CAUGHT_DROP"
              ? "Caught Drop"
              : "Round End";
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
  const settlementLabel =
    gameState.roundSettlementStatus === "settled"
      ? "Settled - player W/L shown below"
      : gameState.roundSettlementStatus === "failed"
        ? "Settlement Failed"
        : "Settlement Pending";
  const getRoundNetForPlayer = (playerId: string): number | null => {
    const payout = gameState.payouts?.[playerId];
    if (payout === undefined) return null;

    // In FREE_RTC_TABLE, payout for winners is gross (includes their ante); show net W/L.
    if (!gameState.mode || gameState.mode === "FREE_RTC_TABLE") {
      const ante = gameState.lockedAntes?.[playerId] ?? gameState.baseStake;
      if (playerId === gameState.roundWinnerId) {
        return payout - ante;
      }
    }

    return payout;
  };
  const formatRoundDelta = (amount: number | null) => {
    if (amount === null) return "--";
    if (walletCurrency === "usd") {
      const absoluteFormatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(amount));
      const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
      return `${sign}${absoluteFormatted}`;
    }
    const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
    return `${sign}${Math.abs(Math.trunc(amount)).toLocaleString("en-US")} RTC`;
  };
  const formatPlacementWinType = (winType?: string) => {
    if (!winType || winType === "LOSS") return "Loss";
    if (winType === "AUTO_TRIPLE") return "Auto Triple";
    if (winType === "CAUGHT_DROP") return "Caught Drop";
    if (winType === "DECK_EMPTY") return "Deck Empty";
    if (winType === "REEM") return "Reem";
    return "Regular";
  };

  const activeTurnPlayer = gameState.players[gameState.currentPlayerIndex] ?? null;
  const activeTurnPlayerName = activeTurnPlayer?.username ?? "Player";
  const isDrawStep = isMyTurn && !currentPlayer?.hasTakenActionThisTurn;
  const isDiscardStep = isMyTurn && !!currentPlayer?.hasTakenActionThisTurn;
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

  const turnStepChipText = isMyTurn
    ? `Your Turn - ${isDiscardStep ? "Step 2/2: Discard" : "Step 1/2: Draw"}`
    : `${activeTurnPlayerName}'s Turn - ${
        activeTurnPlayer?.hasTakenActionThisTurn ? "Step 2/2: Discard" : "Step 1/2: Draw"
      }`;

  const contextBannerText = isMyTurn
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

  const canDrop = !!(
    isMyTurn &&
    !currentPlayer?.hasTakenActionThisTurn &&
    !currentPlayer?.isHitLocked
  );
  const dropDisabledReason = !isMyTurn
    ? "Wait for your turn"
    : currentPlayer?.hasTakenActionThisTurn
      ? "Drop blocked: already took an action"
      : currentPlayer?.isHitLocked
        ? "Drop blocked: hit-locked."
        : undefined;

  const canSpread = !!(
    isMyTurn &&
    currentPlayer?.hasTakenActionThisTurn &&
    selectedCards.length >= 3
  );
  const spreadDisabledReason = !isMyTurn
    ? "Wait for your turn"
    : !currentPlayer?.hasTakenActionThisTurn
      ? "Draw first"
      : selectedCards.length >= 3
        ? undefined
        : "Need 3+ cards selected";

  const canHit = !!(
    isMyTurn &&
    currentPlayer?.hasTakenActionThisTurn &&
    selectedCards.length === 1
  );
  const hitDisabledReason = !isMyTurn
    ? "Wait for your turn"
    : !currentPlayer?.hasTakenActionThisTurn
      ? "Draw first"
      : selectedCards.length === 1
        ? undefined
        : "Select exactly 1 card";

  const getTurnStatus = (playerUserId: string, isSelfPanel = false): TurnStatusBadge => {
    if (!activeTurnPlayer || activeTurnPlayer.userId !== playerUserId) {
      return "WAITING";
    }
    if (isSelfPanel && isHitMode) {
      return "HIT MODE";
    }
    return activeTurnPlayer.hasTakenActionThisTurn ? "MUST DISCARD" : "DRAWING";
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
    const cardClass = size === "md" ? "w-10 h-14" : "w-8 h-12";
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
    return (
      <div className={`absolute z-20 pointer-events-none ${className}`}>
        <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
          {renderOpponentHand(getVisibleCardCount(player.userId, player.hand.length), "sm")}
          <div className={`px-2 py-1 rounded-lg border ${isActive ? "border-yellow-400/80 bg-yellow-400/10" : "border-white/10 bg-black/35"} min-w-[110px]`}>
            <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
              <PlayerAvatar player={{ name: player.username, avatarUrl: player.avatarUrl }} size="sm" />
              <div>
                <div className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${turnStatusClasses[turnStatus]}`}>
                  {turnStatus}
                </div>
                <div className="text-[11px] text-white font-semibold leading-tight">{player.username}</div>
                <div className="text-[10px] text-white/60 leading-tight">
                  Cards: {getVisibleCardCount(player.userId, player.hand.length)}
                </div>
                <div className="text-[10px] text-yellow-300 leading-tight">
                  {playerBalances[player.userId] !== undefined ? formatBalance(playerBalances[player.userId]) : "--"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hand = currentPlayer?.hand ?? [];
  const visibleHand =
    currentPlayer ? hand.slice(0, getVisibleCardCount(currentPlayer.userId, hand.length)) : [];
  const myTurnStatus = getTurnStatus(user._id, true);
  const canUseFlickDiscard = isTouchDevice && isDiscardReady;

  const renderSpreadZone = (
    player: typeof gameState.players[number] | null,
    _label: string,
    className: string
  ) => {
    if (hideCardsForPresentation) return null;
    if (!player || player.spreads.length === 0) return null;

    return (
      <div className={`absolute z-10 pointer-events-none ${className}`}>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {player.spreads.map((spread, sIdx) => (
            <div
              key={`${player.userId}-spread-${sIdx}`}
              className={`flex -space-x-5 ${isHitMode ? "cursor-pointer pointer-events-auto ring-2 ring-yellow-400 rounded-lg p-1 bg-yellow-400/10" : "pointer-events-none"}`}
              onClick={() => isHitMode && executeHit(player.userId, sIdx)}
            >
              {spread.map((card, cIdx) => (
                <CardComponent
                  key={cIdx}
                  suit={card.suit}
                  rank={card.rank}
                  className="w-7 h-10 sm:w-8 sm:h-12 text-[9px]"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.5)), url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,199,74,0.22),transparent_55%)]" />
      </div>

      <div className="relative z-10 h-full flex flex-col">
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

        <div className={`game-wrapper flex-1 relative overflow-hidden touch-manipulation pb-6 ${isMobilePortrait ? "pointer-events-none" : ""}`}>
          <div className="table-area relative w-full h-full flex items-center justify-center">
            <div
              className={`table relative aspect-[16/9] rounded-[28px] border-[12px] shadow-2xl overflow-hidden bg-black/20 ${useLargeScreenTableSizing ? "w-full" : "w-[96vw] max-w-[860px]"} ${isReem ? 'border-yellow-400 animate-pulse' : 'border-[#3b2c12]'}`}
              style={useLargeScreenTableSizing ? { maxWidth: `${tableMaxWidthPx}px` } : undefined}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.06),transparent_60%)]" />
              <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 bg-black/50 text-white rounded-full border border-white/10 px-2 py-1 backdrop-blur-sm min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="absolute -inset-1 rounded-full bg-yellow-400/20 blur-lg" />
                    <img src={logoSrc} alt="ReemTeam logo" className="relative w-6 h-6 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold tracking-wide truncate" style={{ fontFamily: displayFont }}>
                      ReemTeam
                    </div>
                    <div className="text-[9px] text-white/60 uppercase tracking-[0.3em]">Tonk Arena</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                    <span className="uppercase tracking-widest text-[9px] text-white/60">Players</span>
                    <span className="font-bold">{gameState.players.length}/{maxPlayers}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                    <span className="uppercase tracking-widest text-[9px] text-white/60">
                      {walletCurrency === "usd" ? "USD Balance" : "Reem Team Cash Balance"}
                    </span>
                    <span className="font-bold">
                      {balanceLoading ? "..." : balanceError ? "Error" : formatBalance(balance)}
                    </span>
                  </div>
                  <Button variant="danger" size="sm" onClick={handleLeaveTable}>Leave</Button>
                </div>
              </div>

              <div className="absolute left-1/2 top-[18%] z-30 -translate-x-1/2 pointer-events-none">
                <div className="rounded-xl border border-cyan-200/60 bg-black/75 px-4 py-2 text-center shadow-[0_0_30px_rgba(34,211,238,0.25)] backdrop-blur-sm">
                  <div className="text-[12px] font-semibold text-cyan-100">{turnStepChipText}</div>
                  {isMyTurn ? (
                    <div className="mt-0.5 text-[10px] font-medium text-cyan-200/90">
                      {isDiscardStep ? "Tap the glowing discard pile to finish." : "Tap a glowing pile to draw."}
                    </div>
                  ) : null}
                </div>
              </div>

              {renderSeatInfo(topPlayer, "top-2 left-[58%] -translate-x-1/2", "left")}
              {renderSeatInfo(leftPlayer, "left-[1.5%] top-1/2 -translate-y-1/2", "left")}
              {renderSeatInfo(rightPlayer, "right-[1.5%] top-1/2 -translate-y-1/2", "right")}

              {renderSpreadZone(topPlayer, "Top Spread", "left-1/2 top-[28%] -translate-x-1/2 w-[34%] max-w-[300px]")}
              {renderSpreadZone(leftPlayer, "Left Spread", "left-[18%] top-[36%] -translate-y-1/2 w-[23%] max-w-[210px]")}
              {renderSpreadZone(rightPlayer, "Right Spread", "right-[18%] top-[36%] -translate-y-1/2 w-[23%] max-w-[210px]")}
              {renderSpreadZone(currentPlayer ?? null, "Your Spread", "left-1/2 bottom-[33%] -translate-x-1/2 w-[30%] max-w-[260px]")}

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

              <div className="center-pile absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
                <div className="flex items-center gap-4">
                  <div className="relative w-8 h-12 sm:w-10 sm:h-14">
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
                    className="relative w-8 h-12 sm:w-10 sm:h-14"
                    onClick={() => {
                      if (!hideCardsForPresentation) handleDiscardPileClick();
                    }}
                  >
                    {!hideCardsForPresentation && gameState.discardPile.length > 0 ? (
                      <div className={`relative transition-all ${discardPrimaryHighlightClass}`}>
                        <CardComponent
                          suit={gameState.discardPile[gameState.discardPile.length - 1].suit}
                          rank={gameState.discardPile[gameState.discardPile.length - 1].rank}
                          className="w-8 h-12 sm:w-10 sm:h-14"
                        />
                      </div>
                    ) : !hideCardsForPresentation ? (
                      <div className={`w-full h-full border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/40 relative ${discardPrimaryHighlightClass}`}>
                        Discard
                      </div>
                    ) : null}
                  </div>
                </div>
                <TurnTimer timeLeft={15} maxTime={30} />
              </div>

              <div className="seat absolute w-[96%] max-w-[820px] h-[164px] bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto">
                <div className="flex items-end gap-2 w-full h-full">
                  <div className={`mb-6 px-2 py-2 rounded-lg border ${isMyTurn ? "border-yellow-400/80 bg-yellow-400/10" : "border-white/10 bg-black/30"} min-w-[132px]`}>
                    <div className="flex items-center gap-2">
                      <PlayerAvatar player={{ name: user.username, avatarUrl: user.avatarUrl }} size="sm" />
                      <div>
                        <div className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${turnStatusClasses[myTurnStatus]}`}>
                          {myTurnStatus}
                        </div>
                        <div className="text-[11px] text-white font-semibold leading-tight">{user.username}</div>
                        <div className="text-[10px] text-white/60 leading-tight">Cards: {visibleHand.length}</div>
                        <div className="text-[10px] text-yellow-300 leading-tight">
                          {balanceLoading ? "..." : formatBalance(balance)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center">
                    {shouldShowGuidanceBanner ? (
                      <div className="mb-1 w-full max-w-[520px] rounded-lg border border-sky-300/30 bg-black/45 px-3 py-1.5 text-center text-[11px] font-medium text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.18)] pointer-events-none select-none">
                        {guidanceBannerText}
                      </div>
                    ) : null}
                    {shouldShowGuidanceHelper ? (
                      <div
                        className={`mb-1 text-[10px] font-semibold pointer-events-none select-none ${
                          selectedIllegalDiscardCard ? "text-rose-300" : "text-emerald-200"
                        }`}
                      >
                        {guidanceHelperText}
                        {canUseFlickDiscard ? " Or flick selected card toward discard pile." : ""}
                      </div>
                    ) : null}
                    {showTurnCompleteFeedback ? (
                      <div className="mb-1 rounded-full border border-emerald-300/60 bg-emerald-500/18 px-3 py-0.5 text-[10px] font-semibold text-emerald-100 pointer-events-none select-none">
                        Turn complete - next player
                      </div>
                    ) : null}

                    <div className="hand relative h-24 w-full max-w-[700px] pointer-events-auto">
                      <AnimatePresence>
                        <div className="flex flex-nowrap items-end justify-center gap-1 sm:gap-1.5">
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
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                              >
                                <CardComponent
                                  suit={card.suit}
                                  rank={card.rank}
                                  isSelected={isSelectedCard}
                                  onClick={() => toggleCardSelection(card)}
                                  className="w-10 h-14 sm:w-11 sm:h-16"
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

                    {isMyTurn && !hideCardsForPresentation && (
                      <div className="actions flex gap-1.5 mt-1 pointer-events-auto [&_button]:min-w-[64px] [&_button]:h-8 [&_button]:text-xs">
                        <GameActions
                          drop={{
                            enabled: canDrop,
                            reason: canDrop ? undefined : dropDisabledReason,
                          }}
                          spread={{
                            enabled: canSpread,
                            reason: canSpread ? undefined : spreadDisabledReason,
                          }}
                          hit={{
                            enabled: canHit,
                            reason: canHit ? undefined : hitDisabledReason,
                          }}
                          onDrop={handleDrop}
                          onSpread={handleSpread}
                          onHit={handleHitClick}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {gameState.status === 'round-end' && (
          <div className="absolute right-3 top-3 z-40 w-[min(46vw,420px)] rounded-xl border border-yellow-500/40 bg-black/70 backdrop-blur-md p-3 pointer-events-auto">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-white/60">Round Over</div>
                <div className="text-sm font-semibold text-white">{roundReasonLabel}</div>
              </div>
              <Button onClick={isContinuousMode ? handleRequestLeaveTable : handleLeaveTable} variant="danger" size="sm">
                Leave
              </Button>
            </div>
            {isContinuousMode && (
              <div className="mt-1 text-[11px] text-yellow-300">
                Next round starts in {roundCountdownSeconds ?? 30}s
              </div>
            )}
            {isContinuousMode && (
              <div className="mt-1 text-[11px] text-white/70">
                Ready: {readyCount}/{totalRoundPlayers}
              </div>
            )}
            <div className="mt-1 text-[11px] text-white/70">
              {settlementLabel}
            </div>
            {isContinuousMode && (
              <div className="mt-2">
                <Button onClick={handlePutIn} variant="primary" size="sm" disabled={isReadyForNextRound}>
                  {isReadyForNextRound ? "Put In: Ready" : "Put In"}
                </Button>
              </div>
            )}
            <div className="mt-2 text-sm text-green-400 font-bold">
              Winner: {winnerPlayer?.username || "Unknown"}
            </div>
            {gameState.handScores && (
              <div className="mt-2 max-h-[42vh] overflow-auto rounded-lg border border-white/10 bg-black/35">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-white/50 grid grid-cols-[1.25fr_0.4fr_0.75fr_0.55fr_0.7fr] gap-2">
                  <span>Player</span>
                  <span>Rank</span>
                  <span>Result</span>
                  <span>Score</span>
                  <span>W/L</span>
                </div>
                <div className="divide-y divide-white/10">
                  {rankedRoundPlayers.map((player) => {
                    const placement = placementByUserId.get(player.userId);
                    const isWinner = placement?.rank === 1 || player.userId === gameState.roundWinnerId;
                    const roundNet = getRoundNetForPlayer(player.userId);
                    return (
                    <div
                      key={player.userId}
                      className={`px-2 py-1.5 grid grid-cols-[1.25fr_0.4fr_0.75fr_0.55fr_0.7fr] gap-2 items-center text-xs ${isWinner ? "bg-green-500/10" : ""}`}
                    >
                      <div className="truncate text-white">{player.username}</div>
                      <div className="font-mono text-white/80">{placement?.rank ?? "-"}</div>
                      <div className={`${isWinner ? "text-green-300" : "text-white/70"}`}>
                        {formatPlacementWinType(placement?.winType)}
                      </div>
                      <div className="font-mono text-white/80">{gameState.handScores?.[player.userId] ?? "-"}</div>
                      <div
                        className={`font-mono ${
                          roundNet === null
                            ? "text-white/40"
                            : roundNet > 0
                              ? "text-emerald-300"
                              : roundNet < 0
                                ? "text-rose-300"
                                : "text-white/80"
                        }`}
                      >
                        {formatRoundDelta(roundNet)}
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            )}
            <div className="mt-2 text-[11px] text-white/60">Cards stay visible until the next clockwise deal starts.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameTable;
