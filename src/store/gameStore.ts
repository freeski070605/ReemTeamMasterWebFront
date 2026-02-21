import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { IGameState, Card, RoundResult } from '../types/game';
import { toast } from 'react-toastify';

const BACKEND_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

interface GameStore {
  socket: Socket | null;
  gameState: IGameState | null;
  lastRoundResult: RoundResult | null;
  isConnected: boolean;
  error: string | null;

  connect: (
    tableId: string,
    userId: string,
    username: string,
    avatarUrl?: string,
    contestId?: string
  ) => void;
  disconnect: () => void;
  
  // Actions
  leaveTable: (tableId: string, userId: string, username: string) => void;
  drawCard: (tableId: string, userId: string, source: 'deck' | 'discard') => void;
  discardCard: (tableId: string, userId: string, card: Card) => void;
  spread: (tableId: string, userId: string, cards: Card[]) => void;
  hit: (tableId: string, userId: string, card: Card, targetPlayerId: string, targetSpreadIndex: number) => void;
  drop: (tableId: string, userId: string) => void;
  requestLeaveTable: (tableId: string, userId: string) => void;
  putIn: (tableId: string, userId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  gameState: null,
  lastRoundResult: null,
  isConnected: false,
  error: null,

  connect: (tableId, userId, username, avatarUrl, contestId) => {
    const existingSocket = get().socket;
    if (existingSocket) {
        existingSocket.disconnect();
    }

    const socket = io(BACKEND_URL);
    let lastRoundEndTimestamp: number | null = null;
    let activeRoundEndToastId: string | number | null = null;

    socket.on('connect', () => {
      console.log('Connected to game server');
      set({ isConnected: true, error: null });
      console.log(`Emitting joinTable for ${username} (${userId}) in table ${tableId}`);
      socket.emit('joinTable', { tableId, userId, username, avatarUrl, contestId });
    });

    socket.on('initialGameState', (gameState: IGameState) => {
      console.log('Received initialGameState:', gameState);
      set({ gameState });
    });

    socket.on('gameStateUpdate', (gameState: IGameState) => {
      console.log('Received gameStateUpdate:', gameState);
      set({ gameState });
      
      // Check for round end and notify
      if (gameState.status === 'round-end') {
          const roundEndTimestamp = gameState.lastAction?.timestamp ?? Date.now();
          if (lastRoundEndTimestamp === roundEndTimestamp) {
            return;
          }
          lastRoundEndTimestamp = roundEndTimestamp;
          const winnerPlacement = (gameState.placements ?? []).find((placement) => placement.rank === 1);
          const winner = winnerPlacement
            ? gameState.players.find((player) => player.userId === winnerPlacement.userId)
            : gameState.players.find((player) => player.userId === gameState.roundWinnerId);

          if (gameState.roundEndedBy === 'REEM') {
              toast.success(`${winner?.username} REEMED!`);
          } else if (gameState.roundEndedBy === 'REGULAR') {
               toast.info(`${winner?.username} wins on lowest hand.`);
          } else if (gameState.roundEndedBy === 'DECK_EMPTY') {
              toast.info(`Deck empty. ${winner?.username} wins on lowest hand.`);
          }
          if (activeRoundEndToastId !== null) {
            toast.dismiss(activeRoundEndToastId);
          }
          const isContinuousMode = !gameState.mode || gameState.mode === 'FREE_RTC_TABLE';
          if (isContinuousMode) {
            activeRoundEndToastId = toast.info("Next round starts in 30 seconds.", { autoClose: 30000 });
          } else {
            activeRoundEndToastId = toast.info("Match complete. Return to the lobby to start another session.", {
              autoClose: 5000,
            });
          }
      } else {
          if (activeRoundEndToastId !== null) {
            toast.dismiss(activeRoundEndToastId);
            activeRoundEndToastId = null;
          }
          lastRoundEndTimestamp = null;
      }
    });

    socket.on('roundResult', (roundResult: RoundResult) => {
      console.log('Received roundResult:', roundResult);
      set({ lastRoundResult: roundResult });
    });
    
    socket.on('tableUpdate', (data: { message: string, table: any, gameState?: IGameState }) => {
        if (data.message) toast.info(data.message);
        if (data.gameState) set({ gameState: data.gameState });
    });

    socket.on('gameError', (data: { message: string }) => {
      toast.error(data.message);
      set({ error: data.message });
    });

    socket.on('ackLeaveRequest', () => {
      toast.info("You will be removed from the table at the end of the round.");
    });

    socket.on('playerLeft', ({ userId: leftPlayerId }) => {
      const { gameState } = get();
      if (gameState && gameState.players.some(p => p.userId === leftPlayerId)) {
        // You might want to handle redirection here if the current user is the one who left.
        // This can be done by checking against the current user's ID from useAuthStore.
        // For now, just logging it.
        console.log(`Player ${leftPlayerId} has left the table.`);
      }
    });


    socket.on('disconnect', () => {
      console.log('Disconnected from game server');
      if (activeRoundEndToastId !== null) {
        toast.dismiss(activeRoundEndToastId);
        activeRoundEndToastId = null;
      }
      set({ isConnected: false });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, gameState: null, lastRoundResult: null, isConnected: false });
    }
  },

  leaveTable: (tableId, userId, username) => {
    const { socket } = get();
    if (socket) {
      socket.emit('leaveTable', { tableId, userId, username });
      // We don't disconnect here, we let the component handle navigation which will trigger cleanup
      // Or we can explicitly disconnect if we want to be sure
      set({ gameState: null });
    }
  },

  drawCard: (tableId, userId, source) => {
    const { socket } = get();
    if (socket) socket.emit('drawCard', { tableId, userId, source });
  },

  discardCard: (tableId, userId, card) => {
    const { socket } = get();
    if (socket) socket.emit('discardCard', { tableId, userId, card });
  },

  spread: (tableId, userId, cards) => {
    const { socket } = get();
    if (socket) socket.emit('spread', { tableId, userId, cards });
  },

  hit: (tableId, userId, card, targetPlayerId, targetSpreadIndex) => {
    const { socket } = get();
    if (socket) socket.emit('hit', { tableId, userId, card, targetPlayerId, targetSpreadIndex });
  },

  drop: (tableId, userId) => {
    const { socket } = get();
    if (socket) socket.emit('drop', { tableId, userId });
  },

  requestLeaveTable: (tableId, userId) => {
    const { socket } = get();
    if (socket) socket.emit('requestLeaveTable', { tableId, userId });
  },

  putIn: (tableId, userId) => {
    const { socket } = get();
    if (socket) socket.emit('putIn', { tableId, userId });
  },
}));
