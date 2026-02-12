import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { Loader } from "../components/ui/Loader";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { Card as CardType } from "../types/game";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

import { PlayingCard as CardComponent } from "../components/ui/Card";
import PlayerAvatar from "../components/game/PlayerAvatar";
import Pot from "../components/game/Pot";
import TurnTimer from "../components/game/TurnTimer";
import GameActions from "../components/game/GameActions";
import { Button } from "../components/ui/Button";
import bgImage from '../assets/bg.png';
import backCardImage from "../assets/cards/back.png";

const GameTable: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
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
  const prevTurnStateRef = useRef<{ isMyTurn: boolean; hasTakenAction: boolean }>({
    isMyTurn: false,
    hasTakenAction: false,
  });
  const lastAnimatedRoundKeyRef = useRef<string | null>(null);
  const maxPlayers = 4;
  const {
    balance,
    loading: balanceLoading,
    error: balanceError,
    refresh: refreshBalance,
  } = useWalletBalance({ refreshIntervalMs: 15000 });

  useEffect(() => {
    if (tableId && user) {
      connect(tableId, user._id, user.username, user.avatarUrl);
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
  }, [tableId, user, connect, disconnect, navigate]);

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

    const roundEndAt = gameState.lastAction?.timestamp ?? Date.now();
    const roundRestartAt = roundEndAt + 30000;

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((roundRestartAt - Date.now()) / 1000));
      setRoundCountdownSeconds(remaining);
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => {
      window.clearInterval(interval);
    };
  }, [gameState?.status, gameState?.lastAction?.timestamp]);

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
  useEffect(() => {
    if (!currentPlayer) return;
    const prev = prevTurnStateRef.current;
    if (isMyTurn && !currentPlayer.hasTakenActionThisTurn && (!prev.isMyTurn || prev.hasTakenAction)) {
      toast.info("Your turn: draw from the deck or discard pile.");
    }
    prevTurnStateRef.current = {
      isMyTurn,
      hasTakenAction: currentPlayer.hasTakenActionThisTurn,
    };
  }, [isMyTurn, currentPlayer]);

  if (!isConnected || !gameState || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
        <Loader />
        <p className="mt-4 text-gray-400">Connecting to table...</p>
      </div>
    );
  }

  const toggleCardSelection = (card: CardType) => {
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

  const handleDeckClick = () => {
    if (isMyTurn && !currentPlayer?.hasTakenActionThisTurn) {
      if (tableId && user) {
        drawCard(tableId, user._id, "deck");
      }
    }
  };

  const handleDiscardPileClick = () => {
    if (!isMyTurn) return;

    if (!currentPlayer?.hasTakenActionThisTurn) {
      if (gameState.discardPile.length === 0) {
        toast.error("Discard pile is empty!");
        return;
      }
      if (tableId && user) {
        drawCard(tableId, user._id, "discard");
      }
    } else {
      if (selectedCards.length !== 1) {
        toast.error("Select exactly one card to discard.");
        return;
      }
      if (tableId && user) {
        discardCard(tableId, user._id, selectedCards[0]);
        setSelectedCards([]);
      }
    }
  };

  const handleSpread = () => {
    if (selectedCards.length < 3) {
      toast.error("A spread must have at least 3 cards.");
      return;
    }
    if (tableId && user) {
      spread(tableId, user._id, selectedCards);
      setSelectedCards([]);
    }
  };

  const handleHitClick = () => {
    if (selectedCards.length !== 1) {
      toast.error("Select one card to hit with.");
      return;
    }
    setIsHitMode(true);
    toast.info("Select a spread to hit.");
  };

  const executeHit = (targetPlayerId: string, targetSpreadIndex: number) => {
    if (selectedCards.length !== 1) return;
    if (tableId && user) {
      hit(tableId, user._id, selectedCards[0], targetPlayerId, targetSpreadIndex);
      setIsHitMode(false);
      setSelectedCards([]);
    }
  };

  const handleDrop = () => {
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
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };
  const getPayout = (userId: string) => {
    return gameState.payouts?.[userId] ?? 0;
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
    return (
      <div className={`absolute z-20 pointer-events-none ${className}`}>
        <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
          {renderOpponentHand(getVisibleCardCount(player.userId, player.hand.length), "sm")}
          <div className={`px-2 py-1 rounded-lg border ${isActive ? "border-yellow-400/80 bg-yellow-400/10" : "border-white/10 bg-black/35"} min-w-[110px]`}>
            <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
              <PlayerAvatar player={{ name: player.username, avatarUrl: player.avatarUrl }} size="sm" />
              <div>
                <div className="text-[11px] text-white font-semibold leading-tight">{player.username}</div>
                <div className="text-[10px] text-white/60 leading-tight">
                  Cards: {getVisibleCardCount(player.userId, player.hand.length)}
                </div>
                <div className="text-[10px] text-yellow-300 leading-tight">
                  {playerBalances[player.userId] !== undefined ? formatCurrency(playerBalances[player.userId]) : "--"}
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
  const canDrawFromDeck =
    isMyTurn && !currentPlayer?.hasTakenActionThisTurn && !hideCardsForPresentation;

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
                    <span className="uppercase tracking-widest text-[9px] text-white/60">Balance</span>
                    <span className="font-bold">
                      {balanceLoading ? "..." : balanceError ? "Error" : formatCurrency(balance)}
                    </span>
                  </div>
                  <Button variant="danger" size="sm" onClick={handleLeaveTable}>Leave</Button>
                </div>
              </div>

              {renderSeatInfo(topPlayer, "top-2 left-[58%] -translate-x-1/2", "left")}
              {renderSeatInfo(leftPlayer, "left-[1.5%] top-1/2 -translate-y-1/2", "left")}
              {renderSeatInfo(rightPlayer, "right-[1.5%] top-1/2 -translate-y-1/2", "right")}

              {renderSpreadZone(topPlayer, "Top Spread", "left-1/2 top-[20%] -translate-x-1/2 w-[30%] max-w-[260px]")}
              {renderSpreadZone(leftPlayer, "Left Spread", "left-[5%] top-[44%] -translate-y-1/2 w-[19%] max-w-[170px]")}
              {renderSpreadZone(rightPlayer, "Right Spread", "right-[5%] top-[44%] -translate-y-1/2 w-[19%] max-w-[170px]")}
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
                        className={`w-full h-full rounded-lg border border-white/20 shadow-xl flex items-center justify-center relative transition-transform ${canDrawFromDeck ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-90'}`}
                        style={{
                          backgroundImage: `url(${backCardImage})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        onClick={() => {
                          if (canDrawFromDeck) handleDeckClick();
                        }}
                      >
                      </div>
                    )}
                  </div>
                  <Pot amount={gameState.pot} />
                  <div
                    className="relative w-8 h-12 sm:w-10 sm:h-14"
                    onClick={() => {
                      if (!hideCardsForPresentation) handleDiscardPileClick();
                    }}
                  >
                    {!hideCardsForPresentation && gameState.discardPile.length > 0 ? (
                      <div className={`relative ${isMyTurn ? 'cursor-pointer hover:scale-105 transition-all' : ''} ${isMyTurn && ((!currentPlayer?.hasTakenActionThisTurn) || (currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1)) ? 'hover:ring-4 hover:ring-yellow-400 rounded-lg' : ''} ${isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1 ? 'animate-pulse' : ''}`}>
                        <CardComponent
                          suit={gameState.discardPile[gameState.discardPile.length - 1].suit}
                          rank={gameState.discardPile[gameState.discardPile.length - 1].rank}
                          className="w-8 h-12 sm:w-10 sm:h-14"
                        />
                      </div>
                    ) : !hideCardsForPresentation ? (
                      <div className={`w-full h-full border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/30 relative ${isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1 ? 'cursor-pointer hover:bg-white/10 ring-4 ring-green-400 animate-pulse' : ''}`}>
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
                        <div className="text-[11px] text-white font-semibold leading-tight">{user.username}</div>
                        <div className="text-[10px] text-white/60 leading-tight">Cards: {visibleHand.length}</div>
                        <div className="text-[10px] text-yellow-300 leading-tight">
                          {balanceLoading ? "..." : formatCurrency(balance)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center">
                    <div className="hand relative h-24 w-full max-w-[700px] pointer-events-auto">
                      <AnimatePresence>
                        <div className="flex flex-nowrap items-end justify-center gap-1 sm:gap-1.5">
                          {visibleHand.map((card) => (
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
                                isSelected={selectedCards.some((c) => c.rank === card.rank && c.suit === card.suit)}
                                onClick={() => toggleCardSelection(card)}
                                className="w-10 h-14 sm:w-11 sm:h-16"
                              />
                            </motion.div>
                          ))}
                        </div>
                      </AnimatePresence>
                    </div>

                    {isMyTurn && !hideCardsForPresentation && (
                      <div className="actions flex gap-1.5 mt-1 pointer-events-auto [&_button]:min-w-[64px] [&_button]:h-8 [&_button]:text-xs">
                        <GameActions
                          canDrop={!!(isMyTurn && !currentPlayer?.hasTakenActionThisTurn)}
                          canSpread={!!(isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length >= 3)}
                          canHit={!!(isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1)}
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
              <Button onClick={handleRequestLeaveTable} variant="danger" size="sm">Leave</Button>
            </div>
            <div className="mt-1 text-[11px] text-yellow-300">
              Next round starts in {roundCountdownSeconds ?? 30}s
            </div>
            <div className="mt-2 text-sm text-green-400 font-bold">
              Winner: {gameState.players.find((p) => p.userId === gameState.roundWinnerId)?.username || "Unknown"}
              {gameState.payouts && gameState.roundWinnerId && (
                <span className="text-yellow-300 ml-1">{getPayout(gameState.roundWinnerId) >= 0 ? "+" : ""}${getPayout(gameState.roundWinnerId)}</span>
              )}
            </div>
            {gameState.handScores && (
              <div className="mt-2 max-h-[42vh] overflow-auto rounded-lg border border-white/10 bg-black/35">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-white/50 grid grid-cols-[1.4fr_0.5fr_0.6fr] gap-2">
                  <span>Player</span>
                  <span>Score</span>
                  <span>Payout</span>
                </div>
                <div className="divide-y divide-white/10">
                  {gameState.players.map((player) => (
                    <div
                      key={player.userId}
                      className={`px-2 py-1.5 grid grid-cols-[1.4fr_0.5fr_0.6fr] gap-2 items-center text-xs ${player.userId === gameState.roundWinnerId ? "bg-green-500/10" : ""}`}
                    >
                      <div className="truncate text-white">{player.username}</div>
                      <div className="font-mono text-white/80">{gameState.handScores?.[player.userId] ?? "-"}</div>
                      <div className={`font-mono ${getPayout(player.userId) >= 0 ? "text-green-300" : "text-red-300"}`}>
                        {getPayout(player.userId) >= 0 ? "+" : "-"}${Math.abs(getPayout(player.userId))}
                      </div>
                    </div>
                  ))}
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
