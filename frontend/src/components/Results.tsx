import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Player, Claim } from '../store/gameStore'

interface LocationState {
  rankings: Player[]
  claims: Claim[]
  game: {
    mode: string
    letters: string[]
    minWordLength: number
  }
  possibleWords: string[]
}

function Results() {
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state as LocationState | null

  // If no state (direct navigation), redirect to home
  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl text-gray-800 mb-4">Inget spelresultat hittat</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white
                     font-medium rounded-lg transition-colors"
          >
            Tillbaka till start
          </button>
        </div>
      </div>
    )
  }

  const { rankings, claims, game, possibleWords } = state

  // State for expanded word (to show players)
  const [expandedWord, setExpandedWord] = useState<string | null>(null)

  // Get set of claimed words for quick lookup
  const claimedWordsSet = new Set(claims.map(c => c.word.toUpperCase()))

  // Group claims by player
  const claimsByPlayer = claims.reduce((acc, claim) => {
    if (!acc[claim.playerId]) {
      acc[claim.playerId] = []
    }
    acc[claim.playerId].push(claim)
    return acc
  }, {} as Record<string, Claim[]>)

  // Group claims by word (for free-for-all mode)
  const claimsByWord = claims.reduce((acc, claim) => {
    const word = claim.word.toUpperCase()
    if (!acc[word]) {
      acc[word] = []
    }
    acc[word].push(claim)
    return acc
  }, {} as Record<string, Claim[]>)

  const uniqueClaimedWords = Object.keys(claimsByWord).sort((a, b) => {
    // Sort by number of players (descending), then alphabetically
    const diff = claimsByWord[b].length - claimsByWord[a].length
    if (diff !== 0) return diff
    return a.localeCompare(b, 'sv')
  })

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      {/* Final Rankings */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Slutresultat</h3>
        <div className="space-y-2">
          {rankings.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                index === 0
                  ? 'bg-gray-100 border border-gray-300'
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full
                               text-sm font-bold ${
                  index === 0 ? 'bg-gray-900 text-white' :
                  index === 1 ? 'bg-gray-600 text-white' :
                  index === 2 ? 'bg-gray-400 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </span>
                <span className="font-semibold text-gray-800">{player.name}</span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {claimsByPlayer[player.id]?.length || 0} ord
                </span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {claimsByPlayer[player.id]?.reduce((sum, c) => sum + c.word.length, 0) || 0} bokstäver
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {player.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Claimed Words */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Alla ord ({game.mode === 'freeforall' ? uniqueClaimedWords.length : claims.length})
        </h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {game.mode === 'freeforall' ? (
            // Free-for-all: Group by word
            uniqueClaimedWords.map((word, index) => {
              const players = claimsByWord[word]
              const playerNames = players.map(c => c.playerName)
              const isExpanded = expandedWord === word
              return (
                <div
                  key={`${word}-${index}`}
                  onClick={() => players.length > 1 && setExpandedWord(isExpanded ? null : word)}
                  className={`rounded p-2 text-sm transition-colors border ${
                    players.length > 1
                      ? 'cursor-pointer hover:bg-gray-100'
                      : 'cursor-default'
                  } ${isExpanded ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-gray-800">{word}</span>
                    <span className="text-gray-500 text-xs truncate ml-2">
                      {players.length === 1 ? playerNames[0] : `${players.length} spelare`}
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="mt-1 pt-1 border-t border-gray-200 text-xs text-gray-600">
                      {playerNames.join(', ')}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            // Exclusive: Show each claim
            [...claims]
              .sort((a, b) => a.timestamp - b.timestamp)
              .map((claim, index) => (
                <div
                  key={`${claim.word}-${claim.playerId}-${index}`}
                  className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded p-2 text-sm"
                >
                  <span className="font-mono font-medium text-gray-800">{claim.word}</span>
                  <span className="text-gray-500 text-xs truncate ml-2">
                    {claim.playerName}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>

      {/* All Possible Words */}
      {possibleWords && possibleWords.length > 0 && (
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Alla möjliga ord ({possibleWords.length})
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            Hittade {claims.length} av {possibleWords.length} möjliga ord
            ({Math.round((claims.length / possibleWords.length) * 100)}%)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
            {[...possibleWords]
              .sort((a, b) => a.length - b.length || a.localeCompare(b, 'sv'))
              .map((word, index) => {
              const wasClaimed = claimedWordsSet.has(word.toUpperCase())
              return (
                <div
                  key={index}
                  className={`px-2 py-1 rounded text-sm font-mono text-center ${
                    wasClaimed
                      ? 'bg-gray-800 text-white border border-gray-700'
                      : 'bg-gray-50 text-gray-500 border border-gray-100'
                  }`}
                >
                  {word}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Letters Used */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Bokstäver</h3>
        <div className="flex flex-wrap gap-2 justify-center">
          {game.letters.map((letter, index) => (
            <div
              key={index}
              className="w-10 h-10 flex items-center justify-center text-lg font-bold
                       bg-gray-100 text-gray-700 rounded border border-gray-200"
            >
              {letter}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center">
        <button
          onClick={() => navigate('/')}
          className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white
                   font-medium rounded-lg transition-colors"
        >
          Skapa nytt spel
        </button>
      </div>

    </div>
  )
}

export default Results
