import { Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import GameRoom from './components/GameRoom'
import Results from './components/Results'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:gameId" element={<GameRoom />} />
        <Route path="/results/:gameId" element={<Results />} />
      </Routes>
    </div>
  )
}

export default App
