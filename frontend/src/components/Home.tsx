import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket, connectSocket } from '../socket'
import { useGameStore } from '../store/gameStore'

type GameMode = 'freeforall' | 'exclusive'

interface CreateGameResponse {
  success: boolean
  gameId?: string
  error?: string
}

function Home() {
  const navigate = useNavigate()
  const { setConnected, setError, error } = useGameStore()

  // Form state
  const [mode, setMode] = useState<GameMode>('freeforall')
  const [letterCount, setLetterCount] = useState(14)
  const [minWordLength, setMinWordLength] = useState(3)
  const [playerName, setPlayerName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateGame = async () => {
    setIsCreating(true)
    setError(null)

    try {
      await connectSocket()
      setConnected(true)

      socket.emit('create-game', {
        mode,
        letterCount,
        minWordLength
      }, (response: CreateGameResponse) => {
        if (response.success && response.gameId) {
          // Store player name in session storage for the game room
          sessionStorage.setItem('playerName', playerName.trim())
          navigate(`/join/${response.gameId}`)
        } else {
          setError(response.error || 'Kunde inte skapa spelet')
        }
        setIsCreating(false)
      })
    } catch (err) {
      setError('Kunde inte ansluta till servern')
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900">WrdHntr</h1>
        </div>

        {/* Player Name */}
        <div className="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ditt namn
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Ange ditt namn..."
            maxLength={20}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg
                     text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2
                     focus:ring-gray-400 focus:border-transparent"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-gray-100 border border-gray-400 text-gray-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Create Game Section */}
        <div className="bg-white rounded-lg p-6 mb-4 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Skapa nytt spel</h2>

          {/* Game Mode */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Spelläge
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('freeforall')}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  mode === 'freeforall'
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">Free-for-all</div>
                <div className="text-xs opacity-75">Alla kan ta samma ord</div>
              </button>
              <button
                onClick={() => setMode('exclusive')}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  mode === 'exclusive'
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">Exclusive</div>
                <div className="text-xs opacity-75">Först till kvarn</div>
              </button>
            </div>
          </div>

          {/* Letter Count */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Antal bokstäver: {letterCount}
            </label>
            <input
              type="range"
              min="12"
              max="16"
              value={letterCount}
              onChange={(e) => setLetterCount(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                       accent-gray-900"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>12</span>
              <span>16</span>
            </div>
          </div>

          {/* Min Word Length */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minsta ordlängd: {minWordLength}
            </label>
            <input
              type="range"
              min="2"
              max="5"
              value={minWordLength}
              onChange={(e) => setMinWordLength(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                       accent-gray-900"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>2</span>
              <span>5</span>
            </div>
          </div>

          {/* Create Button */}
          <div className="relative group">
            <button
              onClick={handleCreateGame}
              disabled={isCreating || !playerName.trim()}
              className="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300
                       disabled:cursor-not-allowed text-white font-medium rounded-lg
                       transition-colors flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Skapar spel...
                </>
              ) : (
                'Skapa spel'
              )}
            </button>
            {!playerName.trim() && !isCreating && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5
                            bg-gray-800 text-gray-100 text-sm rounded-lg whitespace-nowrap
                            opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Ange ett namn för att starta
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
