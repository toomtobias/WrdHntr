/**
 * WrdHntr Backend Server
 * Express + Socket.IO for real-time multiplayer word game
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  loadWordList,
  generateLetters,
  validateWord,
  calculateFreeForAllScore,
  calculateExclusiveScore,
  generateGameId,
  getWordListSize,
  findPossibleWords
} from './gameLogic.js';

const app = express();
const server = createServer(app);

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

// In-memory game storage
const games = new Map();

// Game structure:
// {
//   id: string,
//   mode: 'freeforall' | 'exclusive',
//   letters: string[],
//   letterCount: number,
//   minWordLength: number,
//   hostId: string,
//   players: Map<socketId, { id, name, score, connected }>,
//   claims: Map<word, { playerId, playerName, timestamp, score }>,
//   playerClaims: Map<playerId, Set<word>>, // Track claims per player (for freeforall)
//   status: 'waiting' | 'playing' | 'ended',
//   startTime: number | null,
//   timerInterval: NodeJS.Timeout | null
// }

const MAX_PLAYERS_PER_ROOM = 20;
const DEFAULT_GAME_DURATION = 60; // seconds

/**
 * Create a new game
 */
function createGame(options) {
  const id = generateGameId();
  const game = {
    id,
    mode: options.mode || 'freeforall',
    letters: generateLetters(options.letterCount || 15),
    letterCount: options.letterCount || 15,
    minWordLength: options.minWordLength || 3,
    duration: options.gameDuration || DEFAULT_GAME_DURATION,
    hostId: null,
    players: new Map(),
    claims: new Map(),
    playerClaims: new Map(),
    status: 'waiting',
    startTime: null,
    timerInterval: null
  };

  games.set(id, game);
  return game;
}

/**
 * Get serializable game state for clients
 * @param {object} game - The game object
 * @param {string} [forPlayerId] - If provided, filter claims for this player in free-for-all mode
 */
function getGameState(game, forPlayerId = null) {
  let claims;

  if (game.mode === 'freeforall' && forPlayerId) {
    // In free-for-all, only show the player's own claims
    claims = Array.from(game.claims.entries())
      .filter(([, claim]) => claim.playerId === forPlayerId)
      .map(([, claim]) => ({
        word: claim.word,
        playerId: claim.playerId,
        playerName: claim.playerName,
        timestamp: claim.timestamp,
        score: claim.score
      }));
  } else {
    // In exclusive mode, show all claims
    claims = Array.from(game.claims.entries()).map(([word, claim]) => ({
      word: claim.word || word,
      playerId: claim.playerId,
      playerName: claim.playerName,
      timestamp: claim.timestamp,
      score: claim.score
    }));
  }

  // Hide letters until game starts (prevent early peeking)
  const letters = game.status === 'waiting'
    ? game.letters.map(() => '?')
    : game.letters;

  return {
    id: game.id,
    mode: game.mode,
    letters,
    letterCount: game.letterCount,
    minWordLength: game.minWordLength,
    hostId: game.hostId,
    players: Array.from(game.players.entries()).map(([id, player]) => ({
      id,
      name: player.name,
      score: player.score,
      connected: player.connected
    })),
    claims,
    status: game.status,
    startTime: game.startTime,
    timeRemaining: game.startTime
      ? Math.max(0, game.duration - Math.floor((Date.now() - game.startTime) / 1000))
      : game.duration
  };
}

/**
 * Start the game timer
 */
function startGameTimer(game) {
  game.startTime = Date.now();
  game.status = 'playing';

  // Broadcast timer updates every second
  game.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
    const remaining = Math.max(0, game.duration - elapsed);

    io.to(game.id).emit('timer-update', { remaining });

    if (remaining <= 0) {
      endGame(game);
    }
  }, 1000);
}

/**
 * End the game
 */
function endGame(game) {
  if (game.timerInterval) {
    clearInterval(game.timerInterval);
    game.timerInterval = null;
  }

  game.status = 'ended';

  // Calculate final rankings
  const rankings = Array.from(game.players.entries())
    .map(([id, player]) => ({
      id,
      name: player.name,
      score: player.score
    }))
    .sort((a, b) => b.score - a.score);

  // Find all possible words (this might take a moment for large word lists)
  const possibleWords = findPossibleWords(game.letters, game.minWordLength);

  io.to(game.id).emit('game-ended', {
    rankings,
    claims: Array.from(game.claims.entries()).map(([word, claim]) => ({
      word: claim.word || word,
      playerId: claim.playerId,
      playerName: claim.playerName,
      timestamp: claim.timestamp,
      score: claim.score
    })),
    gameInfo: {
      mode: game.mode,
      letters: game.letters,
      minWordLength: game.minWordLength
    },
    possibleWords
  });
}

/**
 * Handle word submission with atomic operation for exclusive mode
 */
function submitWord(game, playerId, word) {
  const player = game.players.get(playerId);
  if (!player || game.status !== 'playing') {
    return { success: false, error: 'Spelet är inte aktivt' };
  }

  const upperWord = word.toUpperCase().trim();
  const elapsed = Math.floor((Date.now() - game.startTime) / 1000);

  // Validate the word
  const validation = validateWord(upperWord, game.letters, game.minWordLength);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Mode-specific logic
  if (game.mode === 'exclusive') {
    // Check if word already claimed (atomic check)
    if (game.claims.has(upperWord)) {
      return { success: false, error: 'Ordet är redan taget!' };
    }

    // Claim the word
    const score = calculateExclusiveScore(upperWord);
    game.claims.set(upperWord, {
      playerId,
      playerName: player.name,
      timestamp: elapsed,
      score
    });
    player.score += score;

    return { success: true, word: upperWord, score, totalScore: player.score };
  } else {
    // Free-for-all mode
    // Check if this player already claimed this word
    if (!game.playerClaims.has(playerId)) {
      game.playerClaims.set(playerId, new Set());
    }

    if (game.playerClaims.get(playerId).has(upperWord)) {
      return { success: false, error: 'Du har redan använt detta ord!' };
    }

    // Calculate and add score
    const score = calculateFreeForAllScore(upperWord, elapsed);
    game.playerClaims.get(playerId).add(upperWord);

    // Add to global claims list (multiple players can have same word)
    const claimKey = `${upperWord}-${playerId}`;
    game.claims.set(claimKey, {
      playerId,
      playerName: player.name,
      timestamp: elapsed,
      score,
      word: upperWord
    });
    player.score += score;

    return { success: true, word: upperWord, score, totalScore: player.score };
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create a new game
  socket.on('create-game', (options, callback) => {
    try {
      const game = createGame(options);
      callback({ success: true, gameId: game.id });
      console.log(`Game created: ${game.id} (mode: ${game.mode})`);
    } catch (error) {
      console.error('Error creating game:', error);
      callback({ success: false, error: 'Kunde inte skapa spelet' });
    }
  });

  // Join a game
  socket.on('join-game', ({ gameId, playerName }, callback) => {
    try {
      const game = games.get(gameId);

      if (!game) {
        return callback({ success: false, error: 'Spelet hittades inte' });
      }

      if (game.status === 'ended') {
        return callback({ success: false, error: 'Spelet är avslutat' });
      }

      if (game.players.size >= MAX_PLAYERS_PER_ROOM) {
        return callback({ success: false, error: 'Spelet är fullt' });
      }

      // Check if this socket is already in the game (React StrictMode double-call)
      if (game.players.has(socket.id)) {
        socket.join(gameId);
        socket.data.gameId = gameId;
        socket.data.playerName = playerName;
        return callback({
          success: true,
          gameState: getGameState(game, socket.id),
          isHost: socket.id === game.hostId
        });
      }

      // Check if name is already taken by another connected player
      for (const [, player] of game.players) {
        if (player.name.toLowerCase() === playerName.toLowerCase() && player.connected) {
          return callback({ success: false, error: 'Namnet är redan taget' });
        }
      }

      // Check for reconnection (same player name, disconnected)
      let isReconnect = false;
      for (const [existingId, player] of game.players) {
        if (player.name === playerName && !player.connected) {
          // Reconnection: update socket ID
          game.players.delete(existingId);
          player.connected = true;
          game.players.set(socket.id, player);
          isReconnect = true;
          break;
        }
      }

      if (!isReconnect) {
        // New player
        game.players.set(socket.id, {
          id: socket.id,
          name: playerName,
          score: 0,
          connected: true
        });
      }

      // First player becomes host
      if (game.hostId === null) {
        game.hostId = socket.id;
      }

      socket.join(gameId);
      socket.data.gameId = gameId;
      socket.data.playerName = playerName;

      const gameState = getGameState(game, socket.id);
      callback({ success: true, gameState, isHost: socket.id === game.hostId });

      // Notify other players
      socket.to(gameId).emit('player-joined', {
        player: { id: socket.id, name: playerName, score: 0 },
        players: gameState.players
      });

      console.log(`${playerName} joined game ${gameId}`);
    } catch (error) {
      console.error('Error joining game:', error);
      callback({ success: false, error: 'Kunde inte gå med i spelet' });
    }
  });

  // Start the game (host only)
  socket.on('start-game', (callback) => {
    try {
      const gameId = socket.data.gameId;
      const game = games.get(gameId);

      if (!game) {
        return callback({ success: false, error: 'Spelet hittades inte' });
      }

      if (socket.id !== game.hostId) {
        return callback({ success: false, error: 'Endast värden kan starta spelet' });
      }

      if (game.status !== 'waiting') {
        return callback({ success: false, error: 'Spelet har redan startat' });
      }

      if (game.players.size < 1) {
        return callback({ success: false, error: 'Minst en spelare behövs' });
      }

      startGameTimer(game);
      // Send game state to each player individually (for free-for-all filtering)
      for (const [playerId] of game.players) {
        io.to(playerId).emit('game-started', getGameState(game, playerId));
      }
      callback({ success: true });

      console.log(`Game ${gameId} started`);
    } catch (error) {
      console.error('Error starting game:', error);
      callback({ success: false, error: 'Kunde inte starta spelet' });
    }
  });

  // Submit a word
  socket.on('submit-word', ({ word }, callback) => {
    try {
      const gameId = socket.data.gameId;
      const game = games.get(gameId);

      if (!game) {
        return callback({ success: false, error: 'Spelet hittades inte' });
      }

      const result = submitWord(game, socket.id, word);

      if (result.success) {
        const claimData = {
          word: result.word,
          playerId: socket.id,
          playerName: socket.data.playerName,
          score: result.score,
          timestamp: Math.floor((Date.now() - game.startTime) / 1000),
          players: Array.from(game.players.entries()).map(([id, p]) => ({
            id,
            name: p.name,
            score: p.score
          }))
        };

        if (game.mode === 'exclusive') {
          // In exclusive mode, broadcast to all players
          io.to(gameId).emit('word-claimed', claimData);
        } else {
          // In free-for-all, only send claim to the player who made it
          // But send updated scores to everyone
          socket.emit('word-claimed', claimData);
          socket.to(gameId).emit('scores-updated', {
            players: claimData.players
          });
        }
      }

      callback(result);
    } catch (error) {
      console.error('Error submitting word:', error);
      callback({ success: false, error: 'Ett fel uppstod' });
    }
  });

  // Get game state
  socket.on('get-game-state', ({ gameId }, callback) => {
    try {
      const game = games.get(gameId);

      if (!game) {
        return callback({ success: false, error: 'Spelet hittades inte' });
      }

      callback({ success: true, gameState: getGameState(game) });
    } catch (error) {
      console.error('Error getting game state:', error);
      callback({ success: false, error: 'Kunde inte hämta spelstatus' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const gameId = socket.data.gameId;

    if (gameId) {
      const game = games.get(gameId);

      if (game) {
        const player = game.players.get(socket.id);

        if (player) {
          player.connected = false;

          // Notify other players
          socket.to(gameId).emit('player-disconnected', {
            playerId: socket.id,
            playerName: player.name
          });

          console.log(`${player.name} disconnected from game ${gameId}`);

          // Transfer host if needed
          if (socket.id === game.hostId) {
            for (const [id, p] of game.players) {
              if (p.connected) {
                game.hostId = id;
                io.to(gameId).emit('host-changed', { newHostId: id });
                break;
              }
            }
          }
        }
      }
    }

    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    wordListSize: getWordListSize(),
    activeGames: games.size
  });
});

// Clean up old games periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const OLD_GAME_THRESHOLD = 30 * 60 * 1000; // 30 minutes

  for (const [gameId, game] of games) {
    const gameAge = game.startTime
      ? now - game.startTime
      : now - (game.createdAt || now);

    if (gameAge > OLD_GAME_THRESHOLD && game.status === 'ended') {
      if (game.timerInterval) {
        clearInterval(game.timerInterval);
      }
      games.delete(gameId);
      console.log(`Cleaned up old game: ${gameId}`);
    }
  }
}, 5 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3001;

async function start() {
  await loadWordList();

  server.listen(PORT, () => {
    console.log(`WrdHntr server running on port ${PORT}`);
    console.log(`CORS origin: ${corsOrigin}`);
  });
}

start();
