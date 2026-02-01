import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket, connectSocket } from '../socket'
import { useGameStore, Player, Claim, GameState } from '../store/gameStore'
import { playCountdownBeep, playGameOver } from '../utils/sounds'

interface JoinGameResponse {
  success: boolean
  gameState?: GameState
  isHost?: boolean
  error?: string
}

interface StartGameResponse {
  success: boolean
  error?: string
}

interface SubmitWordResponse {
  success: boolean
  word?: string
  score?: number
  totalScore?: number
  error?: string
}

function GameRoom() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    setConnected,
    playerId, isHost, setPlayer,
    game, setGame, updateGameStatus, updateTimeRemaining, updatePlayers, addClaim, setHostId,
    error, setError,
    lastSubmitResult, setLastSubmitResult
  } = useGameStore()

  const [wordInput, setWordInput] = useState('')
  const [isJoining, setIsJoining] = useState(true)
  const [nameInput, setNameInput] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const lastBeepTimeRef = useRef<number>(-1)

  // Join game on mount
  useEffect(() => {
    const storedName = sessionStorage.getItem('playerName')

    if (!storedName) {
      setShowNamePrompt(true)
      setIsJoining(false)
      return
    }

    joinGame(storedName)

    return () => {
      // Cleanup on unmount
      socket.off('player-joined')
      socket.off('player-disconnected')
      socket.off('game-started')
      socket.off('timer-update')
      socket.off('word-claimed')
      socket.off('scores-updated')
      socket.off('game-ended')
      socket.off('host-changed')
    }
  }, [gameId])

  const joinGame = async (name: string) => {
    setIsJoining(true)
    setError(null)

    try {
      await connectSocket()
      setConnected(true)

      socket.emit('join-game', {
        gameId,
        playerName: name
      }, (response: JoinGameResponse) => {
        if (response.success && response.gameState) {
          setGame(response.gameState)
          setPlayer(socket.id || null, name, response.isHost || false)
          setupSocketListeners()
        } else {
          const errorMsg = response.error || 'Kunde inte gå med i spelet'
          setError(errorMsg)
          // Only show name prompt for errors that can be fixed by changing name
          if (errorMsg !== 'Spelet hittades inte' && errorMsg !== 'Spelet är avslutat') {
            setShowNamePrompt(true)
            setNameInput(name)
          }
        }
        setIsJoining(false)
      })
    } catch (err) {
      setError('Kunde inte ansluta till servern')
      setIsJoining(false)
    }
  }

  const setupSocketListeners = useCallback(() => {
    socket.on('player-joined', ({ players }: { players: Player[] }) => {
      updatePlayers(players)
    })

    socket.on('player-disconnected', ({ players }: { players: Player[] }) => {
      updatePlayers(players)
    })

    socket.on('game-started', (gameState: GameState) => {
      setGame(gameState)
      // Small delay to ensure input is rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 50)
    })

    socket.on('timer-update', ({ remaining }: { remaining: number }) => {
      updateTimeRemaining(remaining)

      // Play countdown beep in final 10 seconds
      if (remaining <= 10 && remaining > 0 && remaining !== lastBeepTimeRef.current) {
        lastBeepTimeRef.current = remaining
        playCountdownBeep(remaining)
      }
    })

    socket.on('word-claimed', ({ word, playerId: claimerId, playerName: claimerName, score, bonus, timestamp, players }: {
      word: string
      playerId: string
      playerName: string
      score: number
      bonus?: number
      timestamp: number
      players: Player[]
    }) => {
      addClaim({ word, playerId: claimerId, playerName: claimerName, score, bonus, timestamp })
      updatePlayers(players)
    })

    // In free-for-all mode, other players only get score updates (not claims)
    socket.on('scores-updated', ({ players }: { players: Player[] }) => {
      updatePlayers(players)
    })

    socket.on('game-ended', ({ rankings, claims, gameInfo, possibleWords }: {
      rankings: Player[]
      claims: Claim[]
      gameInfo: { mode: string; letters: string[]; minWordLength: number }
      possibleWords: string[]
    }) => {
      updateGameStatus('ended')
      playGameOver()
      // Navigate to results
      setTimeout(() => {
        navigate(`/results/${gameId}`, { state: { rankings, claims, game: gameInfo, possibleWords } })
      }, 500)
    })

    socket.on('host-changed', ({ newHostId }: { newHostId: string }) => {
      setHostId(newHostId)
    })
  }, [])

  const handleStartGame = () => {
    setIsStarting(true)
    socket.emit('start-game', (response: StartGameResponse) => {
      if (!response.success) {
        setError(response.error || 'Kunde inte starta spelet')
      }
      setIsStarting(false)
    })
  }

  const handleSubmitWord = (e: React.FormEvent) => {
    e.preventDefault()

    const word = wordInput.trim().toUpperCase()
    if (!word) return

    socket.emit('submit-word', { word }, (response: SubmitWordResponse) => {
      setLastSubmitResult(response)
      setWordInput('')  // Always clear input for next guess

      // Clear result after animation
      setTimeout(() => setLastSubmitResult(null), 2000)
    })
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (nameInput.trim()) {
      sessionStorage.setItem('playerName', nameInput.trim())
      setShowNamePrompt(false)
      joinGame(nameInput.trim())
    }
  }

  const copyShareLink = () => {
    const link = window.location.href
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Name prompt screen
  if (showNamePrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Ange ditt namn</h2>
          <form onSubmit={handleNameSubmit}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Ditt namn..."
              maxLength={20}
              autoFocus
              className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-lg
                       text-gray-800 placeholder-gray-400 focus:outline-none transition-colors
                       ${error ? 'border-red-500' : 'border-gray-300 focus:border-gray-500'}`}
            />
            {error && (
              <div className="mt-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="w-full py-3 mt-4 bg-gray-900 hover:bg-gray-800 text-white
                       font-medium rounded-lg transition-colors"
            >
              Gå med i spel
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Loading screen
  if (isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 mx-auto mb-4 text-gray-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500">Ansluter till spel...</p>
        </div>
      </div>
    )
  }

  // Game not found or ended screen
  if (error && (error === 'Spelet hittades inte' || error === 'Spelet är avslutat')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 text-lg">{error}</p>
        </div>
      </div>
    )
  }


  if (!game) return null

  const isPlaying = game.status === 'playing'
  const isWaiting = game.status === 'waiting'

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WrdHntr</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Spel: {game.id}</span>
            <span>|</span>
            <span className="text-gray-700">
              {game.mode === 'exclusive' ? 'Exclusive' : 'Free-for-all'}
            </span>
          </div>
        </div>

        {/* Timer */}
        <div className={`text-4xl font-mono font-bold ${
          game.timeRemaining <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-800'
        }`}>
          {formatTime(game.timeRemaining)}
        </div>

        {/* Share Link */}
        {isWaiting && (
          <button
            onClick={copyShareLink}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200
                     rounded-lg transition-colors text-sm text-gray-700 border border-gray-200"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Kopierad!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Dela länk</span>
              </>
            )}
          </button>
        )}
      </header>

      {/* Error Toast */}
      {error && (
        <div className="bg-gray-100 border border-gray-400 text-gray-700 px-4 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 grid lg:grid-cols-3 gap-4">
        {/* Left Column - Letters & Input */}
        <div className="lg:col-span-2 space-y-4">
          {/* Letters Display */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-3">
              {isWaiting ? 'Bokstäverna visas när spelet startar' : 'Tillgängliga bokstäver'}
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {game.letters.map((letter, index) => (
                <div
                  key={index}
                  className={`w-12 h-12 flex items-center justify-center text-2xl font-bold
                           rounded-lg border border-gray-200 ${
                             isPlaying
                               ? 'bg-gray-100 text-gray-700'
                               : 'bg-gray-100 text-gray-400'
                           }`}
                >
                  {letter}
                </div>
              ))}
            </div>
          </div>

          {/* Word Input */}
          {isPlaying && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <form onSubmit={handleSubmitWord} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value.toUpperCase())}
                  placeholder="Skriv ett ord..."
                  autoComplete="off"
                  autoCapitalize="characters"
                  className={`flex-1 px-4 py-3 bg-gray-50 border-2 rounded-lg text-xl
                           text-gray-800 placeholder-gray-400 focus:outline-none transition-colors
                           ${lastSubmitResult
                             ? lastSubmitResult.success
                               ? 'border-gray-900 flash-success'
                               : 'border-red-500 shake'
                             : 'border-gray-300 focus:border-gray-500'
                           }`}
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white
                           font-medium rounded-lg transition-colors"
                >
                  Skicka
                </button>
              </form>

              {/* Submit Result Feedback */}
              {lastSubmitResult && (
                <div className={`mt-2 text-sm ${
                  lastSubmitResult.success ? 'text-gray-700' : 'text-red-600'
                }`}>
                  {lastSubmitResult.success
                    ? `+${lastSubmitResult.score} poäng för "${lastSubmitResult.word}"`
                    : lastSubmitResult.error
                  }
                </div>
              )}
            </div>
          )}

          {/* Waiting Room */}
          {isWaiting && (
            <div className="bg-white rounded-lg p-6 text-center shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Väntar på spelare...
              </h3>
              <p className="text-gray-500 mb-2">
                Minst {game.minWordLength} bokstäver krävs per ord
              </p>
              <p className="text-gray-400 text-sm mb-4">
                {game.mode === 'freeforall'
                  ? 'Poäng = ordlängd × tid kvar + bonus (5+ bokstäver = ordlängd × 10)'
                  : 'Poäng = 1 poäng per bokstav. Vid lika: längsta ord, antal ord, snabbast först.'}
              </p>

              {isHost ? (
                <button
                  onClick={handleStartGame}
                  disabled={isStarting || game.players.length < 1}
                  className="px-8 py-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300
                           disabled:cursor-not-allowed text-white text-lg font-medium rounded-lg
                           transition-colors"
                >
                  {isStarting ? 'Startar...' : 'Starta spel'}
                </button>
              ) : (
                <p className="text-gray-500">Väntar på att värden startar spelet...</p>
              )}
            </div>
          )}

          {/* Claimed Words */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-3">
              {game.mode === 'freeforall' ? 'Dina ord' : 'Tagna ord'} ({game.claims.length})
            </h3>
            <div className="max-h-48 overflow-y-auto">
              {game.claims.length === 0 ? (
                <p className="text-gray-400 text-sm">Inga ord ännu...</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[...game.claims].reverse().map((claim, index) => (
                    <div
                      key={`${claim.word}-${claim.playerId}-${index}`}
                      className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100
                               rounded border border-gray-200 text-sm"
                    >
                      <span className="font-mono font-medium text-gray-800">{claim.word}</span>
                      <span className="text-gray-500 text-xs">+{claim.score}</span>
                      {game.mode === 'exclusive' && (
                        <span className="text-gray-400 text-xs">{claim.playerName}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Leaderboard */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Poängställning
          </h3>
          <div className="space-y-2">
            {[...game.players]
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.id === playerId
                      ? 'bg-gray-100 border border-gray-300'
                      : 'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.name)}`}
                      alt=""
                      className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0"
                    />
                    <div className="font-medium text-gray-800 flex items-center gap-2 min-w-0">
                      <span className={`truncate ${player.connected === false ? 'line-through text-gray-400' : ''}`}>
                        {player.name}
                      </span>
                      {player.id === game.hostId && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">
                          Värd
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-gray-800">
                    {player.score}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameRoom
