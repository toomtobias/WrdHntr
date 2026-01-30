import { create } from 'zustand'

// Types
export interface Player {
  id: string
  name: string
  score: number
  connected?: boolean
}

export interface Claim {
  word: string
  playerId: string
  playerName: string
  timestamp: number
  score: number
}

export interface GameState {
  id: string
  mode: 'freeforall' | 'exclusive'
  letters: string[]
  letterCount: number
  minWordLength: number
  hostId: string
  players: Player[]
  claims: Claim[]
  status: 'waiting' | 'playing' | 'ended'
  startTime: number | null
  timeRemaining: number
}

interface GameStore {
  // Connection state
  connected: boolean
  setConnected: (connected: boolean) => void

  // Player state
  playerId: string | null
  playerName: string | null
  isHost: boolean
  setPlayer: (id: string | null, name: string | null, isHost: boolean) => void

  // Game state
  game: GameState | null
  setGame: (game: GameState | null) => void
  updateGameStatus: (status: 'waiting' | 'playing' | 'ended') => void
  updateTimeRemaining: (time: number) => void
  updatePlayers: (players: Player[]) => void
  addClaim: (claim: Claim) => void
  setHostId: (hostId: string) => void

  // UI state
  error: string | null
  setError: (error: string | null) => void
  lastSubmitResult: { success: boolean; word?: string; score?: number; error?: string } | null
  setLastSubmitResult: (result: { success: boolean; word?: string; score?: number; error?: string } | null) => void

  // Reset
  reset: () => void
}

const initialState = {
  connected: false,
  playerId: null,
  playerName: null,
  isHost: false,
  game: null,
  error: null,
  lastSubmitResult: null,
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  setPlayer: (id, name, isHost) => set({
    playerId: id,
    playerName: name,
    isHost
  }),

  setGame: (game) => set({ game }),

  updateGameStatus: (status) => set((state) => ({
    game: state.game ? { ...state.game, status } : null
  })),

  updateTimeRemaining: (time) => set((state) => ({
    game: state.game ? { ...state.game, timeRemaining: time } : null
  })),

  updatePlayers: (players) => set((state) => ({
    game: state.game ? { ...state.game, players } : null
  })),

  addClaim: (claim) => set((state) => {
    if (!state.game) return state

    // Avoid duplicates
    const exists = state.game.claims.some(
      c => c.word === claim.word && c.playerId === claim.playerId
    )
    if (exists) return state

    return {
      game: {
        ...state.game,
        claims: [...state.game.claims, claim]
      }
    }
  }),

  setHostId: (hostId) => set((state) => ({
    game: state.game ? { ...state.game, hostId } : null,
    isHost: state.playerId === hostId
  })),

  setError: (error) => set({ error }),

  setLastSubmitResult: (result) => set({ lastSubmitResult: result }),

  reset: () => set(initialState)
}))
