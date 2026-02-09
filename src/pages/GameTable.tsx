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
  
  const otherPlayers = gameState.players.filter(p => p.userId !== user._id);

  const getPositionClass = (index: number, total: number) => {
    if (total === 1) return 'top-0 left-1/2 -translate-x-1/2 mt-4'; // Top Center
    if (total === 2) return index === 0 ? 'top-1/2 left-0 -translate-y-1/2 ml-4' : 'top-1/2 right-0 -translate-y-1/2 mr-4'; // Left & Right
    if (total === 3) {
      if (index === 0) return 'top-1/2 left-0 -translate-y-1/2 ml-4';
      if (index === 1) return 'top-0 left-1/2 -translate-x-1/2 mt-4';
      if (index === 2) return 'top-1/2 right-0 -translate-y-1/2 mr-4';
    }
    return '';
  };

  const isReem = gameState.status === 'round-end' && gameState.roundEndedBy === 'REEM';
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const isFocusMode = isMyTurn || selectedCards.length > 0;

  return (
    <div className="game-table-root relative">
      <div className="fixed inset-0 z-0" aria-hidden>
        <div
          className={`absolute inset-0 transition-all duration-500 ${isFocusMode ? "scale-[1.02] blur-[1px]" : ""}`}
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.5)), url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,199,74,0.22),transparent_55%)]" />
        <div className={`absolute inset-0 transition-all duration-500 ${isFocusMode ? "bg-black/35 backdrop-blur-sm" : "bg-black/15"}`} />
      </div>
      <div className={`game-table-shell relative z-10 w-full h-[100dvh] rounded-lg border-[16px] transition-colors duration-500 shadow-2xl overflow-hidden mt-4 ${isReem ? 'border-yellow-400 animate-pulse' : 'border-[#3b2c12]'}`}>
        <div className="game-table-brand absolute top-6 left-6 z-50 flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-yellow-400/20 blur-xl" />
            <img src={logoSrc} alt="ReemTeam logo" className="relative w-10 h-10 object-contain" />
          </div>
          <div>
            <div className="text-white text-lg font-bold tracking-wide" style={{ fontFamily: displayFont }}>ReemTeam</div>
            <div className="text-white/60 text-xs uppercase tracking-[0.3em]">Tonk Arena</div>
          </div>
        </div>
        <div className="game-table-stats absolute top-6 right-6 z-50 flex flex-col items-end gap-2">
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

        <div className="game-table-center absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-8 pointer-events-none z-20">
            <Pot amount={gameState.pot} />
            <div className="flex gap-12 pointer-events-auto">
              <div className="game-table-pile relative w-24 h-36">
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
              <div className="game-table-pile relative w-24 h-36" onClick={handleDiscardPileClick}>
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
            <TurnTimer timeLeft={15} maxTime={30}/>
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

        {otherPlayers.map((player, idx) => {
          const isCurrentTurnPlayer = gameState.players[gameState.currentPlayerIndex]?.userId === player.userId;
          return (
          <div
            key={player.userId}
            className={`absolute ${getPositionClass(idx, otherPlayers.length)} transition-all duration-500`}
          >
            <div className={`p-2 rounded-xl ${isCurrentTurnPlayer ? 'ring-2 ring-yellow-400/80 bg-yellow-400/10' : 'ring-1 ring-white/10 bg-black/10'}`}>
              <PlayerAvatar player={{ name: player.username, avatarUrl: '' }} />
              <div className="text-white font-bold mt-2">${player.currentBuyIn}</div>
            </div>
            <div className="bg-black/20 p-2 rounded-xl flex flex-col gap-2">
              {player.spreads.map((spread, sIdx) => (
                <div
                  key={sIdx}
                  className={`flex -space-x-8 hover:scale-105 transition-transform cursor-pointer ${isHitMode ? 'ring-4 ring-yellow-400 rounded-lg p-1 bg-yellow-400/20' : ''}`}
                  onClick={() => isHitMode && executeHit(player.userId, sIdx)}
                >
                  {spread.map((card, cIdx) => (
                    <CardComponent key={cIdx} suit={card.suit} rank={card.rank} className="game-table-spread-card w-10 h-14 sm:w-12 sm:h-16 text-[10px]" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
        })}

        <div className="game-table-log absolute top-20 left-6 z-30 w-64 max-w-[70vw] bg-black/40 text-white/80 text-xs rounded-xl border border-white/10 backdrop-blur-sm p-3">
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

        <div className={`game-table-me absolute bottom-32 left-6 z-30 p-2 rounded-xl ${isMyTurn ? 'ring-4 ring-yellow-400/70 shadow-[0_0_24px_rgba(250,204,21,0.45)] bg-yellow-400/10' : 'ring-1 ring-white/10 bg-black/20'}`}>
          <PlayerAvatar player={{ name: user.username, avatarUrl: user.avatarUrl || '' }} size="sm" />
          <div className="text-white text-xs font-bold mt-2">You</div>
          <div className="text-yellow-400 text-xs">${currentPlayer?.currentBuyIn ?? 0}</div>
        </div>
        
        <div className="game-table-spreads absolute bottom-32 right-8 flex flex-col items-end gap-2 max-h-[50vh] overflow-y-auto pr-2 pointer-events-auto z-20">
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
                        <CardComponent key={cIdx} suit={card.suit} rank={card.rank} className="game-table-spread-card w-12 h-16" />
                          ))}
                        </div>
                    ))}
                  </div>
               </div>
             )}
        </div>

        <div className="game-table-hand absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
          <div className="game-table-hand-zone mx-auto max-w-5xl w-full px-4 sm:px-6 pb-3 pt-4 pointer-events-auto">
            <div className="game-table-hand-shell rounded-2xl border border-white/10 bg-black/45 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.45)] px-4 py-3">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="game-table-hand-title text-[11px] uppercase tracking-[0.3em] text-white/60">Your Hand</div>
                <div className="game-table-hand-hint text-[11px] text-white/40">Tap cards to select</div>
              </div>
              <Card className={`p-2 ${isMyTurn ? 'ring-4 ring-yellow-400/60 shadow-[0_0_24px_rgba(250,204,21,0.25)]' : ''}`}>
                <div className="game-table-hand-cards flex -space-x-10 sm:-space-x-12 items-end h-32 sm:h-40 pb-2 pointer-events-auto">
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
                        className="game-table-hand-card w-16 h-24 sm:w-20 sm:h-28"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                </div>
              </Card>
              <div className="h-14 flex items-center justify-center pointer-events-auto mt-3">
                {isMyTurn && (
                  <Card className="game-table-action-card p-2">
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
    </div>
    </div>
  );
};

export default GameTable;
