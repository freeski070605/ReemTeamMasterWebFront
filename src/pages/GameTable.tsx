import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { Loader } from "../components/ui/Loader";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { Card as CardType } from "../types/game";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

import { PlayingCard as CardComponent, Card } from "../components/ui/Card";
import PlayerAvatar from "../components/game/PlayerAvatar";
import Pot from "../components/game/Pot";
import TurnTimer from "../components/game/TurnTimer";
import GameActions from "../components/game/GameActions";
import { Button } from "../components/ui/Button";
import bgImage from '../assets/bg.png';

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


  if (!isConnected || !gameState || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
        <Loader />
        <p className="mt-4 text-gray-400">Connecting to table...</p>
      </div>
    );
  }

  const currentPlayer = gameState.players.find((p) => p.userId === user._id);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.userId === user._id;

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
  const dealerId = gameState.players[gameState.currentDealerIndex]?.userId;

  const seatAt = (offset: number) => {
    if (offset >= totalPlayers) return null;
    const idx = (localIndex + offset) % totalPlayers;
    return gameState.players[idx] ?? null;
  };

  const rightPlayer = seatAt(1);
  const topPlayer = seatAt(2);
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
    const visible = Math.min(count, 5);
    const cardClass = size === "md" ? "w-12 h-16" : "w-10 h-14";
    const overlapClass = size === "md" ? "-space-x-6" : "-space-x-5";
    return (
      <div className="relative">
        <div className={`flex ${overlapClass}`}>
          {Array.from({ length: visible }).map((_, idx) => (
            <CardComponent
              key={`opp-card-${idx}`}
              suit="Spades"
              rank="Ace"
              isHidden
              className={cardClass}
            />
          ))}
        </div>
        <div className="absolute -bottom-2 -right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full border border-white/10">
          {count}
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0" aria-hidden>
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
      <div className={`relative z-10 w-full h-screen rounded-lg border-[16px] transition-colors duration-500 shadow-2xl overflow-hidden mt-4 ${isReem ? 'border-yellow-400 animate-pulse' : 'border-[#3b2c12]'}`}>
        <div className="flex items-start justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-yellow-400/20 blur-xl" />
              <img src={logoSrc} alt="ReemTeam logo" className="relative w-10 h-10 object-contain" />
            </div>
            <div>
              <div className="text-white text-lg font-bold tracking-wide" style={{ fontFamily: displayFont }}>ReemTeam</div>
              <div className="text-white/60 text-xs uppercase tracking-[0.3em]">Tonk Arena</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 bg-black/40 text-white text-xs px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
              <span className="uppercase tracking-widest text-[10px] text-white/60">Players</span>
              <span className="font-bold">{gameState.players.length}/{maxPlayers}</span>
            </div>
            <div className="flex items-center gap-2 bg-black/40 text-white text-xs px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
              <span className="uppercase tracking-widest text-[10px] text-white/60">Balance</span>
              <span className="font-bold">
                {balanceLoading ? "..." : balanceError ? "Error" : formatCurrency(balance)}
              </span>
            </div>
            <Button variant="danger" size="sm" onClick={handleLeaveTable}>Leave Table</Button>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(160px,1fr)_minmax(320px,2fr)_minmax(160px,1fr)] grid-rows-[auto_1fr_auto] gap-4 px-6 pb-6 h-[calc(100%-96px)]">
          <div className="col-start-2 row-start-1 flex flex-col items-center gap-2">
            <div className={`px-3 py-2 rounded-xl border ${topPlayer && gameState.players[gameState.currentPlayerIndex]?.userId === topPlayer.userId ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-white/10 bg-black/20'}`}>
              <div className="text-xs text-white font-semibold">{topPlayer?.username ?? "Waiting..."}</div>
              <div className="text-[10px] text-white/60">Cards: {topPlayer?.hand.length ?? 0}</div>
              <div className="text-[10px] text-white/60">Score: {topPlayer ? (gameState.handScores?.[topPlayer.userId] ?? "-") : "-"}</div>
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                {topPlayer?.userId === dealerId && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200">Dealer</span>}
                {topPlayer && gameState.players[gameState.currentPlayerIndex]?.userId === topPlayer.userId && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200">Turn</span>}
              </div>
            </div>
            {renderOpponentHand(topPlayer?.hand.length ?? 0, "sm")}
          </div>

          <div className="col-start-1 row-start-2 flex flex-col items-center gap-3">
            <div className={`px-3 py-2 rounded-xl border ${leftPlayer && gameState.players[gameState.currentPlayerIndex]?.userId === leftPlayer.userId ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-white/10 bg-black/20'}`}>
              <div className="text-xs text-white font-semibold">{leftPlayer?.username ?? "Waiting..."}</div>
              <div className="text-[10px] text-white/60">Cards: {leftPlayer?.hand.length ?? 0}</div>
              <div className="text-[10px] text-white/60">Score: {leftPlayer ? (gameState.handScores?.[leftPlayer.userId] ?? "-") : "-"}</div>
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                {leftPlayer?.userId === dealerId && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200">Dealer</span>}
                {leftPlayer && gameState.players[gameState.currentPlayerIndex]?.userId === leftPlayer.userId && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200">Turn</span>}
              </div>
            </div>
            {renderOpponentHand(leftPlayer?.hand.length ?? 0, "sm")}
            <div className="w-full max-w-[180px] bg-black/30 border border-white/10 rounded-lg p-2 text-xs text-white/70">
              <div className="uppercase tracking-widest text-[10px] text-white/60 mb-1">Action Log</div>
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
          </div>

          <div className="col-start-3 row-start-2 flex flex-col items-center gap-3">
            <div className={`px-3 py-2 rounded-xl border ${rightPlayer && gameState.players[gameState.currentPlayerIndex]?.userId === rightPlayer.userId ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-white/10 bg-black/20'}`}>
              <div className="text-xs text-white font-semibold">{rightPlayer?.username ?? "Waiting..."}</div>
              <div className="text-[10px] text-white/60">Cards: {rightPlayer?.hand.length ?? 0}</div>
              <div className="text-[10px] text-white/60">Score: {rightPlayer ? (gameState.handScores?.[rightPlayer.userId] ?? "-") : "-"}</div>
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                {rightPlayer?.userId === dealerId && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200">Dealer</span>}
                {rightPlayer && gameState.players[gameState.currentPlayerIndex]?.userId === rightPlayer.userId && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200">Turn</span>}
              </div>
            </div>
            {renderOpponentHand(rightPlayer?.hand.length ?? 0, "sm")}
          </div>

          <div className="col-start-2 row-start-2 flex flex-col items-center justify-center gap-6">
            <div className="flex w-full items-center justify-end gap-6 pr-6">
              <div className="flex flex-col items-center gap-2">
                <Pot amount={gameState.pot} />
                <TurnTimer timeLeft={15} maxTime={30} />
              </div>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-36">
                  {gameState.deck.length > 0 && (
                    <div
                      className={`w-full h-full bg-blue-800 rounded-lg border-2 border-white shadow-xl flex items-center justify-center cursor-pointer relative ${isMyTurn && !currentPlayer?.hasTakenActionThisTurn ? 'hover:scale-105 hover:ring-4 hover:ring-yellow-400 ring-4 ring-yellow-400 animate-pulse' : ''} transition-all`}
                      onClick={handleDeckClick}
                    >
                      <div className="text-white font-bold text-2xl">DECK</div>
                      {isMyTurn && !currentPlayer?.hasTakenActionThisTurn && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg pointer-events-none">
                          <span className="text-yellow-400 font-bold text-xl animate-bounce">DRAW</span>
                        </div>
                      )}
                      <div className="absolute -bottom-6 text-white text-xs font-bold">{gameState.deck.length}</div>
                    </div>
                  )}
                </div>
                <div className="relative w-24 h-36" onClick={handleDiscardPileClick}>
                  {gameState.discardPile.length > 0 ? (
                    <div className={`relative ${isMyTurn ? 'cursor-pointer hover:scale-105 transition-all' : ''} ${isMyTurn && ((!currentPlayer?.hasTakenActionThisTurn) || (currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1)) ? 'hover:ring-4 hover:ring-yellow-400 rounded-lg' : ''} ${isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1 ? 'animate-pulse' : ''}`}>
                      <CardComponent
                        suit={gameState.discardPile[gameState.discardPile.length - 1].suit}
                        rank={gameState.discardPile[gameState.discardPile.length - 1].rank}
                      />
                      {isMyTurn && !currentPlayer?.hasTakenActionThisTurn && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg pointer-events-none">
                          <span className="text-yellow-400 font-bold text-xl animate-bounce">DRAW</span>
                        </div>
                      )}
                      {isMyTurn && currentPlayer?.hasTakenActionThisTurn && (
                        <div className={`absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none ${selectedCards.length === 1 ? 'bg-green-500/40' : 'bg-black/20'}`}>
                          <span className="text-white font-bold text-sm text-center px-1 drop-shadow-md">
                            {selectedCards.length === 1 ? "DISCARD HERE" : "SELECT CARD"}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`w-full h-full border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/30 relative ${isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1 ? 'cursor-pointer hover:bg-white/10 ring-4 ring-green-400 animate-pulse' : ''}`}>
                      Discard
                      {isMyTurn && currentPlayer?.hasTakenActionThisTurn && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
                          <span className="text-white font-bold text-sm text-center px-1 drop-shadow-md">
                            {selectedCards.length === 1 ? "DISCARD HERE" : "SELECT CARD"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full max-w-2xl bg-black/25 border border-white/10 rounded-xl p-3">
              <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Spreads</div>
              <div className="space-y-2">
                {gameState.players.map((player) => (
                  <div key={player.userId} className="flex items-center gap-3">
                    <div className="text-xs text-white/70 w-20 truncate">{player.username}</div>
                    <div className="flex flex-wrap gap-3">
                      {player.spreads.length === 0 && (
                        <div className="text-[10px] text-white/40">No spreads</div>
                      )}
                      {player.spreads.map((spread, sIdx) => (
                        <div
                          key={`${player.userId}-spread-${sIdx}`}
                          className={`flex -space-x-6 cursor-pointer ${isHitMode ? 'ring-2 ring-yellow-400 rounded-lg p-1 bg-yellow-400/10' : ''}`}
                          onClick={() => isHitMode && executeHit(player.userId, sIdx)}
                        >
                          {spread.map((card, cIdx) => (
                            <CardComponent key={cIdx} suit={card.suit} rank={card.rank} className="w-10 h-14 text-[10px]" />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-start-1 row-start-3 flex items-end">
            {isMyTurn && (
              <Card className="p-2">
                <div className="flex flex-col gap-2">
                  <GameActions 
                    canDrop={!!(isMyTurn && !currentPlayer?.hasTakenActionThisTurn)}
                    canSpread={!!(isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length >= 3)}
                    canHit={!!(isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1)}
                    onDrop={handleDrop}
                    onSpread={handleSpread}
                    onHit={handleHitClick}
                    orientation="vertical"
                  />
                </div>
              </Card>
            )}
          </div>

          <div className="col-start-2 row-start-3 flex flex-col items-center gap-2">
            <div className={`px-3 py-2 rounded-xl border ${isMyTurn ? 'border-yellow-400/80 bg-yellow-400/10' : 'border-white/10 bg-black/20'}`}>
              <div className="text-xs text-white font-semibold">{user.username}</div>
              <div className="text-[10px] text-white/60">Cards: {currentPlayer?.hand.length ?? 0}</div>
              <div className="text-[10px] text-white/60">Score: {currentPlayer ? (gameState.handScores?.[currentPlayer.userId] ?? "-") : "-"}</div>
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                {currentPlayer?.userId === dealerId && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200">Dealer</span>}
                {isMyTurn && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-200">Turn</span>}
              </div>
            </div>
            <Card className={`p-2 ${isMyTurn ? 'ring-4 ring-yellow-400/70 shadow-[0_0_30px_rgba(250,204,21,0.35)]' : ''}`}>
              <div className="flex -space-x-10 sm:-space-x-12 items-end h-32 sm:h-40 pb-2">
                <AnimatePresence>
                  {currentPlayer?.hand.map((card) => (
                    <motion.div
                      key={`${card.rank}-${card.suit}`}
                      layout
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -50, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                      <CardComponent
                        suit={card.suit}
                        rank={card.rank}
                        isSelected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)}
                        onClick={() => toggleCardSelection(card)}
                        className="w-16 h-24 sm:w-20 sm:h-28"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>
          </div>
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


        <div className="absolute top-20 left-6 z-30 w-64 max-w-[70vw] bg-black/40 text-white/80 text-xs rounded-xl border border-white/10 backdrop-blur-sm p-3">
          <div className="uppercase tracking-widest text-[10px] text-white/60 mb-2">Action Log</div>
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

        <div className={`absolute bottom-32 left-6 z-30 p-2 rounded-xl ${isMyTurn ? 'ring-4 ring-yellow-400/70 shadow-[0_0_24px_rgba(250,204,21,0.45)] bg-yellow-400/10' : 'ring-1 ring-white/10 bg-black/20'}`}>
          <PlayerAvatar player={{ name: user.username, avatarUrl: user.avatarUrl || '' }} size="sm" />
          <div className="text-white text-xs font-bold mt-2">You</div>
          <div className="text-yellow-400 text-xs">${currentPlayer?.currentBuyIn ?? 0}</div>
        </div>
        
        <div className="absolute bottom-32 right-8 flex flex-col items-end gap-2 max-h-[50vh] overflow-y-auto pr-2 pointer-events-auto z-20">
             {(currentPlayer?.spreads?.length ?? 0) > 0 && (
               <div className="bg-black/20 p-3 rounded-xl backdrop-blur-sm">
                  <h3 className="text-white/50 text-xs font-bold uppercase mb-2 text-right">My Spreads</h3>
                  <div className="flex flex-col gap-3">
                    {currentPlayer?.spreads.map((spread, sIdx) => (
                        <div
                          key={sIdx}
                          className={`flex -space-x-8 cursor-pointer ${isHitMode ? 'ring-4 ring-yellow-400 rounded-lg p-1 bg-yellow-400/20' : ''}`}
                          onClick={() => isHitMode && executeHit(user._id, sIdx)}
                        >
                          {spread.map((card, cIdx) => (
                            <CardComponent key={cIdx} suit={card.suit} rank={card.rank} className="w-12 h-16" />
                          ))}
                        </div>
                    ))}
                  </div>
               </div>
             )}
        </div>

        <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1 z-30 pointer-events-none">
            <Card className={`p-2 ${isMyTurn ? 'ring-4 ring-yellow-400/70 shadow-[0_0_30px_rgba(250,204,21,0.35)]' : ''}`}>
              <div className="flex -space-x-10 sm:-space-x-12 items-end h-32 sm:h-40 pb-2 pointer-events-auto">
                <AnimatePresence>
                  {currentPlayer?.hand.map((card) => (
                    <motion.div
                      key={`${card.rank}-${card.suit}`}
                      layout
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -50, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                      <CardComponent
                        suit={card.suit}
                        rank={card.rank}
                        isSelected={selectedCards.some(c => c.rank === card.rank && c.suit === card.suit)}
                        onClick={() => toggleCardSelection(card)}
                        className="w-16 h-24 sm:w-20 sm:h-28"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>
            <div className="h-12 flex items-center justify-center pointer-events-auto">
              {isMyTurn && (
                <Card className="p-2">
                    <GameActions 
                        canDrop={!!(isMyTurn && !currentPlayer?.hasTakenActionThisTurn)}
                        canSpread={!!(isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length >= 3)}
                        canHit={!!(isMyTurn && currentPlayer?.hasTakenActionThisTurn && selectedCards.length === 1)}
                        onDrop={handleDrop}
                        onSpread={handleSpread}
                        onHit={handleHitClick}
                    />
                </Card>
              )}
            </div>
        </div>
    </div>
    </div>
  );
};

export default GameTable;
