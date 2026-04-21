import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { Loader } from "../components/ui/Loader";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { Card as CardType } from "../types/game";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { toast } from "react-toastify";
import { ANALYTICS_EVENTS } from "../analytics/events";
import { trackEvent } from "../api/analytics";
import { createInvite } from "../api/invites";

import { PlayingCard as CardComponent } from "../components/ui/Card";
import PlayerAvatar from "../components/game/PlayerAvatar";
import TurnTimer from "../components/game/TurnTimer";
import GameActions from "../components/game/GameActions";
import RtcParticleOverlay from "../components/game/RtcParticleOverlay";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { experienceFlags } from "../config/experienceFlags";
import { buildTableMomentFromLastAction, TableMoment } from "../utils/gameMoments";
import {
  formatRoundDeltaAmount,
  getPlacementWinTypeLabel,
  getRoundNetForPlayer,
  getRoundOutcomePresentation,
} from "../utils/roundResults";
import {
  markFirstGameCompleted,
  markFirstGameStarted,
  readActivationExperience,
} from "../utils/activationExperience";
import { formatRTCAmount } from "../utils/rtcCurrency";
import { getModeLabel, getStakeDisplay } from "../branding/modeCopy";
import bgImage from '../assets/bg.png';
import backCardImage from "../assets/cards/back.png";

type TurnStatusBadge = "DRAWING" | "MUST DISCARD" | "HIT MODE" | "WAITING";
type InlineFeedbackArea = "hand" | "discard" | "center" | "spreads" | "actions";
type InlineFeedbackTone = "error" | "info";
type EndRoundPhase = "global" | "winner" | "settlement";
type SeatZone = "top" | "left" | "right" | "bottom";
type OpponentSeatZone = Exclude<SeatZone, "bottom">;
type SeatResultTone = "winner" | "loss";
type SeatPresenceTone = "neutral" | "action" | "warning" | "ready";
type SeatPresenceBadge = {
  label: string;
  tone: SeatPresenceTone;
};
type SeatHudLayout = {
  positionClass: string;
  align: "left" | "right";
  tiltClass: string;
  panelClass: string;
  handSize: "sm" | "md";
};
type SpreadZoneLayout = {
  positionClass: string;
  laneClass: string;
};
type TableRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
type WinnerPanelLayout = {
  width: number;
  minHeight: number;
  alignClass: string;
  cardsJustifyClass: string;
};
type WinnerPanelPosition = {
  left: number;
  top: number;
};
type WinnerPanelMeasurement = {
  enabled: boolean;
  winnerZones: SeatZone[];
  layoutByZone: Record<SeatZone, WinnerPanelLayout>;
};

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

const DEFAULT_ROUND_READY_DURATION_MS = 30000;
const PROMO_ROUND_READY_DURATION_MS = 20000;
const CARD_LAYER_Z_INDEX = 2;
const PANEL_LAYER_Z_INDEX = 3;
const PANEL_MARGIN_FROM_CARDS = 20;
const WINNER_PANEL_COLLISION_SHIFT_PX = 34;
const WINNER_PANEL_EDGE_PADDING_PX = 16;

const isOverlapping = (a: TableRect, b: TableRect) =>
  a.left < b.right &&
  a.right > b.left &&
  a.top < b.bottom &&
  a.bottom > b.top;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const createRect = (left: number, top: number, width: number, height: number): TableRect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});

