# WrdHntr - Multiplayer Swedish Word Game

A real-time multiplayer word game where players compete to form words from randomly generated letters.

## Game Modes

- **Free-for-all**: Duplicates allowed across players. Score based on word length, speed, and bonuses.
- **Exclusive Claim**: First-come-first-served. Only the first player to claim a word gets points.

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Zustand
- **Word List**: Swedish dictionary (~100k words)

## Project Structure

```
wrdhntr/
├── backend/
│   ├── app.js          # Express + Socket.IO server
│   ├── gameLogic.js    # Game mechanics
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── store/      # Zustand state
│   │   └── ...
│   └── package.json
└── package.json        # Root scripts
```

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

1. Install all dependencies:
```bash
npm run install:all
```

2. Start development servers (backend + frontend concurrently):
```bash
npm run dev
```

- Backend runs on: http://localhost:3001
- Frontend runs on: http://localhost:5173

### Individual Commands

```bash
# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev
```

## Deployment to Render.com

### Backend (Web Service)

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
4. Add environment variable:
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://your-frontend-url.onrender.com`

### Frontend (Static Site)

1. Create a new **Static Site** on Render
2. Connect your GitHub repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add environment variable:
   - `VITE_SOCKET_URL=https://your-backend-url.onrender.com`

## Game Rules

1. Host creates a game with chosen settings (mode, letter count, min word length)
2. Players join via shareable link
3. Host starts the game when ready
4. 60 seconds to form as many valid Swedish words as possible
5. Words must:
   - Use only the given letters (repeats allowed if letter appears multiple times)
   - Be at least the minimum length (default: 3)
   - Exist in the Swedish dictionary

## Scoring

### Free-for-all Mode
- Base: `word_length * (60 - seconds_elapsed)`
- Bonus: +5 for words longer than 6 letters
- Duplicates allowed (multiple players can claim same word)

### Exclusive Mode
- Score: 1 point per letter
- Only first claimer gets points
- No duplicates allowed

## License

MIT
