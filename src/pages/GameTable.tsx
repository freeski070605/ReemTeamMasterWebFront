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
  const [actionLog, setActionLog] = useState<string[]>([]);
  const prevTurnStateRef = useRef<{ isMyTurn: boolean; hasTakenAction: boolean }>({
    isMyTurn: false,
    hasTakenAction: false,
  });
  const maxPlayers = 4;
  const {
    balance,
    loading: balanceLoading,
    error: balanceError,
    refresh: refreshBalance,
  } = useWalletBalance({ refreshIntervalMs: 15000 });

  useEffect(() => {
    if (tableId && user) {
      connect(tableId, user._id, user.username);
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
      if (payload.userId !== user._id) return;
      window.dispatchEvent(new Event("wallet-balance-refresh"));
    };

    socket.on("walletBalanceUpdate", handleWalletBalanceUpdate);
    return () => {
      socket.off("walletBalanceUpdate", handleWalletBalanceUpdate);
    };
  }, [socket, user?._id]);

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

  const pushLog = (message: string) => {
    setActionLog((prev) => {
      const next = [message, ...prev];
      return next.slice(0, 6);
    });
  };

  const handleDeckClick = () => {
    if (isMyTurn && !currentPlayer?.hasTakenActionThisTurn) {
      if (tableId && user) {
        drawCard(tableId, user._id, "deck");
        pushLog("You drew from the deck.");
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
        pushLog("You drew from the discard pile.");
      }
    } else {
      if (selectedCards.length !== 1) {
        toast.error("Select exactly one card to discard.");
        return;
      }
      if (tableId && user) {
        discardCard(tableId, user._id, selectedCards[0]);
        setSelectedCards([]);
        pushLog("You discarded a card.");
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
      pushLog(`You spread ${selectedCards.length} cards.`);
    }
  };

  const handleHitClick = () => {
    if (selectedCards.length !== 1) {
      toast.error("Select one card to hit with.");
      return;
    }
    setIsHitMode(true);
    toast.info("Select a spread to hit.");
    pushLog("Hit mode enabled.");
  };

  const executeHit = (targetPlayerId: string, targetSpreadIndex: number) => {
    if (selectedCards.length !== 1) return;
    if (tableId && user) {
      hit(tableId, user._id, selectedCards[0], targetPlayerId, targetSpreadIndex);
      setIsHitMode(false);
      setSelectedCards([]);
      pushLog("You hit a spread.");
    }
  };

  const handleDrop = () => {
    if (tableId && user) {
      drop(tableId, user._id);
      pushLog("You dropped.");
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

  const isReem = gameState.status === 'round-end' && gameState.roundEndedBy === 'REEM';
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const renderOpponentHand = (count: number, size: "sm" | "md" = "sm") => {
    if (count <= 0) {
      return <div className="text-xs text-white/40">No cards</div>;
    }
    const cardClass = size === "md" ? "w-12 h-18" : "w-10 h-16";
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

  const hand = currentPlayer?.hand ?? [];

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
        <div className="game-wrapper flex-1 relative overflow-hidden touch-manipulation">
          <div className="table-area relative w-full h-full flex items-center justify-center">
            <div
              className={`table relative w-[96vw] max-w-[820px] aspect-[16/9] rounded-[28px] border-[12px] shadow-2xl overflow-hidden bg-black/20 [@media(orientation:portrait)]:w-[94vw] [@media(orientation:portrait)]:max-w-[520px] [@media(orientation:portrait)]:aspect-[3/4] [@media(orientation:portrait)]:rounded-[24px] ${isReem ? 'border-yellow-400 animate-pulse' : 'border-[#3b2c12]'}`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.06),transparent_60%)]" />
              <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 [@media(orientation:portrait)]:flex-col [@media(orientation:portrait)]:items-stretch [@media(orientation:portrait)]:gap-1">
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
                <div className="flex items-center gap-2 [@media(orientation:portrait)]:w-full [@media(orientation:portrait)]:justify-between">
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

              {topPlayer && (
                <div className="seat absolute w-[34vw] max-w-[240px] h-[110px] flex items-center justify-center pointer-events-none top-1 left-1/2 -translate-x-1/2 [@media(orientation:portrait)]:top-14">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`px-2 py-1 rounded-lg border ${gameState.players[gameState.currentPlayerIndex]?.userId === topPlayer.userId ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-white/10 bg-black/30'}`}>
                      <div className="text-[11px] text-white font-semibold">{topPlayer.username}</div>
                      <div className="text-[10px] text-white/60">Cards: {topPlayer.hand.length}</div>
                    </div>
                    <div className="opponent-cards transform scale-75">
                      {renderOpponentHand(topPlayer.hand.length, "sm")}
                    </div>
                  </div>
                </div>
              )}

              {leftPlayer && (
                <div className="seat absolute w-[34vw] max-w-[240px] h-[110px] flex items-center justify-center pointer-events-none left-[-8%] top-1/2 -translate-y-1/2 [@media(orientation:portrait)]:left-[-4%] [@media(orientation:portrait)]:top-[38%]">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`px-2 py-1 rounded-lg border ${gameState.players[gameState.currentPlayerIndex]?.userId === leftPlayer.userId ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-white/10 bg-black/30'}`}>
                      <div className="text-[11px] text-white font-semibold">{leftPlayer.username}</div>
                      <div className="text-[10px] text-white/60">Cards: {leftPlayer.hand.length}</div>
                    </div>
                    <div className="opponent-cards transform scale-75">
                      {renderOpponentHand(leftPlayer.hand.length, "sm")}
                    </div>
                  </div>
                </div>
              )}

              {rightPlayer && (
                <div className="seat absolute w-[34vw] max-w-[240px] h-[110px] flex items-center justify-center pointer-events-none right-[-8%] top-1/2 -translate-y-1/2 [@media(orientation:portrait)]:right-[-4%] [@media(orientation:portrait)]:top-[38%]">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`px-2 py-1 rounded-lg border ${gameState.players[gameState.currentPlayerIndex]?.userId === rightPlayer.userId ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-white/10 bg-black/30'}`}>
                      <div className="text-[11px] text-white font-semibold">{rightPlayer.username}</div>
                      <div className="text-[10px] text-white/60">Cards: {rightPlayer.hand.length}</div>
                    </div>
                    <div className="opponent-cards transform scale-75">
                      {renderOpponentHand(rightPlayer.hand.length, "sm")}
                    </div>
                  </div>
                </div>
              )}

              <div className="center-pile absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 [@media(orientation:portrait)]:top-[44%]">
                <div className="flex flex-col items-center gap-2">
                  <Pot amount={gameState.pot} />
                  <TurnTimer timeLeft={15} maxTime={30} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-10 h-16 sm:w-12 sm:h-18">
                    {gameState.deck.length > 0 && (
                      <div
                        className={`w-full h-full rounded-lg border border-white/20 shadow-xl flex items-center justify-center cursor-pointer relative transition-transform ${isMyTurn && !currentPlayer?.hasTakenActionThisTurn ? 'hover:scale-105' : ''}`}
                        style={{
                          backgroundImage: `url(${backCardImage})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        onClick={handleDeckClick}
                      >
                        <div className="absolute -bottom-5 text-white text-[10px] font-bold">{gameState.deck.length}</div>
                      </div>
                    )}
                  </div>
                  <div className="relative w-10 h-16 sm:w-12 sm:h-18" onClick={handleDiscardPileClick}>
                    {gameState.discardPile.length > 0 ? (
                      <div className={`relative ${isMyTurn ? 'cursor-pointer hover:scale-105 transition-all' : ''} ${isMyTurn && ((!currentPlayer?.hasTakenActionThisTurn) || (currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1)) ? 'hover:ring-4 hover:ring-yellow-400 rounded-lg' : ''} ${isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1 ? 'animate-pulse' : ''}`}>
                        <CardComponent
                          suit={gameState.discardPile[gameState.discardPile.length - 1].suit}
                          rank={gameState.discardPile[gameState.discardPile.length - 1].rank}
                        />
                      </div>
                    ) : (
                      <div className={`w-full h-full border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/30 relative ${isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1 ? 'cursor-pointer hover:bg-white/10 ring-4 ring-green-400 animate-pulse' : ''}`}>
                        Discard
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="absolute left-3 bottom-3 w-40 bg-black/40 text-white/80 text-[10px] rounded-lg border border-white/10 backdrop-blur-sm p-2 pointer-events-none [@media(orientation:portrait)]:left-2 [@media(orientation:portrait)]:bottom-[34%] [@media(orientation:portrait)]:w-36">
                <div className="uppercase tracking-widest text-[9px] text-white/60 mb-1">Action Log</div>
                {actionLog.length === 0 ? (
                  <div className="text-white/40">No recent actions.</div>
                ) : (
                  <div className="space-y-1">
                    {actionLog.map((item, idx) => (
                      <div key={idx} className="truncate">{item}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="absolute left-1/2 bottom-6 -translate-x-1/2 w-[82%] max-w-[560px] bg-black/25 border border-white/10 rounded-xl p-2 [@media(orientation:portrait)]:bottom-[20%] [@media(orientation:portrait)]:w-[90%] [@media(orientation:portrait)]:max-w-[520px]">
                <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1 text-center">Spreads</div>
                <div className="space-y-1">
                  {gameState.players.map((player) => (
                    <div key={player.userId} className="flex items-center gap-2">
                      <div className="text-[10px] text-white/70 w-16 truncate">{player.username}</div>
                      <div className="flex flex-wrap gap-2">
                        {player.spreads.length === 0 && (
                          <div className="text-[9px] text-white/40">No spreads</div>
                        )}
                        {player.spreads.map((spread, sIdx) => (
                          <div
                            key={`${player.userId}-spread-${sIdx}`}
                            className={`flex -space-x-5 cursor-pointer ${isHitMode ? 'ring-2 ring-yellow-400 rounded-lg p-1 bg-yellow-400/10' : ''}`}
                            onClick={() => isHitMode && executeHit(player.userId, sIdx)}
                          >
                            {spread.map((card, cIdx) => (
                              <CardComponent key={cIdx} suit={card.suit} rank={card.rank} className="w-9 h-12 text-[9px]" />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="seat absolute w-[34vw] max-w-[240px] h-[110px] flex items-center justify-center bottom-[-10%] left-1/2 -translate-x-1/2 pointer-events-auto [@media(orientation:portrait)]:bottom-2 [@media(orientation:portrait)]:w-[80vw]">
                <div className="flex flex-col items-center gap-1 w-full">
                  <div className={`px-2 py-1 rounded-lg border ${isMyTurn ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-white/10 bg-black/30'}`}>
                    <div className="text-[11px] text-white font-semibold">{user.username}</div>
                    <div className="text-[10px] text-white/60">Cards: {hand.length}</div>
                  </div>

                  <div className="hand relative h-24 w-full max-w-[520px] pointer-events-auto [@media(orientation:portrait)]:max-w-[90vw]">
                    <AnimatePresence>
                      <div className="flex flex-wrap items-end justify-center gap-2 sm:gap-3 [@media(orientation:portrait)]:gap-1">
                        {hand.map((card) => (
                          <motion.div
                            key={`${card.rank}-${card.suit}`}
                            className="card"
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                          >
                            <CardComponent
                              suit={card.suit}
                              rank={card.rank}
                              isSelected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)}
                              onClick={() => toggleCardSelection(card)}
                              className="w-14 h-20 sm:w-16 sm:h-24 [@media(orientation:portrait)]:w-12 [@media(orientation:portrait)]:h-18"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isMyTurn && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-[520px]">
              <div className="bg-black/55 border border-white/10 rounded-2xl px-3 py-2 backdrop-blur-sm flex items-center justify-center gap-2">
                <GameActions
                  canDrop={!!(isMyTurn && !currentPlayer?.hasTakenActionThisTurn)}
                  canSpread={!!(isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length >= 3)}
                  canHit={!!(isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1)}
                  onDrop={handleDrop}
                  onSpread={handleSpread}
                  onHit={handleHitClick}
                />
              </div>
            </div>
          )}
        </div>

        {gameState.status === 'round-end' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl shadow-2xl border-2 border-yellow-500/50 max-w-lg w-full transform scale-100 transition-all">
              <h2 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 mb-6 text-center drop-shadow-lg">
                ROUND OVER
              </h2>
              <div className="space-y-6">
                <div className="text-center p-4 bg-black/40 rounded-xl border border-white/5">
                  <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Reason</p>
                  <p className="text-2xl font-bold text-white mb-4">
                    {gameState.roundEndedBy === 'REGULAR' && "Player Drop"}
                    {gameState.roundEndedBy === 'REEM' && "Reem!"}
                    {gameState.roundEndedBy === 'AUTO_TRIPLE' && "Automatic Win (41/<=11)"}
                    {gameState.roundEndedBy === 'DECK_EMPTY' && "Deck Empty"}
                    {gameState.roundEndedBy === 'CAUGHT_DROP' && "Caught Dropping"}
                  </p>
                  <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Winner</p>
                  <p className="text-3xl font-black text-green-400">
                    {gameState.players.find(p => p.userId === gameState.roundWinnerId)?.username || "Unknown"}
                    {gameState.payouts && gameState.roundWinnerId && (
                      <span className="text-xl text-yellow-400 ml-2">
                        +${gameState.payouts[gameState.roundWinnerId]}
                      </span>
                    )}
                  </p>
                </div>
                {gameState.handScores && (
                  <div className="bg-black/40 rounded-xl overflow-hidden border border-white/5">
                    <div className="bg-white/5 px-4 py-2 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">Player</span>
                      <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">Score</span>
                      {gameState.payouts && <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">Payout</span>}
                    </div>
                    <div className="divide-y divide-white/5">
                      {gameState.players.map(player => (
                        <div key={player.userId} className={`px-4 py-3 flex justify-between items-center ${player.userId === gameState.roundWinnerId ? 'bg-green-500/10' : ''}`}>
                          <div className="flex items-center gap-3">
                            <PlayerAvatar player={{ name: player.username, avatarUrl: '' }} size="sm" />
                            <div>
                              <span className={`font-medium ${player.userId === gameState.roundWinnerId ? 'text-green-400' : 'text-gray-300'}`}>
                                {player.username}
                              </span>
                              <div className="text-yellow-400">${player.currentBuyIn}</div>
                            </div>
                          </div>
                          <span className={`font-mono font-bold ${player.userId === gameState.roundWinnerId ? 'text-green-400' : 'text-gray-400'}`}>
                            {gameState.handScores?.[player.userId] ?? '-'}
                          </span>
                          {gameState.payouts && (
                            <span className={`font-mono font-bold ${gameState.payouts[player.userId] > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {gameState.payouts[player.userId] > 0 ? `+$${gameState.payouts[player.userId]}` : `-$${Math.abs(gameState.payouts[player.userId])}`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-center space-x-4">
                  <Button
                    onClick={() => {}}
                    className="px-8 py-3 text-lg font-bold"
                    disabled
                  >
                    Next round starts soon...
                  </Button>
                  <Button
                    onClick={handleRequestLeaveTable}
                    variant="danger"
                    className="px-8 py-3 text-lg font-bold"
                  >
                    Leave Table
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameTable;