const areWinnerPanelPositionsEqual = (
  a: Partial<Record<SeatZone, WinnerPanelPosition>>,
  b: Partial<Record<SeatZone, WinnerPanelPosition>>
) => {
  const allZones: SeatZone[] = ["top", "left", "right", "bottom"];
  return allZones.every((zone) => {
    const current = a[zone];
    const next = b[zone];
    if (!current && !next) return true;
    if (!current || !next) return false;
    return current.left === next.left && current.top === next.top;
  });
};

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
    tableInfo,
    error: gameError,
    isConnected,
    leaveTable,
    drawCard,
    discardCard,
    spread,
    hit,
    drop,
    putIn,
    reorderHand,
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
  const [endRoundPhase, setEndRoundPhase] = useState<EndRoundPhase>("global");
  const [feedbackPulseArea, setFeedbackPulseArea] = useState<InlineFeedbackArea | null>(null);
  const [activityTick, setActivityTick] = useState(0);
  const [tableMoment, setTableMoment] = useState<TableMoment | null>(null);
  const [showHandReorderHint, setShowHandReorderHint] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [winnerPanelPositions, setWinnerPanelPositions] = useState<Partial<Record<SeatZone, WinnerPanelPosition>>>({});
  const tableRef = useRef<HTMLDivElement | null>(null);
  const seatAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const seatPanelRefs = useRef<Partial<Record<SeatZone, HTMLDivElement | null>>>({});
  const handCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const winnerPanelMeasurementRef = useRef<WinnerPanelMeasurement | null>(null);
  const lastAnimatedRoundKeyRef = useRef<string | null>(null);
  const hasInitializedLastActionRef = useRef(false);
  const lastObservedActionTimestampRef = useRef<number | null>(null);
  const guidanceBannerTimeoutRef = useRef<number | null>(null);
  const guidanceHelperTimeoutRef = useRef<number | null>(null);
  const idleGuidanceTimeoutRef = useRef<number | null>(null);
  const inlineFeedbackTimeoutRef = useRef<number | null>(null);
  const feedbackPulseTimeoutRef = useRef<number | null>(null);
  const tableMomentTimeoutRef = useRef<number | null>(null);
  const handReorderHintTimeoutRef = useRef<number | null>(null);
  const hasShownHandReorderHintRef = useRef(false);
  const lastHandDragAtRef = useRef(0);
  const endRoundPhaseTimeoutsRef = useRef<number[]>([]);
  const lastRoundPresentationKeyRef = useRef<string | null>(null);
  const myTurnStartCountRef = useRef(0);
  const wasMyTurnRef = useRef(false);
  const previousTurnStepRef = useRef<"waiting" | "draw" | "discard">("waiting");
  const maxPlayers = 4;
  const walletCurrency =
    gameState?.mode === "USD_CONTEST" || gameState?.mode === "PRIVATE_USD_TABLE" ? "usd" : "rtc";
  const {
    balance,
    loading: balanceLoading,
    refresh: refreshBalance,
  } = useWalletBalance({ refreshIntervalMs: 15000, currency: walletCurrency });
  const contestId = searchParams.get("contestId") ?? undefined;
  const inviteCode = searchParams.get("inviteCode") ?? undefined;
  const entrySource = searchParams.get("entry") ?? "direct";
  const quickPlayReason = searchParams.get("quickPlayReason") ?? undefined;
  const spectatorModeRequested = searchParams.get("spectator") === "1";
  const promoModeRequested = searchParams.get("promo") === "1";
  const previousStatusRef = useRef<string | null>(null);
  const joinSuccessTrackedRef = useRef(false);
  const joinFailureTrackedRef = useRef(false);
  const firstGameStartedRef = useRef(false);
  const firstGameCompletedRef = useRef(false);

  const copyInviteLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied.");
      return true;
    } catch {
      toast.info("Invite link ready to share.");
      return false;
    }
  }, []);

  const handleCreateInviteLink = useCallback(async () => {
    if (!tableId) {
      return;
    }

    setInviteBusy(true);
    try {
      const invite = await createInvite({ tableId });
      setInviteLink(invite.inviteUrl);
      setInviteModalOpen(true);
      await copyInviteLink(invite.inviteUrl);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create invite.");
    } finally {
      setInviteBusy(false);
    }
  }, [copyInviteLink, tableId]);

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

  const clearEndRoundPhaseTimers = useCallback(() => {
    endRoundPhaseTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    endRoundPhaseTimeoutsRef.current = [];
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

  const setSeatPanelRef = useCallback((zone: SeatZone, node: HTMLDivElement | null) => {
    seatPanelRefs.current[zone] = node;
  }, []);

  const setHandCardRef = useCallback((cardId: string, node: HTMLDivElement | null) => {
    handCardRefs.current[cardId] = node;
  }, []);

  // This effect intentionally measures against the latest DOM layout after each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const measurement = winnerPanelMeasurementRef.current;
    if (!measurement?.enabled) {
      setWinnerPanelPositions((current) => (Object.keys(current).length > 0 ? {} : current));
      return;
    }

    const tableNode = tableRef.current;
    if (!tableNode) return;

    const measure = () => {
      const nextPositions: Partial<Record<SeatZone, WinnerPanelPosition>> = {};
      const tableBounds = tableNode.getBoundingClientRect();
      const toRelativeRect = (node: HTMLDivElement | null): TableRect | null => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return createRect(
          rect.left - tableBounds.left,
          rect.top - tableBounds.top,
          rect.width,
          rect.height
        );
      };

      measurement.winnerZones.forEach((zone) => {
        const panelRect = toRelativeRect(seatPanelRefs.current[zone] ?? null);
        const layout = measurement.layoutByZone[zone];
        const maxLeft = Math.max(
          WINNER_PANEL_EDGE_PADDING_PX,
          tableBounds.width - layout.width - WINNER_PANEL_EDGE_PADDING_PX
        );
        const maxTop = Math.max(
          WINNER_PANEL_EDGE_PADDING_PX,
          tableBounds.height - layout.minHeight - WINNER_PANEL_EDGE_PADDING_PX
        );
        let left = WINNER_PANEL_EDGE_PADDING_PX;
        let top = WINNER_PANEL_EDGE_PADDING_PX;

        if (zone === "bottom" && panelRect) {
          left = panelRect.right + PANEL_MARGIN_FROM_CARDS;
          top = panelRect.top + Math.max(0, (panelRect.height - layout.minHeight) / 2) - 18;
        } else if (zone === "bottom") {
          left = WINNER_PANEL_EDGE_PADDING_PX + 220;
          top = tableBounds.height - layout.minHeight - 138;
        } else if (panelRect) {
          if (zone === "top") {
            left = panelRect.left + panelRect.width / 2 - layout.width / 2;
            top = panelRect.top - layout.minHeight - PANEL_MARGIN_FROM_CARDS;
          }

          if (zone === "right") {
            left = panelRect.right + PANEL_MARGIN_FROM_CARDS;
            top = panelRect.top + 6;
          }

          if (zone === "left") {
            left = panelRect.left - layout.width - PANEL_MARGIN_FROM_CARDS;
            top = panelRect.top + 4;
          }

          let candidateRect = createRect(left, top, layout.width, layout.minHeight);
          if (isOverlapping(candidateRect, panelRect)) {
            if (zone === "top") {
              left += 18;
              top -= WINNER_PANEL_COLLISION_SHIFT_PX;
            }

            if (zone === "right") {
              left += WINNER_PANEL_COLLISION_SHIFT_PX;
              top += 16;
            }

            if (zone === "left") {
              left -= WINNER_PANEL_COLLISION_SHIFT_PX;
            }

            candidateRect = createRect(left, top, layout.width, layout.minHeight);
            if (isOverlapping(candidateRect, panelRect)) {
              if (zone === "top") {
                top = panelRect.top - layout.minHeight - PANEL_MARGIN_FROM_CARDS - WINNER_PANEL_COLLISION_SHIFT_PX;
              }

              if (zone === "right") {
                left = panelRect.right + PANEL_MARGIN_FROM_CARDS + WINNER_PANEL_COLLISION_SHIFT_PX;
              }

              if (zone === "left") {
                left = panelRect.left - layout.width - PANEL_MARGIN_FROM_CARDS - WINNER_PANEL_COLLISION_SHIFT_PX;
              }
            }
          }
        }

        nextPositions[zone] = {
          left: clamp(left, WINNER_PANEL_EDGE_PADDING_PX, maxLeft),
          top: clamp(top, WINNER_PANEL_EDGE_PADDING_PX, maxTop),
        };
      });

      setWinnerPanelPositions((current) =>
        areWinnerPanelPositionsEqual(current, nextPositions) ? current : nextPositions
      );
    };

    const frameId = window.requestAnimationFrame(measure);
    const handleResize = () => {
      window.requestAnimationFrame(measure);
    };

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("scroll", handleResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  });

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
        if (firstGameStartedRef.current && !firstGameCompletedRef.current) {
          trackEvent(ANALYTICS_EVENTS.firstGameAbandon, {
            tableId,
            source: entrySource,
            quickPlayReason,
          });
        }
      }
    };
  }, [tableId, user, connect, disconnect, navigate, contestId, inviteCode, spectatorModeRequested, entrySource, quickPlayReason]);

  useEffect(() => {
    if (!tableId || joinSuccessTrackedRef.current || !user) {
      return;
    }

    if (tableInfo || gameState) {
      joinSuccessTrackedRef.current = true;
      trackEvent(ANALYTICS_EVENTS.joinTableSuccess, {
        tableId,
        source: entrySource,
        quickPlayReason,
        state: gameState ? 'live' : 'waiting_room',
      });
    }
  }, [tableId, user, tableInfo, gameState, entrySource, quickPlayReason]);

  useEffect(() => {
    if (!tableId || !gameError || joinFailureTrackedRef.current || joinSuccessTrackedRef.current) {
      return;
    }

    joinFailureTrackedRef.current = true;
    trackEvent(ANALYTICS_EVENTS.joinTableFail, {
      tableId,
      source: entrySource,
      quickPlayReason,
      reason: gameError,
    });
  }, [tableId, gameError, entrySource, quickPlayReason]);

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
      if (user?._id && !readActivationExperience(user._id).hasPlayedGame) {
        firstGameStartedRef.current = true;
        markFirstGameStarted(user._id);
        trackEvent(ANALYTICS_EVENTS.firstGameStarted, {
          tableId,
          source: entrySource,
          quickPlayReason,
        });
      }
    }

    if (previousStatus !== currentStatus && currentStatus === "round-end") {
      trackEvent('round_end', { tableId, mode: gameState.mode ?? 'FREE_RTC_TABLE', endedBy: gameState.roundEndedBy });
      if (user?._id && !readActivationExperience(user._id).hasCompletedGame) {
        firstGameCompletedRef.current = true;
        markFirstGameCompleted(user._id);
        trackEvent(ANALYTICS_EVENTS.firstGameCompleted, {
          tableId,
          source: entrySource,
          quickPlayReason,
        });
      }
    }

    previousStatusRef.current = currentStatus;
  }, [gameState, tableId, user?._id, entrySource, quickPlayReason]);

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
      clearEndRoundPhaseTimers();
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
  }, [clearEndRoundPhaseTimers, clearGuidanceTimers]);

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

    const fallbackRoundReadyDurationMs =
      promoModeRequested || spectatorModeRequested
        ? PROMO_ROUND_READY_DURATION_MS
        : DEFAULT_ROUND_READY_DURATION_MS;
    const roundRestartAt =
      gameState.roundReadyDeadline ??
      ((gameState.lastAction?.timestamp ?? Date.now()) + fallbackRoundReadyDurationMs);

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((roundRestartAt - Date.now()) / 1000));
      setRoundCountdownSeconds(remaining);
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => {
      window.clearInterval(interval);
    };
  }, [gameState?.status, gameState?.lastAction?.timestamp, gameState?.roundReadyDeadline, promoModeRequested, spectatorModeRequested]);

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
  const isQueuedForNextRound = !!(
    user &&
    gameState &&
    !currentPlayer &&
    !spectatorModeRequested &&
    tableInfo?.players?.some((player) => player.userId === user._id && !player.isAI)
  );
  const isSpectator = spectatorModeRequested && !currentPlayer;
  const isMyTurn = !!(
    gameState &&
    user &&
    !isSpectator &&
    !isQueuedForNextRound &&
    gameState.players[gameState.currentPlayerIndex]?.userId === user._id
  );
  const turnDurationMs = gameState?.turnDurationMs ?? 60_000;
  const turnTimeRemainingMs = Math.max(0, (gameState?.turnExpiresAt ?? Date.now()) - Date.now());
  const turnTimerCycleKey = `${gameState?.turn ?? 0}:${gameState?.currentPlayerIndex ?? -1}:${gameState?.turnExpiresAt ?? 0}`;
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
    const lastActionForMoment = gameState?.lastAction ?? null;
    const playersForMoment = gameState?.players ?? [];
    const caughtDroppingPlayerIdForMoment = gameState?.caughtDroppingPlayerId;

    if (!experienceFlags.enhancedTableMoments || !hasInitializedLastActionRef.current || !lastActionForMoment) {
      return;
    }

    const latestTableMoment = buildTableMomentFromLastAction({
      players: playersForMoment,
      lastAction: lastActionForMoment,
      caughtDroppingPlayerId: caughtDroppingPlayerIdForMoment,
    });
    if (!latestTableMoment) {
      return;
    }

    setTableMoment(latestTableMoment);

    if (tableMomentTimeoutRef.current !== null) {
      window.clearTimeout(tableMomentTimeoutRef.current);
    }

    tableMomentTimeoutRef.current = window.setTimeout(() => {
      setTableMoment((current) => (current?.title === latestTableMoment.title ? null : current));
    }, 2400);
  }, [gameState?.caughtDroppingPlayerId, gameState?.lastAction, gameState?.players]);

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
      if (!hasShownHandReorderHintRef.current && hasCurrentPlayer && (currentPlayer?.hand.length ?? 0) > 1) {
        hasShownHandReorderHintRef.current = true;
        setShowHandReorderHint(true);
        if (handReorderHintTimeoutRef.current !== null) {
          window.clearTimeout(handReorderHintTimeoutRef.current);
        }
        handReorderHintTimeoutRef.current = window.setTimeout(() => {
          setShowHandReorderHint(false);
          handReorderHintTimeoutRef.current = null;
        }, 5200);
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
      setShowHandReorderHint(false);
      setGuidanceOverrideText(null);
      setGuidanceOverrideHelper(null);
      if (handReorderHintTimeoutRef.current !== null) {
        window.clearTimeout(handReorderHintTimeoutRef.current);
        handReorderHintTimeoutRef.current = null;
      }
    }

    wasMyTurnRef.current = isMyTurn;
    previousTurnStepRef.current = currentTurnStep;
  }, [clearGuidanceTimers, currentPlayer?.hand.length, currentTurnStep, gameState, hasCurrentPlayer, isMyTurn, triggerGuidance]);

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

  const roundPresentationSequenceKey =
    gameState?.status === "round-end"
      ? [
          gameState.tableId,
          gameState.roundWinnerId ?? "no-winner",
          gameState.roundEndedBy ?? "no-ending",
          gameState.roundReadyDeadline ?? "no-deadline",
          gameState.lastAction?.timestamp ?? "no-action",
        ].join(";")
      : null;

  useEffect(() => {
    if (!roundPresentationSequenceKey) {
      clearEndRoundPhaseTimers();
      lastRoundPresentationKeyRef.current = null;
      setEndRoundPhase("global");
      return;
    }

    if (lastRoundPresentationKeyRef.current === roundPresentationSequenceKey) {
      return;
    }

    clearEndRoundPhaseTimers();
    lastRoundPresentationKeyRef.current = roundPresentationSequenceKey;
    setEndRoundPhase("global");

    const winnerPhaseTimeout = window.setTimeout(() => {
      setEndRoundPhase("winner");
    }, 1800);
    const settlementPhaseTimeout = window.setTimeout(() => {
      setEndRoundPhase("settlement");
    }, 4200);

    endRoundPhaseTimeoutsRef.current = [winnerPhaseTimeout, settlementPhaseTimeout];

    return () => {
      clearEndRoundPhaseTimers();
    };
  }, [clearEndRoundPhaseTimers, roundPresentationSequenceKey]);

  useEffect(() => {
    if (gameState?.status !== "round-end") return;

    clearGuidanceTimers();
    setShowGuidanceHelper(false);
    setGuidanceOverrideText(null);
    setGuidanceOverrideHelper(null);
    setInlineFeedback(null);
    setFeedbackPulseArea(null);
    setTableMoment(null);

    if (inlineFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(inlineFeedbackTimeoutRef.current);
      inlineFeedbackTimeoutRef.current = null;
    }

    if (feedbackPulseTimeoutRef.current !== null) {
      window.clearTimeout(feedbackPulseTimeoutRef.current);
      feedbackPulseTimeoutRef.current = null;
    }

    if (tableMomentTimeoutRef.current !== null) {
      window.clearTimeout(tableMomentTimeoutRef.current);
      tableMomentTimeoutRef.current = null;
    }
  }, [clearGuidanceTimers, gameState?.status]);

  useEffect(() => {
    return () => {
      if (tableMomentTimeoutRef.current !== null) {
        window.clearTimeout(tableMomentTimeoutRef.current);
      }
    };
  }, []);

  if (!isConnected || !gameState || !user) {
    if (isConnected && !gameState && tableInfo && user) {
      const seatCount = tableInfo.maxPlayers ?? 4;
      const occupiedSeats = new Set((tableInfo.players ?? []).map((player) => player.seat));
      const amHost = !!tableInfo.createdBy && tableInfo.createdBy === user._id;
      const stakeDisplay = getStakeDisplay(tableInfo.stake, tableInfo.mode);

      return (
        <>
          <div className="space-y-6">
            <section className="rt-landscape-compact-card rt-panel-strong rounded-3xl p-6 sm:p-8">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">Waiting Room</div>
              <h1 className="mt-3 text-3xl rt-page-title sm:text-4xl">
                {tableInfo.name || "Private Table"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-white/68 sm:text-base">
                You're in the room. Invite players into the empty seats below. The table will begin once enough players have joined.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Mode</div>
                  <div className="mt-2 text-lg rt-page-title text-white">{getModeLabel(tableInfo.mode)}</div>
                </div>
                <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Stake</div>
                  <div className="mt-2 text-lg rt-page-title text-white">
                    {stakeDisplay.amount} <span className="text-sm text-white/60">{stakeDisplay.unit}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Seats Filled</div>
                  <div className="mt-2 text-lg rt-page-title text-white">
                    {tableInfo.currentPlayerCount}/{tableInfo.maxPlayers}
                  </div>
                </div>
              </div>

              {tableInfo.hostNote && (
                <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100/90">
                  Host note: {tableInfo.hostNote}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => void handleCreateInviteLink()} disabled={inviteBusy}>
                  {inviteBusy ? "Creating Invite..." : "Invite Players"}
                </Button>
                <Button variant="secondary" onClick={() => navigate("/tables")}>
                  Back to Lobby
                </Button>
                {amHost && (
                  <div className="rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/60">
                    Host Controls Active
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: seatCount }, (_, seatIndex) => {
                const occupied = occupiedSeats.has(seatIndex);
                const isMySeat = (tableInfo.players ?? []).some((player) => player.seat === seatIndex && player.userId === user._id);

                return (
                  <article
                    key={`seat-${seatIndex}`}
                    className="rt-landscape-compact-card rt-panel-strong rounded-2xl p-5"
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Seat {seatIndex + 1}</div>
                    <div className="mt-3 text-xl rt-page-title text-white">
                      {occupied ? (isMySeat ? "You" : "Occupied") : "Open Seat"}
                    </div>
                    <div className="mt-2 text-sm text-white/65">
                      {occupied
                        ? isMySeat
                          ? "You're locked into this seat."
                          : "Waiting on this player."
                        : "Send an invite link to fill this spot."}
                    </div>
                    {!occupied && (
                      <Button
                        className="mt-5 w-full"
                        variant="secondary"
                        onClick={() => void handleCreateInviteLink()}
                        disabled={inviteBusy}
                      >
                        {inviteBusy ? "Creating..." : "Invite Player"}
                      </Button>
                    )}
                  </article>
                );
              })}
            </section>
          </div>

          <Modal
            isOpen={inviteModalOpen}
            onClose={() => setInviteModalOpen(false)}
            onConfirm={() => {
              if (inviteLink) {
                void copyInviteLink(inviteLink);
              }
            }}
            title="Invite Link Ready"
            confirmLabel="Copy Link"
          >
            <div className="space-y-4">
              <p>Share this link with the players you want at the table.</p>
              <input
                readOnly
                value={inviteLink}
                className="h-11 w-full rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white"
              />
              <p className="text-xs text-white/55">
                The link opens the invite page for this room, then the player joins the table from there.
              </p>
            </div>
          </Modal>
        </>
      );
    }

    if (gameError && !tableInfo) {
      return (
        <div className="mx-auto max-w-2xl">
          <section className="rt-panel-strong rounded-[28px] p-8 text-center">
            <h1 className="text-3xl rt-page-title">Couldn&apos;t seat this join.</h1>
            <p className="mt-3 text-white/68">{gameError}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button onClick={() => navigate("/tables?focus=recommended")}>Browse Cribs</Button>
              <Button variant="secondary" onClick={() => navigate("/")}>Back Home</Button>
            </div>
          </section>
        </div>
      );
    }

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
    if (Date.now() - lastHandDragAtRef.current < 220) {
      return;
    }

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

  const handleFlickDiscard = (card: CardType, info: PanInfo): boolean => {
    markActionActivity();
    const isDiscardStep = isMyTurn && hasDrawnThisTurn;
    if (!isTouchDevice || !isDiscardStep || selectedCards.length !== 1) return false;
    if (selectedCards[0].rank !== card.rank || selectedCards[0].suit !== card.suit) return false;

    const movedTowardDiscard = info.offset.y < -85 && Math.abs(info.offset.x) < 170;
    const quickFlickTowardDiscard = info.velocity.y < -700 && Math.abs(info.velocity.x) < 900;

    if (!movedTowardDiscard && !quickFlickTowardDiscard) return false;
    return discardSelectedCard();
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
      return totalPlayersInRound >= 3 ? { x: -235, y: 22 } : { x: 170, y: -138 };
    }

    if (seatOffset === 2) return { x: 155, y: -142 };

    if (seatOffset === 3) return { x: 235, y: 22 };
    return { x: 0, y: 152 };
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
    return formatRTCAmount(amount);
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
    const resolvedHandScore = handScore ?? (player.hand.length === 0 ? 0 : null);
    const resultLabel = isWinner ? getPlacementWinTypeLabel(gameState, placement?.winType) : "LOSS";
    const statusLabel = isWinner
      ? roundOutcome.headline
      : gameState.roundEndedBy === "CAUGHT_DROP" && player.userId === gameState.caughtDroppingPlayerId
        ? "CAUGHT DROP"
        : resolvedHandScore === 0
          ? "0 CARDS"
          : resultLabel.toUpperCase();

    return {
      userId: player.userId,
      username: player.username,
      rank: placement?.rank ?? null,
      resultTone: (isWinner ? "winner" : "loss") as SeatResultTone,
      resultStateLabel: isWinner ? "WINNER" : "LOSS",
      resultLabel,
      statusLabel,
      scoreLabel:
        resolvedHandScore === null
          ? "Score unavailable"
          : isWinner && resolvedHandScore === 0
            ? "EMPTY"
          : `${resolvedHandScore} in hand`,
      infoScoreLabel:
        resolvedHandScore === null
          ? "Score unavailable"
          : `${resolvedHandScore}`,
      detailLabel: isWinner
        ? roundOutcome.explanation
        : placement?.rank
          ? `Rank ${placement.rank}`
          : "Round settled",
      seatLabel: isWinner
        ? roundOutcome.headline
        : resolvedHandScore !== null
          ? `${resolvedHandScore} in hand`
          : resultLabel,
      deltaLabel: roundNet === null ? "--" : formatRoundDeltaAmount(roundNet, displayCurrency),
      deltaValue: roundNet,
      isWinner,
    };
  });
  const roundResultByUserId = new Map(roundResultRows.map((row) => [row.userId, row]));
  const waitingPlayerCount = Math.max(0, totalRoundPlayers - readyCount);
  const roundReadyProgress = totalRoundPlayers > 0 ? readyCount / totalRoundPlayers : 0;
  const roundRailStatusLabel = isContinuousMode
    ? waitingPlayerCount === 0
      ? "All players ready"
      : `Waiting on ${waitingPlayerCount} player${waitingPlayerCount === 1 ? "" : "s"}`
    : "Match complete";
  const roundStatusDetail =
    isContinuousMode && isReadyForNextRound ? "Your seat is locked for the next hand." : null;
  const defaultRoundCountdownSeconds =
    promoModeRequested || spectatorModeRequested
      ? PROMO_ROUND_READY_DURATION_MS / 1000
      : DEFAULT_ROUND_READY_DURATION_MS / 1000;
  const countdownLabel = isContinuousMode
    ? `Next hand in ${roundCountdownSeconds ?? defaultRoundCountdownSeconds}s`
    : null;
  const isRoundEnd = gameState.status === "round-end";
  const roundPresentationKey = isRoundEnd
    ? [
        gameState.tableId,
        gameState.roundWinnerId ?? "no-winner",
        gameState.roundEndedBy ?? "no-ending",
        gameState.roundReadyDeadline ?? "no-deadline",
        gameState.lastAction?.timestamp ?? "no-action",
      ].join(";")
    : null;
  const isRoundEndGlobalPhase = isRoundEnd && endRoundPhase === "global";
  const isRoundEndWinnerPhase = isRoundEnd && endRoundPhase === "winner";
  const isRoundEndSettlementPhase = isRoundEnd && endRoundPhase === "settlement";
  const showWinnerSpotlight = isRoundEndWinnerPhase || isRoundEndSettlementPhase;
  const showCompactCountdownStrip = isRoundEndSettlementPhase && isContinuousMode;
  const roundOutcomeSummary = roundOutcome.explanation || roundOutcome.secondary;
  const roundCountdownStatusLine = [countdownLabel, roundRailStatusLabel].filter(Boolean).join(" | ");
  const roundCountdownMetaLine = [roundStatusDetail].filter(Boolean).join(" | ");
  const runItBackPrompt = !isContinuousMode
    ? "Match complete"
    : waitingPlayerCount === 0
      ? "Table locked in"
      : waitingPlayerCount === 1
        ? "Waiting on one player"
        : `${waitingPlayerCount} players still deciding`;
  const readyStatusChips = gameState.players.map((player) => ({
    userId: player.userId,
    username: player.username,
    ready: readyPlayerIds.has(player.userId),
    isAI: player.isAI,
  }));
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
    ? null
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
  const ambientCenterStatusText =
    !isRoundEnd && isQueuedForNextRound
      ? `You're in for the next hand. Watching ${activeTurnPlayerName} play...`
      : !isRoundEnd && (promoModeRequested || isSpectator)
        ? `${activeTurnPlayerName} is playing...`
        : null;
  const routineHudMessage = (() => {
    if (inlineFeedback) {
      const isError = inlineFeedback.tone === "error";
      return {
        eyebrow: isError ? "Table Alert" : isMyTurn ? "Your Turn" : "Table Status",
        title: inlineFeedback.message,
        detail: shouldShowGuidanceHelper ? guidanceHelperText : null,
        tone: isError ? "error" : isHitMode ? "action" : isMyTurn ? "info" : "neutral",
      };
    }

    if (isRoundEnd) return null;

    if (tableMoment && !(isMyTurn && (guidanceBannerText || shouldShowGuidanceHelper))) {
      return tableMoment;
    }

    if (guidanceBannerText || shouldShowGuidanceHelper || ambientCenterStatusText) {
      return {
        eyebrow: ambientCenterStatusText && !guidanceBannerText ? "Table Status" : isMyTurn ? "Your Turn" : "Table Status",
        title: guidanceBannerText ?? ambientCenterStatusText ?? "Table Status",
        detail: shouldShowGuidanceHelper ? guidanceHelperText : ambientCenterStatusText && guidanceBannerText ? ambientCenterStatusText : null,
        tone: isHitMode ? "action" : isMyTurn ? "info" : "neutral",
      };
    }

    return null;
  })();
  const routineHudToneClass =
    routineHudMessage?.tone === "error"
      ? "border-rose-200/28 bg-[linear-gradient(135deg,rgba(88,17,29,0.86),rgba(24,8,14,0.72))] shadow-[0_18px_38px_rgba(127,29,29,0.34)]"
      : routineHudMessage?.tone === "action"
        ? "border-fuchsia-200/24 bg-[linear-gradient(135deg,rgba(71,19,79,0.82),rgba(17,11,25,0.72))] shadow-[0_18px_38px_rgba(112,26,117,0.28)]"
        : routineHudMessage?.tone === "info"
          ? "border-sky-200/24 bg-[linear-gradient(135deg,rgba(16,52,84,0.82),rgba(9,18,28,0.72))] shadow-[0_18px_38px_rgba(12,74,110,0.28)]"
          : "border-white/14 bg-[linear-gradient(135deg,rgba(15,22,29,0.82),rgba(9,11,16,0.72))] shadow-[0_18px_38px_rgba(0,0,0,0.26)]";
  const routineHudIndicatorClass =
    routineHudMessage?.tone === "error"
      ? "bg-rose-300 shadow-[0_0_14px_rgba(251,113,133,0.85)]"
      : routineHudMessage?.tone === "action"
        ? "bg-fuchsia-300 shadow-[0_0_14px_rgba(232,121,249,0.82)]"
        : routineHudMessage?.tone === "info"
          ? "bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.82)]"
          : "bg-amber-200 shadow-[0_0_14px_rgba(253,230,138,0.78)]";
  const roundMomentHeadlineClass =
    roundOutcome.tone === "gold"
      ? "text-amber-100 drop-shadow-[0_0_18px_rgba(251,191,36,0.52)]"
      : roundOutcome.tone === "emerald"
        ? "text-emerald-100 drop-shadow-[0_0_18px_rgba(74,222,128,0.45)]"
        : roundOutcome.tone === "rose"
          ? "text-rose-100 drop-shadow-[0_0_18px_rgba(251,113,133,0.42)]"
          : "text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.28)]";
  const roundStatusBannerClass =
    roundOutcome.tone === "gold"
      ? "border-amber-200/28 bg-[linear-gradient(135deg,rgba(69,45,11,0.84),rgba(16,12,9,0.7))] shadow-[0_18px_34px_rgba(120,71,7,0.24)]"
      : roundOutcome.tone === "emerald"
        ? "border-emerald-200/24 bg-[linear-gradient(135deg,rgba(15,66,46,0.82),rgba(8,18,15,0.72))] shadow-[0_18px_34px_rgba(5,150,105,0.2)]"
        : roundOutcome.tone === "rose"
          ? "border-rose-200/24 bg-[linear-gradient(135deg,rgba(87,22,40,0.82),rgba(20,9,14,0.72))] shadow-[0_18px_34px_rgba(190,24,93,0.22)]"
          : "border-white/14 bg-[linear-gradient(135deg,rgba(18,24,31,0.82),rgba(8,11,16,0.72))] shadow-[0_18px_34px_rgba(0,0,0,0.24)]";
  const countdownStripClass =
    "border-white/12 bg-[linear-gradient(135deg,rgba(18,24,31,0.72),rgba(8,11,16,0.62))] shadow-[0_14px_28px_rgba(0,0,0,0.2)]";
  const countdownHeadlineClass = "text-white/60";

  const deckIsAnimating = lastActionType === "drawCard" && lastActionPayload?.source === "deck";
  const discardIsAnimating =
    lastActionType === "discardCard" ||
    (lastActionType === "drawCard" && lastActionPayload?.source === "discard");
  const showActionDock = !isSpectator && !isQueuedForNextRound && !hideCardsForPresentation && !isRoundEnd;
  const globalHudBandClass = isPhoneLandscapeLayout
    ? "top-2 left-2 right-2 gap-2"
    : "top-4 left-4 right-4 gap-4";
  const systemHudStackWidthClass = isPhoneLandscapeLayout ? "w-[300px] max-w-full" : "w-[430px] max-w-full";
  const systemHudMessageWidthClass = isPhoneLandscapeLayout ? "w-[238px] max-w-full" : "w-[318px] max-w-full";
  const playerHudLayouts: Record<OpponentSeatZone, SeatHudLayout> = {
    top: {
      positionClass: isHeadsUpTable
        ? isPhoneLandscapeLayout
          ? "left-[28%] top-[8.5%] w-[34%] max-w-[236px]"
          : "left-[27%] top-[7%] w-[30%] max-w-[304px]"
        : isPhoneLandscapeLayout
          ? "left-[28.5%] top-[8%] w-[32%] max-w-[224px]"
          : "left-[27.5%] top-[6.5%] w-[27%] max-w-[282px]",
      align: "left" as const,
      tiltClass: isThreeHandedTable ? "rotate-[0.5deg]" : "rotate-0",
      panelClass: "w-full",
      handSize: "md" as const,
    },
    left: {
      positionClass: isPhoneLandscapeLayout
        ? "left-[-0.25%] top-[17.75%] w-[22%] max-w-[170px]"
        : "left-[-0.5%] top-[16.5%] w-[20.5%] max-w-[204px]",
      align: "left" as const,
      tiltClass: "-rotate-[2deg]",
      panelClass: "w-full",
      handSize: "sm" as const,
    },
    right: {
      positionClass: isPhoneLandscapeLayout
        ? "right-[0.35%] top-[35.5%] w-[21.5%] max-w-[170px]"
        : "right-[0.65%] top-[34.25%] w-[20.5%] max-w-[204px]",
      align: "right" as const,
      tiltClass: isThreeHandedTable ? "rotate-[1.5deg]" : "rotate-[2deg]",
      panelClass: "w-full",
      handSize: "sm" as const,
    },
  };
  const spreadZoneLayouts: Record<SeatZone, SpreadZoneLayout> = {
    top: {
      positionClass: isHeadsUpTable
        ? isPhoneLandscapeLayout
          ? "left-[65%] top-[25.5%] -translate-x-1/2 w-[28%] max-w-[218px]"
          : "left-[66.5%] top-[24.5%] -translate-x-1/2 w-[27%] max-w-[320px]"
        : isPhoneLandscapeLayout
          ? "left-[63%] top-[24.75%] -translate-x-1/2 w-[27%] max-w-[210px]"
          : "left-[64.5%] top-[24%] -translate-x-1/2 w-[26%] max-w-[308px]",
      laneClass: isPhoneLandscapeLayout ? "min-h-[72px] gap-2.5" : "min-h-[96px] gap-4",
    },
    left: {
      positionClass: isPhoneLandscapeLayout
        ? "left-[5.25%] top-[36.75%] w-[24%] max-w-[184px]"
        : "left-[7%] top-[36.25%] w-[24%] max-w-[236px]",
      laneClass: isPhoneLandscapeLayout ? "min-h-[72px] gap-2.5" : "min-h-[92px] gap-3",
    },
    right: {
      positionClass: isPhoneLandscapeLayout
        ? "right-[4.75%] top-[56.5%] w-[23%] max-w-[180px]"
        : "right-[5.75%] top-[55.25%] w-[23%] max-w-[232px]",
      laneClass: isPhoneLandscapeLayout ? "min-h-[72px] gap-2.5" : "min-h-[92px] gap-3",
    },
    bottom: {
      positionClass: isPhoneLandscapeLayout
        ? "left-1/2 bottom-[18%] -translate-x-1/2 w-[52%] max-w-[410px]"
        : "left-1/2 bottom-[17%] -translate-x-1/2 w-[52%] max-w-[620px]",
      laneClass: isPhoneLandscapeLayout ? "min-h-[72px] gap-2.5" : "min-h-[90px] gap-3.5",
    },
  };
  const winnerPanelLayouts: Record<SeatZone, WinnerPanelLayout> = {
    top: {
      width: isPhoneLandscapeLayout ? 184 : 244,
      minHeight: isPhoneLandscapeLayout ? 108 : 136,
      alignClass: "items-start text-left",
      cardsJustifyClass: "justify-start",
    },
    left: {
      width: isPhoneLandscapeLayout ? 172 : 208,
      minHeight: isPhoneLandscapeLayout ? 104 : 128,
      alignClass: "items-start text-left",
      cardsJustifyClass: "justify-start",
    },
    right: {
      width: isPhoneLandscapeLayout ? 172 : 208,
      minHeight: isPhoneLandscapeLayout ? 104 : 128,
      alignClass: "items-end text-right",
      cardsJustifyClass: "justify-end",
    },
    bottom: {
      width: isPhoneLandscapeLayout ? 180 : 220,
      minHeight: isPhoneLandscapeLayout ? 108 : 132,
      alignClass: "items-start text-left",
      cardsJustifyClass: "justify-start",
    },
  };
  const bottomSeatHudAnchorClass = isPhoneLandscapeLayout
    ? "left-[2.5%] bottom-[4.25%] gap-1.5"
    : "left-[3.2%] bottom-[4.5%] gap-2";
  const bottomHandAnchor = {
    left: isPhoneLandscapeLayout ? "51.5%" : "50.25%",
    bottom: isPhoneLandscapeLayout ? "-26px" : "-34px",
    width: isPhoneLandscapeLayout ? "min(100%, 492px)" : "min(100%, 760px)",
  } as const;
  const centerPileCardClass = isPhoneLandscapeLayout ? "h-[3.55rem] w-[2.55rem]" : "h-[4.7rem] w-[3.3rem]";
  const dealAnimationCardClass = isPhoneLandscapeLayout ? "h-[3.4rem] w-[2.4rem]" : "h-[4.45rem] w-[3.1rem]";
  const spreadCardClass = {
    compact: isPhoneLandscapeLayout
      ? "h-[3.2rem] w-[2.25rem]"
      : "h-[4.55rem] w-[3.18rem] sm:h-[4.95rem] sm:w-[3.45rem]",
    regular: isPhoneLandscapeLayout
      ? "h-[3.45rem] w-[2.45rem]"
      : "h-[4.95rem] w-[3.45rem] sm:h-[5.35rem] sm:w-[3.75rem]",
    bottomCompact: isPhoneLandscapeLayout
      ? "h-[2.95rem] w-[2.1rem]"
      : "h-[4.1rem] w-[2.9rem] sm:h-[4.45rem] sm:w-[3.1rem]",
    bottomRegular: isPhoneLandscapeLayout
      ? "h-[3.15rem] w-[2.25rem]"
      : "h-[4.4rem] w-[3.05rem] sm:h-[4.75rem] sm:w-[3.3rem]",
  };
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

  const renderOpponentHand = (
    player: typeof gameState.players[number],
    size: "sm" | "md" = "sm"
  ) => {
    if (isRoundEnd) return null;

    const count = getVisibleCardCount(player.userId, player.hand.length);
    if (count <= 0) {
      return <div className="text-[10px] uppercase tracking-[0.2em] text-white/32">Empty</div>;
    }
    const cardClass =
      size === "md"
        ? isPhoneLandscapeLayout
          ? "h-[3.55rem] w-[2.5rem]"
          : "h-[4.75rem] w-[3.35rem]"
        : isPhoneLandscapeLayout
          ? "h-[3.15rem] w-[2.2rem]"
          : "h-[4.15rem] w-[2.9rem]";

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

  const renderSeatResultState = (
    seatResult: (typeof roundResultRows)[number],
    align: "left" | "right"
  ) => {
    const isWinner = seatResult.resultTone === "winner";
    const glowClass = isWinner
      ? "border-emerald-200/42 bg-[linear-gradient(135deg,rgba(16,84,60,0.48),rgba(10,19,16,0.66))] shadow-[0_0_22px_rgba(74,222,128,0.22)]"
      : "border-rose-200/36 bg-[linear-gradient(135deg,rgba(96,27,43,0.46),rgba(18,10,14,0.68))] shadow-[0_0_20px_rgba(251,113,133,0.18)]";
    const badgeClass = isWinner
      ? "border-emerald-200/40 bg-emerald-300/12 text-emerald-100"
      : "border-rose-200/36 bg-rose-300/12 text-rose-100";
    const deltaClass = isWinner ? "text-emerald-200" : "text-rose-200";

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`mt-2 rounded-[14px] border px-2.5 py-2 backdrop-blur-[6px] ${glowClass}`}
      >
        <div className={`flex flex-wrap items-center gap-1.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
          <div className={`inline-flex rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.22em] ${badgeClass}`}>
            {seatResult.resultStateLabel}
          </div>
          <div className={`${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} font-semibold ${deltaClass}`}>
            {seatResult.deltaLabel}
          </div>
        </div>
        <div className={`mt-1.5 ${align === "right" ? "text-right" : "text-left"}`}>
          <div className="text-[8px] uppercase tracking-[0.2em] text-white/54">Hand Score</div>
          <div className={`${isPhoneLandscapeLayout ? "text-[10px]" : "text-[11px]"} mt-0.5 font-semibold text-white`}>
            {seatResult.infoScoreLabel}
          </div>
        </div>
      </motion.div>
    );
  };

  const getSeatPresenceBadges = (
    player: typeof gameState.players[number] | null,
    isSeatActive: boolean
  ): SeatPresenceBadge[] => {
    if (!player || !experienceFlags.enhancedSeatPresence) {
      return [];
    }

    if (isRoundEnd && isContinuousMode) {
      if (readyPlayerIds.has(player.userId)) {
        return [{ label: player.isAI ? "Auto ready" : "Locked in", tone: "ready" }];
      }

      return player.isAI ? [] : [{ label: "Deciding", tone: "neutral" }];
    }

    if (isSeatActive) {
      return [{ label: "On move", tone: "action" }];
    }

    if (player.hitLockCounter > 0) {
      return [{ label: `Hit lock ${player.hitLockCounter}`, tone: "warning" }];
    }

    if (player.spreads.length >= 2) {
      return [{ label: "Double spread", tone: "ready" }];
    }

    if (player.spreads.length === 1) {
      return [{ label: "Spread live", tone: "action" }];
    }

    return [];
  };

  const renderSeatPresenceBadges = (
    badges: SeatPresenceBadge[],
    align: "left" | "right"
  ) => {
    if (badges.length === 0) {
      return null;
    }

    return (
      <div className={`mt-1.5 flex flex-wrap gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {badges.map((badge) => (
          <div
            key={`${badge.tone}-${badge.label}`}
            className={`rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] ${
              badge.tone === "ready"
                ? "border-emerald-200/34 bg-emerald-300/12 text-emerald-100"
                : badge.tone === "warning"
                  ? "border-rose-200/30 bg-rose-300/10 text-rose-100"
                  : badge.tone === "action"
                    ? "border-amber-200/34 bg-amber-300/12 text-amber-100"
                    : "border-white/14 bg-white/[0.05] text-white/68"
            }`}
          >
            {badge.label}
          </div>
        ))}
      </div>
    );
  };

  const renderSeatInfo = (
    player: typeof gameState.players[number] | null,
    zone: SeatZone,
    layout: SeatHudLayout
  ) => {
    if (!player) return null;
    const isActive = gameState.players[gameState.currentPlayerIndex]?.userId === player.userId;
    const turnStatus = getTurnStatus(player.userId);
    const seatBalance = playerBalances[player.userId];
    const roundSeatResult = isRoundEnd ? roundResultByUserId.get(player.userId) : null;
    const seatPresenceBadges = getSeatPresenceBadges(player, isActive);
    const shouldHighlightSeatWinner = !!roundSeatResult?.isWinner;
    const shouldDimSeatLoser = !!roundSeatResult && !roundSeatResult.isWinner;
    const shouldDimForWinnerFocus = isRoundEndWinnerPhase && !shouldHighlightSeatWinner;
    const shouldHeroWinnerSeat = showWinnerSpotlight && shouldHighlightSeatWinner;
    const seatShellClass = isRoundEnd
      ? shouldHeroWinnerSeat
        ? "border-emerald-200/55 bg-[linear-gradient(145deg,rgba(14,54,41,0.88),rgba(8,15,16,0.78))] shadow-[0_22px_40px_rgba(16,185,129,0.24)]"
        : shouldDimSeatLoser || shouldDimForWinnerFocus
          ? "border-white/10 bg-black/18 opacity-78"
          : "border-white/10 bg-black/18"
      : isActive
        ? "border-amber-300/42 bg-black/24 shadow-[0_18px_34px_rgba(251,191,36,0.16)]"
        : "border-white/10 bg-black/18";

    return (
      <motion.div
        className={`absolute pointer-events-none ${layout.positionClass}`}
        style={{ zIndex: PANEL_LAYER_Z_INDEX }}
        initial={false}
        animate={
          shouldHeroWinnerSeat
            ? { scale: [1, 1.035, 1], y: [0, -4, 0] }
            : isActive && !isRoundEnd
            ? { scale: [1, 1.018, 1], y: [0, -2, 0] }
            : { scale: 1, y: 0 }
        }
        transition={
          shouldHeroWinnerSeat
            ? { duration: 2.1, repeat: Infinity, ease: "easeInOut" }
            : isActive && !isRoundEnd
            ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.25 }
        }
      >
        <div
          className={`${
            isActive ? "active-seat" : "inactive-seat"
          } relative flex items-center gap-2 transition-all duration-300 ${
            layout.align === "right" ? "flex-row-reverse text-right" : ""
          } ${layout.tiltClass} ${shouldDimForWinnerFocus ? "opacity-50 saturate-75" : ""}`}
        >
          {isActive && !isRoundEnd ? (
            <div className="absolute -inset-2 rounded-[24px] bg-amber-300/10 blur-xl" aria-hidden />
          ) : null}
          {shouldHeroWinnerSeat ? (
            <div className="absolute -inset-2 rounded-[26px] bg-emerald-300/12 blur-2xl" aria-hidden />
          ) : null}
          <div
            ref={(node) => setSeatPanelRef(zone, node)}
            className={`relative rounded-[18px] border transition-all duration-300 ${
              isPhoneLandscapeLayout ? "px-2.5 py-2" : "px-3 py-2.5"
            } ${layout.panelClass} ${seatShellClass}`}
          >
            <div className={`relative flex items-center gap-2.5 ${layout.align === "right" ? "flex-row-reverse" : ""}`}>
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
                  key={`${player.userId}:${turnTimerCycleKey}`}
                  duration={turnDurationMs}
                  timeRemaining={isActive ? turnTimeRemainingMs : turnDurationMs}
                  isActive={isActive}
                  size={isPhoneLandscapeLayout ? 42 : 52}
                  strokeWidth={isPhoneLandscapeLayout ? 2.5 : 3.2}
                  className={isActive ? "animate-pulse" : ""}
                />
              </div>
              <div className="min-w-0">
                {!isRoundEnd ? (
                  <div
                    className={`mb-1 inline-flex rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.18em] ${
                      isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                    } ${turnStatusClasses[turnStatus]}`}
                  >
                    {turnStatus}
                  </div>
                ) : null}
                <div
                  className={`${
                    isPhoneLandscapeLayout ? "text-[10px]" : "text-[11px]"
                  } truncate font-semibold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.48)]`}
                >
                  {player.username}
                </div>
                <div
                  className={`${
                    isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"
                  } leading-tight text-white/78 drop-shadow-[0_2px_8px_rgba(0,0,0,0.44)]`}
                >
                  {formatSeatBalance(seatBalance)}
                </div>
                {!isRoundEnd ? renderSeatPresenceBadges(seatPresenceBadges, layout.align) : null}
                {!isRoundEnd ? (
                  <div
                    className={`${
                      isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                    } mt-0.5 leading-tight uppercase tracking-[0.14em] text-white/62 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]`}
                  >
                    {player.hitLockCounter > 0
                      ? `Drop Locked ${player.hitLockCounter}`
                      : `${getVisibleCardCount(player.userId, player.hand.length)} cards`}
                  </div>
                ) : roundSeatResult ? renderSeatResultState(roundSeatResult, layout.align) : null}
              </div>
              <div className={`${layout.align === "right" ? "order-first" : ""}`}>
                {renderOpponentHand(player, layout.handSize)}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const displayedBottomPlayer = isSpectator ? viewerSeatPlayer : currentPlayer;
  const hand = [...(displayedBottomPlayer?.hand ?? [])];
  const visibleHand =
    displayedBottomPlayer ? hand.slice(0, getVisibleCardCount(displayedBottomPlayer.userId, hand.length)) : [];
  const myTurnStatus = getTurnStatus(displayedBottomPlayer?.userId ?? user._id, true);
  const canUseFlickDiscard = !isSpectator && isTouchDevice && isDiscardReady;
  const canReorderHand =
    !isSpectator &&
    !!tableId &&
    !!user &&
    displayedBottomPlayer?.userId === user._id &&
    visibleHand.length > 1;
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
  const bottomSeatPresenceBadges = getSeatPresenceBadges(displayedBottomPlayer ?? null, isBottomSeatActive);
  const shouldHighlightBottomWinner = !!bottomSeatRoundResult?.isWinner;
  const shouldDimBottomLoser = !!bottomSeatRoundResult && !bottomSeatRoundResult.isWinner;
  const shouldDimBottomForWinnerFocus = isRoundEndWinnerPhase && !shouldHighlightBottomWinner;
  const shouldHeroBottomWinner = showWinnerSpotlight && shouldHighlightBottomWinner;
  const bottomSeatShellClass = isRoundEnd
    ? shouldHeroBottomWinner
      ? "border-emerald-200/55 bg-[linear-gradient(145deg,rgba(14,54,41,0.88),rgba(8,15,16,0.78))] shadow-[0_22px_42px_rgba(16,185,129,0.24)]"
      : shouldDimBottomLoser || shouldDimBottomForWinnerFocus
        ? "border-white/10 bg-black/10 opacity-78"
        : "border-white/10 bg-black/10 opacity-78"
    : isBottomSeatActive
      ? "border-amber-300/42 bg-black/10 shadow-[0_0_20px_rgba(251,191,36,0.14)]"
      : "border-white/10 bg-black/8 opacity-85";
  const showBottomActionDock = showActionDock && (canDrop || canSpread || canHit);
  const showBottomReadyButton = isRoundEnd && isContinuousMode && !isSpectator && !isQueuedForNextRound && hasCurrentPlayer;
  const shouldShiftBottomReadyDockForWinner = showBottomReadyButton && shouldHeroBottomWinner;
  const bottomReadyDockWinnerOffsetPx = shouldShiftBottomReadyDockForWinner
    ? winnerPanelLayouts.bottom.width + PANEL_MARGIN_FROM_CARDS + (isPhoneLandscapeLayout ? 8 : 12)
    : 0;
  const bottomSeatSideColumnClass = isPhoneLandscapeLayout ? "w-[148px]" : "w-[182px]";
  const phoneHandCardClass =
    visibleHand.length >= 6
      ? "w-[3.2rem] h-[4.75rem]"
      : visibleHand.length >= 5
        ? "w-[3.45rem] h-[5.1rem]"
        : visibleHand.length >= 4
          ? "w-[3.65rem] h-[5.35rem]"
          : "w-[3.9rem] h-[5.7rem]";
  const desktopHandCardClass =
    visibleHand.length >= 6
      ? "h-[6.7rem] w-[4.55rem] sm:h-[7.1rem] sm:w-[4.8rem]"
      : visibleHand.length >= 5
        ? "h-[6.95rem] w-[4.75rem] sm:h-[7.35rem] sm:w-[5.05rem]"
        : "h-[7.2rem] w-[4.95rem] sm:h-[7.65rem] sm:w-[5.25rem]";
  const handOverlapPx = isPhoneLandscapeLayout
    ? visibleHand.length >= 6
      ? 18
      : visibleHand.length >= 5
        ? 16
        : 13
    : visibleHand.length >= 6
      ? 26
      : visibleHand.length >= 5
        ? 23
        : 19;
  const handFanLiftStep = isPhoneLandscapeLayout ? 6 : 8.25;
  const handRotateStep = isPhoneLandscapeLayout ? 3.75 : 4.75;
  const handSelectedLiftPx = isPhoneLandscapeLayout ? 24 : 32;
  const handHoverLiftPx = isPhoneLandscapeLayout ? 16 : 22;
  const handTouchPaddingX = isPhoneLandscapeLayout ? 8 : 12;
  const handTouchPaddingTop = isPhoneLandscapeLayout ? 8 : 12;
  const handTouchPaddingBottom = isPhoneLandscapeLayout ? 10 : 14;
  const showBottomHand = !isRoundEnd && visibleHand.length > 0;
  const handReorderThresholdPx = Math.max(30, handOverlapPx * 1.15);
  const handleHandCardDragEnd = (card: CardType, info: PanInfo, allowDiscardFlick: boolean) => {
    if (allowDiscardFlick && handleFlickDiscard(card, info)) {
      return;
    }

    if (!canReorderHand || !tableId || !user || !displayedBottomPlayer) {
      return;
    }

    if (Math.abs(info.offset.x) < handReorderThresholdPx || Math.abs(info.offset.x) <= Math.abs(info.offset.y)) {
      return;
    }

    lastHandDragAtRef.current = Date.now();
    const draggedCardId = getCardId(card);
    const draggedNode = handCardRefs.current[draggedCardId];
    if (!draggedNode) {
      return;
    }

    const draggedRect = draggedNode.getBoundingClientRect();
    const projectedCenterX = draggedRect.left + draggedRect.width / 2 + info.offset.x;
    const otherCardIds = visibleHand
      .map(getCardId)
      .filter((cardId) => cardId !== draggedCardId);

    const insertAt = otherCardIds.findIndex((cardId) => {
      const node = handCardRefs.current[cardId];
      if (!node) {
        return false;
      }

      const rect = node.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      return projectedCenterX < centerX;
    });

    const nextHandOrder =
      insertAt === -1
        ? [...otherCardIds, draggedCardId]
        : [
            ...otherCardIds.slice(0, insertAt),
            draggedCardId,
            ...otherCardIds.slice(insertAt),
          ];
    const currentHandOrder = visibleHand.map(getCardId);

    if (nextHandOrder.every((cardId, index) => cardId === currentHandOrder[index])) {
      return;
    }

    markActionActivity();
    reorderHand(tableId, user._id, nextHandOrder);
  };
  const getRevealGroupsForPlayer = (player: typeof gameState.players[number] | null | undefined) => {
    if (!player) return [];

    const revealGroups = player.spreads.map(sortSpreadCards);
    if (player.hand.length > 0) {
      revealGroups.push([...player.hand]);
    }

    return revealGroups;
  };
  const revealedWinnerGroups = isRoundEnd ? getRevealGroupsForPlayer(winnerPlayer) : [];
  const getSeatForPlayer = (playerId?: string | null): "top" | "left" | "right" | "bottom" | null => {
    if (!playerId) return null;
    if (topPlayer?.userId === playerId) return "top";
    if (leftPlayer?.userId === playerId) return "left";
    if (rightPlayer?.userId === playerId) return "right";
    if (displayedBottomPlayer?.userId === playerId || currentPlayer?.userId === playerId || user?._id === playerId) {
      return "bottom";
    }
    return null;
  };
  const winningSeat = getSeatForPlayer(winnerPlayer?.userId);
  const seatPlayerByZone: Record<SeatZone, typeof gameState.players[number] | null> = {
    top: topPlayer,
    left: leftPlayer,
    right: rightPlayer,
    bottom: displayedBottomPlayer ?? null,
  };
  winnerPanelMeasurementRef.current = {
    enabled: isRoundEnd && showWinnerSpotlight,
    winnerZones: (Object.entries(seatPlayerByZone) as Array<[SeatZone, typeof gameState.players[number] | null]>)
      .filter(([, player]) => !!player && !!roundResultByUserId.get(player.userId)?.isWinner)
      .map(([zone]) => zone),
    layoutByZone: winnerPanelLayouts,
  };

  const renderSpreadZone = (
    player: typeof gameState.players[number] | null,
    zone: SeatZone,
    layout: SpreadZoneLayout
  ) => {
    if (hideCardsForPresentation) return null;
    if (!player || player.spreads.length === 0) return null;
    const sortedSpreads = player.spreads.map(sortSpreadCards);
    const isWinningSeat = isRoundEnd && player.userId === winnerPlayer?.userId;
    if (isRoundEnd && isWinningSeat) return null;
    const isSideZone = zone === "left" || zone === "right";
    const isBottomZone = zone === "bottom";
    const spreadLayoutClass =
      sortedSpreads.length <= 1
        ? "flex justify-center"
        : isSideZone
          ? "grid grid-cols-1"
          : sortedSpreads.length === 2
            ? "grid grid-cols-2"
            : "grid grid-cols-2";
    return (
      <div
        className={`absolute pointer-events-none ${layout.positionClass}`}
        style={{ zIndex: CARD_LAYER_Z_INDEX }}
      >
          <div
            className={`${spreadLayoutClass} items-start justify-center ${layout.laneClass}`}
          >
          {sortedSpreads.map((spread, sIdx) => (
            <motion.div
              key={`${player.userId}-spread-${sIdx}`}
              className={`relative flex min-h-[56px] items-end justify-center px-1.5 py-1.5 ${
                isHitMode
                  ? "pointer-events-auto cursor-pointer rounded-[22px] ring-1 ring-amber-300/45 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
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
                    marginLeft: cIdx === 0 ? 0 : `-${
                      isBottomZone
                        ? isPhoneLandscapeLayout
                          ? 13
                          : spread.length >= 5
                            ? 18
                            : 15
                        : isPhoneLandscapeLayout
                          ? 16
                          : spread.length >= 5
                            ? 22
                            : 18
                    }px`,
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
                      isBottomZone
                        ? spread.length >= 5
                          ? spreadCardClass.bottomCompact
                          : spreadCardClass.bottomRegular
                        : spread.length >= 5
                          ? spreadCardClass.compact
                          : spreadCardClass.regular
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

  const renderSeatContext = (
    player: typeof gameState.players[number] | null,
    zone: SeatZone
  ) => {
    if (!isRoundEnd || !player || isRoundEndGlobalPhase) return null;
    const roundSeatResult = roundResultByUserId.get(player.userId);
    const showWinnerSummary = showWinnerSpotlight && !!roundSeatResult?.isWinner;
    const showReveal =
      player.userId === winnerPlayer?.userId &&
      showWinnerSummary &&
      revealedWinnerGroups.length > 0 &&
      winningSeat === zone;
    const panelPosition = winnerPanelPositions[zone];
    if (!showWinnerSummary || !panelPosition || !roundSeatResult) return null;

    const layout = winnerPanelLayouts[zone];
    const justifyClass = layout.alignClass.includes("right") ? "justify-end" : "justify-start";

    return (
      <motion.div
        className="pointer-events-none absolute"
        style={{
          left: `${panelPosition.left}px`,
          top: `${panelPosition.top}px`,
          width: `${layout.width}px`,
          zIndex: PANEL_LAYER_Z_INDEX,
        }}
        initial={{ opacity: 0, y: zone === "bottom" ? 10 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div
          className="rounded-[18px] border border-emerald-200/36 bg-[linear-gradient(145deg,rgba(15,61,44,0.88),rgba(8,15,16,0.78))] px-2.5 py-2 text-white shadow-[0_18px_34px_rgba(16,185,129,0.18)] backdrop-blur-[10px]"
          style={{ minHeight: `${layout.minHeight}px` }}
        >
          <div className={`flex flex-wrap items-center gap-1.5 ${justifyClass}`}>
            <div className="inline-flex rounded-full border border-white/14 bg-white/8 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.24em] text-white/80">
              Winning Hand
            </div>
            <div className="inline-flex rounded-full border border-emerald-200/34 bg-emerald-300/12 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
              {roundSeatResult.statusLabel}
            </div>
          </div>
          <div className={`mt-1.5 flex flex-col gap-1 ${layout.alignClass}`}>
            <div className={`${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} text-white/76`}>
              Score: <span className="font-semibold text-white">{roundSeatResult.infoScoreLabel}</span>
            </div>
            <div className={`${isPhoneLandscapeLayout ? "text-[10px]" : "text-[11px]"} font-semibold text-emerald-200`}>
              {roundSeatResult.deltaLabel}
            </div>
          </div>
          {showReveal ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {revealedWinnerGroups.map((spread, spreadIndex) => (
                <motion.div
                  key={`reveal-lane-${spreadIndex}`}
                  className={`flex items-end ${layout.cardsJustifyClass}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut", delay: spreadIndex * 0.05 }}
                >
                  {spread.map((card, cardIndex) => (
                    <motion.div
                      key={`${card.rank}-${card.suit}-${cardIndex}`}
                      className="origin-bottom"
                      style={{
                        marginLeft: cardIndex === 0 ? 0 : `-${isPhoneLandscapeLayout ? 12 : 16}px`,
                        zIndex: cardIndex + 1,
                      }}
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.28, ease: "easeOut", delay: 0.02 * cardIndex }}
                    >
                      <CardComponent
                        suit={card.suit}
                        rank={card.rank}
                        className={isPhoneLandscapeLayout ? "h-[2.4rem] w-[1.7rem]" : "h-[3.4rem] w-[2.38rem]"}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>
      </motion.div>
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
                  ? "w-full h-full rounded-[18px]"
                  : "aspect-[16/9] rounded-[28px] w-[96vw]"
              } overflow-hidden shadow-[0_28px_54px_rgba(0,0,0,0.4)] ${isReem ? "rt-reem-burst" : ""}`}
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
              <div className={`absolute z-50 ${globalHudBandClass}`}>
                <div className="mx-auto flex max-w-[1180px] items-start justify-between gap-3">
                  <div
                    className={`flex min-w-0 items-center rounded-full border border-white/10 bg-black/26 text-white shadow-[0_14px_28px_rgba(0,0,0,0.24)] backdrop-blur-[8px] ${
                      isPhoneLandscapeLayout ? "gap-1.5 px-2.5 py-1.5" : "gap-2.5 px-3.5 py-2"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="absolute -inset-1 rounded-full bg-amber-300/20 blur-lg" />
                      <img
                        src={logoSrc}
                        alt="ReemTeam logo"
                        className={`relative object-contain ${isPhoneLandscapeLayout ? "h-5 w-5" : "h-6 w-6"}`}
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
                        <div className="text-[9px] uppercase tracking-[0.28em] text-white/52">Digital Table</div>
                      ) : null}
                    </div>
                  </div>

                  <div className={`ml-auto flex flex-col items-end gap-2 ${systemHudStackWidthClass}`}>
                    <div className={`flex ${isPhoneLandscapeLayout ? "flex-wrap justify-end gap-1.5" : "items-center justify-end gap-2"} w-full`}>
                      <div
                        className={`flex items-center rounded-full border border-white/10 bg-black/24 text-white shadow-[0_12px_26px_rgba(0,0,0,0.2)] ${
                          isPhoneLandscapeLayout ? "gap-1 px-2 py-1 text-[10px]" : "gap-2 px-3 py-1.5 text-[10px]"
                        }`}
                      >
                        {!isPhoneLandscapeLayout ? (
                          <span className="text-[9px] uppercase tracking-[0.24em] text-white/55">Players</span>
                        ) : null}
                        <span className="font-bold">
                          {isPhoneLandscapeLayout ? "P " : ""}
                          {gameState.players.length}/{maxPlayers}
                        </span>
                      </div>
                      <div
                        className={`flex items-center rounded-full border border-white/10 bg-black/24 text-white shadow-[0_12px_26px_rgba(0,0,0,0.2)] ${
                          isPhoneLandscapeLayout ? "gap-1 px-2 py-1 text-[10px]" : "gap-2 px-3 py-1.5 text-[10px]"
                        }`}
                      >
                        {!isPhoneLandscapeLayout ? (
                          <span className="text-[9px] uppercase tracking-[0.24em] text-white/55">Table Pot</span>
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

                    <div className={`flex flex-col items-end gap-2 ${systemHudMessageWidthClass}`}>
                      <AnimatePresence initial={false}>
                        {routineHudMessage ? (
                          <motion.div
                            key={`${routineHudMessage.eyebrow}-${routineHudMessage.title}-${routineHudMessage.detail ?? ""}`}
                            initial={{ opacity: 0, y: -8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.24, ease: "easeOut" }}
                            className={`pointer-events-none relative w-full overflow-hidden rounded-[20px] border px-3 py-2 text-white backdrop-blur-[10px] ${routineHudToneClass}`}
                          >
                            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_45%)]" aria-hidden />
                            <div className="relative flex items-start gap-2.5">
                              <div className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${routineHudIndicatorClass}`} aria-hidden />
                              <div className="min-w-0">
                                <div className="text-[8px] font-semibold uppercase tracking-[0.26em] text-white/58">
                                  {routineHudMessage.eyebrow}
                                </div>
                                <div className={`${isPhoneLandscapeLayout ? "text-[11px]" : "text-[13px]"} mt-1 font-semibold leading-tight text-white`}>
                                  {routineHudMessage.title}
                                </div>
                                {routineHudMessage.detail ? (
                                  <div className={`${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} mt-1 leading-snug text-white/72`}>
                                    {routineHudMessage.detail}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </motion.div>
                        ) : null}
                        {isRoundEndGlobalPhase ? (
                          <motion.div
                            key={`round-global-${roundPresentationKey}`}
                            initial={{ opacity: 0, y: -10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ duration: 0.28, ease: "easeOut" }}
                            className={`pointer-events-none w-full rounded-[22px] border px-4 py-3 text-white backdrop-blur-[10px] ${roundStatusBannerClass}`}
                          >
                            <div className={`text-[8px] font-semibold uppercase tracking-[0.26em] ${roundMomentHeadlineClass}`}>
                              ROUND OVER
                            </div>
                            <div className={`${isPhoneLandscapeLayout ? "mt-1 text-[13px]" : "mt-1 text-[16px]"} font-semibold text-white`}>
                              {roundOutcome.headline}
                            </div>
                            {roundOutcomeSummary ? (
                              <div className={`${isPhoneLandscapeLayout ? "mt-1 text-[9px]" : "mt-1 text-[10px]"} leading-snug text-white/74`}>
                                {roundOutcomeSummary}
                              </div>
                            ) : null}
                          </motion.div>
                        ) : null}
                        {showCompactCountdownStrip ? (
                          <motion.div
                            key={`round-strip-${roundPresentationKey}`}
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.24, ease: "easeOut" }}
                            className={`pointer-events-none w-full rounded-[22px] border px-4 py-3 text-white backdrop-blur-[8px] ${countdownStripClass}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className={`text-[8px] font-semibold uppercase tracking-[0.26em] ${countdownHeadlineClass}`}>
                                  Run It Back
                                </div>
                                <div className={`${isPhoneLandscapeLayout ? "mt-1 text-[11px]" : "mt-1 text-[13px]"} font-semibold text-white`}>
                                  {runItBackPrompt}
                                </div>
                                <div className={`${isPhoneLandscapeLayout ? "text-[9px]" : "text-[10px]"} mt-1 text-white/70`}>
                                  {roundCountdownStatusLine || roundRailStatusLabel}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[8px] uppercase tracking-[0.22em] text-white/52">Lock In</div>
                                <div className={`${isPhoneLandscapeLayout ? "text-[13px]" : "text-[15px]"} mt-1 font-semibold text-white`}>
                                  {readyCount}/{totalRoundPlayers}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(251,191,36,0.9),rgba(74,222,128,0.9))]"
                                style={{ width: `${Math.max(8, roundReadyProgress * 100)}%` }}
                              />
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {readyStatusChips.map((entry) => (
                                <div
                                  key={`ready-${entry.userId}`}
                                  className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] ${
                                    entry.ready
                                      ? "border-emerald-200/32 bg-emerald-300/10 text-emerald-100"
                                      : "border-white/12 bg-white/[0.04] text-white/62"
                                  }`}
                                >
                                  {entry.username} {entry.ready ? "locked" : entry.isAI ? "auto" : "thinking"}
                                </div>
                              ))}
                            </div>

                            {roundCountdownMetaLine ? (
                              <div className={`${isPhoneLandscapeLayout ? "mt-2 text-[8px]" : "mt-2 text-[9px]"} text-white/62`}>
                                {roundCountdownMetaLine}
                              </div>
                            ) : null}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0" style={{ zIndex: PANEL_LAYER_Z_INDEX }}>
                {renderSeatInfo(topPlayer, "top", playerHudLayouts.top)}
                {renderSeatInfo(leftPlayer, "left", playerHudLayouts.left)}
                {renderSeatInfo(rightPlayer, "right", playerHudLayouts.right)}
                <div className={`absolute flex items-end ${bottomSeatHudAnchorClass} ${shouldDimBottomForWinnerFocus ? "opacity-50 saturate-75" : ""}`}>
                  <div className={`${bottomSeatSideColumnClass} flex-shrink-0`}>
                    <div
                      ref={(node) => setSeatPanelRef("bottom", node)}
                      className={`${
                        isBottomSeatActive ? "active-seat" : "inactive-seat"
                      } relative w-full rounded-[22px] border transition-all duration-300 ${
                        isPhoneLandscapeLayout ? "px-2.5 py-2.5" : "px-3 py-3"
                      } ${bottomSeatShellClass}`}
                    >
                      {isBottomSeatActive && !isRoundEnd ? (
                        <div className="absolute -inset-2 rounded-[24px] bg-amber-300/10 blur-xl" aria-hidden />
                      ) : null}
                      {shouldHeroBottomWinner ? (
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
                            key={`${displayedBottomPlayer?.userId ?? user._id}:${turnTimerCycleKey}:bottom`}
                            duration={turnDurationMs}
                            timeRemaining={isBottomSeatActive ? turnTimeRemainingMs : turnDurationMs}
                            isActive={isBottomSeatActive}
                            size={isPhoneLandscapeLayout ? 44 : 58}
                            strokeWidth={isPhoneLandscapeLayout ? 2.7 : 3.6}
                            className={isBottomSeatActive ? "animate-pulse" : ""}
                          />
                        </div>
                        <div className="min-w-0">
                          {!isRoundEnd ? (
                            <div
                              className={`mb-1 inline-flex rounded-full border px-2 py-0.5 font-semibold tracking-[0.2em] ${
                                isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                              } ${turnStatusClasses[myTurnStatus]}`}
                            >
                              {myTurnStatus}
                            </div>
                          ) : null}
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
                          {!isRoundEnd ? renderSeatPresenceBadges(bottomSeatPresenceBadges, "left") : null}
                          {!isRoundEnd ? (
                            <div
                              className={`${
                                isPhoneLandscapeLayout ? "text-[8px]" : "text-[9px]"
                              } mt-0.5 leading-tight uppercase tracking-[0.14em] text-white/62 drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)]`}
                            >
                              {visibleHand.length} cards
                            </div>
                          ) : bottomSeatRoundResult ? renderSeatResultState(bottomSeatRoundResult, "left") : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {showBottomActionDock || showBottomReadyButton ? (
                    <div
                      className={`pointer-events-auto flex flex-col ${
                        isPhoneLandscapeLayout ? "w-[82px] gap-1.5 pb-1" : "w-[92px] gap-1.5 pb-1"
                      }`}
                      style={
                        bottomReadyDockWinnerOffsetPx > 0
                          ? { marginLeft: `${bottomReadyDockWinnerOffsetPx}px` }
                          : undefined
                      }
                    >
                      {showBottomActionDock ? (
                        <div className="rounded-[22px] border border-white/12 bg-black/18 p-1.5 shadow-[0_14px_28px_rgba(0,0,0,0.22)] backdrop-blur-[4px]">
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
                            hideDisabled
                          />
                        </div>
                      ) : null}
                      {showBottomReadyButton ? (
                        <Button
                          onClick={handlePutIn}
                          variant="primary"
                          size="sm"
                          disabled={isReadyForNextRound}
                          className={`w-full ${isPhoneLandscapeLayout ? "h-9 px-2 text-[10px]" : "h-10 px-2.5 text-[10px]"}`}
                        >
                          {isReadyForNextRound ? "Locked In" : waitingPlayerCount <= 1 ? "Run It Back" : "Stay In"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0" style={{ zIndex: PANEL_LAYER_Z_INDEX }}>
                {renderSeatContext(topPlayer, "top")}
                {renderSeatContext(leftPlayer, "left")}
                {renderSeatContext(rightPlayer, "right")}
                {renderSeatContext(displayedBottomPlayer ?? null, "bottom")}
                <RtcParticleOverlay
                  gameState={gameState}
                  winnerPlayerId={winnerPlayer?.userId}
                  winnerRoundNet={winnerRoundNet}
                  tableRef={tableRef}
                  seatAnchorRefs={seatAnchorRefs}
                  displayFont={displayFont}
                  isPhoneLandscapeLayout={isPhoneLandscapeLayout}
                />
              </div>

              <div className="absolute inset-0" style={{ zIndex: CARD_LAYER_Z_INDEX }}>
                {renderSpreadZone(topPlayer, "top", spreadZoneLayouts.top)}
                {renderSpreadZone(leftPlayer, "left", spreadZoneLayouts.left)}
                {renderSpreadZone(rightPlayer, "right", spreadZoneLayouts.right)}
                {renderSpreadZone(displayedBottomPlayer ?? null, "bottom", spreadZoneLayouts.bottom)}

              {showDealAnimation && (
                <div className="absolute inset-0 z-40 pointer-events-none">
                  {shufflePhase ? (
                    <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <motion.div
                          key={`shuffle-${idx}`}
                          className={`absolute ${dealAnimationCardClass} rounded-lg border border-white/20 shadow-xl`}
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
                        className={`${dealAnimationCardClass} rounded-lg border border-white/20 shadow-xl`}
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
                          className={`${dealAnimationCardClass} rounded-lg border border-white/20 shadow-xl`}
                          style={{ backgroundImage: `url(${backCardImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
                          initial={{ rotate: -16, scale: 0.95, opacity: 0.9 }}
                          animate={{ rotate: 16, scale: 1.02, opacity: 1 }}
                          transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.35 }}
                        />
                      </div>
                      {Array.from({ length: totalCardsToDeal || 20 }).map((_, idx) => (
                        <motion.div
                          key={`deal-${idx}`}
                          className={`absolute left-1/2 top-1/2 ${dealAnimationCardClass} rounded-md border border-white/20`}
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

              <div
                className={`pointer-events-auto absolute left-1/2 z-50 ${
                  isPhoneLandscapeLayout ? "top-[49%]" : "top-[50%]"
                } -translate-x-1/2 -translate-y-1/2`}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`flex items-center ${isPhoneLandscapeLayout ? "gap-3.5" : "gap-5.5"}`}>
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
                      <div className={`relative ${centerPileCardClass}`}>
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
                      <div className={`relative ${centerPileCardClass}`}>
                        {!hideCardsForPresentation && gameState.discardPile.length > 0 ? (
                          <CardComponent
                            suit={gameState.discardPile[gameState.discardPile.length - 1].suit}
                            rank={gameState.discardPile[gameState.discardPile.length - 1].rank}
                            className={centerPileCardClass}
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
                </div>
              </div>

              {showBottomHand ? (
                <div className="absolute -translate-x-1/2" style={{ ...bottomHandAnchor, zIndex: CARD_LAYER_Z_INDEX }}>
                  <div className="flex w-full flex-col items-center">
                    <div
                      className={`hand relative w-full pointer-events-auto ${feedbackPulseArea === "hand" ? "rt-table-shake" : ""} ${
                        isPhoneLandscapeLayout ? "mt-1 h-[146px]" : "mt-1 h-[196px]"
                      }`}
                    >
                      <div
                        className={`pointer-events-none absolute inset-x-8 top-7 h-14 rounded-full blur-2xl ${
                          isDiscardStep
                            ? "bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_72%)]"
                            : isMyTurn
                              ? "bg-[radial-gradient(circle,rgba(125,211,252,0.14),transparent_72%)]"
                              : "bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_72%)]"
                        }`}
                      />
                      <AnimatePresence>
                        {showHandReorderHint ? (
                          <motion.div
                            key="hand-reorder-hint"
                            className={`pointer-events-none absolute left-1/2 z-[90] -translate-x-1/2 rounded-full border border-amber-200/35 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-50 shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur-[8px] ${
                              isPhoneLandscapeLayout ? "top-0" : "top-1"
                            }`}
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                          >
                            <span className="mr-2 text-amber-200">{"<->"}</span>
                            Slide cards to arrange
                          </motion.div>
                        ) : null}
                        <motion.div
                          className={`flex flex-nowrap items-end justify-center overflow-visible ${isPhoneLandscapeLayout ? "px-2 pt-5" : "px-3 pt-6"}`}
                          animate={showHandReorderHint ? { x: [0, 12, -10, 0] } : { x: 0 }}
                          transition={showHandReorderHint ? { duration: 1.25, repeat: 2, ease: "easeInOut" } : { duration: 0.2 }}
                        >
                          {visibleHand.map((card, cardIndex) => {
                            const isSelectedCard = selectedCards.some(
                              (c) => c.rank === card.rank && c.suit === card.suit
                            );
                            const isIllegalDiscardSelection =
                              isSelectedCard && isDiscardStep && isRestrictedDiscardCard(card);
                            const enableFlickDrag =
                              canUseFlickDiscard && isSelectedCard && !isIllegalDiscardSelection;
                            const enableReorderDrag = canReorderHand;
                            const centerOffset = cardIndex - (visibleHand.length - 1) / 2;
                            const fanLift = Math.abs(centerOffset) * handFanLiftStep;
                            const baseRotate = centerOffset * handRotateStep;

                            return (
                              <motion.div
                                key={`${card.rank}-${card.suit}`}
                                ref={(node) => setHandCardRef(getCardId(card), node)}
                                className="card origin-bottom relative flex items-end justify-center touch-manipulation"
                                style={{
                                  marginLeft: cardIndex === 0 ? 0 : `-${handOverlapPx}px`,
                                  paddingLeft: `${handTouchPaddingX}px`,
                                  paddingRight: `${handTouchPaddingX}px`,
                                  paddingTop: `${handTouchPaddingTop}px`,
                                  paddingBottom: `${handTouchPaddingBottom}px`,
                                  zIndex: isSelectedCard ? 60 + cardIndex : cardIndex + 1,
                                }}
                                initial={{ y: 36, opacity: 0, rotate: 0 }}
                                animate={{
                                  y: isSelectedCard ? -(fanLift + handSelectedLiftPx) : -fanLift,
                                  rotate: isSelectedCard ? baseRotate * 0.6 : baseRotate,
                                  scale: isSelectedCard ? 1.08 : 1,
                                  opacity: 1,
                                }}
                                exit={{ y: -20, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                                onClick={isSpectator ? undefined : () => toggleCardSelection(card)}
                                whileHover={
                                  isMyTurn
                                    ? { y: -(fanLift + handHoverLiftPx), scale: 1.05 }
                                    : undefined
                                }
                                whileTap={isMyTurn ? { scale: 0.985 } : undefined}
                                drag={enableFlickDrag ? true : enableReorderDrag ? "x" : false}
                                dragElastic={enableFlickDrag ? 0.24 : enableReorderDrag ? 0.12 : 0}
                                dragMomentum={enableFlickDrag}
                                dragSnapToOrigin
                                onDragEnd={
                                  enableFlickDrag || enableReorderDrag
                                    ? (_, info) => handleHandCardDragEnd(card, info, enableFlickDrag)
                                    : undefined
                                }
                              >
                                {showHandReorderHint && cardIndex === Math.min(1, visibleHand.length - 1) ? (
                                  <motion.div
                                    className="pointer-events-none absolute inset-x-2 bottom-3 z-[95] rounded-[14px] border border-amber-200/55 shadow-[0_0_18px_rgba(251,191,36,0.36)]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0.35, 0.95, 0.35] }}
                                    transition={{ duration: 1.1, repeat: 3, ease: "easeInOut" }}
                                  />
                                ) : null}
                                <div
                                  className={`pointer-events-none absolute inset-x-3 bottom-4 rounded-full blur-2xl transition-opacity ${
                                    isSelectedCard
                                      ? "bg-[radial-gradient(circle,rgba(251,191,36,0.3),transparent_72%)] opacity-100"
                                      : isMyTurn
                                        ? "bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_72%)] opacity-80"
                                        : "opacity-0"
                                  } ${isPhoneLandscapeLayout ? "h-10" : "h-12"}`}
                                />
                                <CardComponent
                                  suit={card.suit}
                                  rank={card.rank}
                                  isSelected={isSelectedCard}
                                  className={isPhoneLandscapeLayout ? phoneHandCardClass : desktopHandCardClass}
                                  badgeText={
                                    isIllegalDiscardSelection
                                      ? "Cannot discard this card this turn."
                                      : undefined
                                  }
                                  badgeTone="danger"
                                />
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

    </div>
  );
};

export default GameTable;
