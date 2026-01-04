# 🦖 Dino Game

A realtime 1v1 competitive Chrome Dino clone built with modern technologies.

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, HTML5 Canvas
- **Backend**: Go (Golang), Gorilla WebSocket, net/http
- **Database**: PostgreSQL (Leaderboard), Redis (Matchmaking Queue)
- **Sync Strategy**: Deterministic Lockstep (Server sends Seed → identical obstacles on both clients)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Go 1.21+

### 1. Start Infrastructure

```bash
docker-compose up -d postgres redis
```

### 2. Start Backend

```bash
cd backend
go run ./cmd/server
```

Server runs on http://localhost:8080

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000

## How to Play

### Controls

| Action        | Desktop                 | Mobile                            |
| ------------- | ----------------------- | --------------------------------- |
| **Jump**      | `Space` or `↑`          | Tap **Top Half** of screen        |
| **Duck**      | `↓`                     | Tap **Bottom Half** of screen     |
| **Fast Fall** | Press `↓` while jumping | Tap **Bottom Half** while jumping |

### Game Rules

1. Open http://localhost:3000 in **two browser tabs/windows** (or use a mobile device on the same network)
2. Enter your name and click "Find Match"
3. Wait for matchmaking to pair you
4. Survive longer than your opponent to win!
5. **Early Leave**: If you die first, you can leave immediately to find a new game.

## Key Features

- **Multiplayer 1v1**: Realtime competition with synchronized obstacles
- **Smooth Gameplay**:
  - **Fast Fall**: Press down mid-air to drop quickly
  - **Smart Hitboxes**: Forgiving collision detection for better game feel
  - **Responsive Canvas**: Optimized for both desktop and mobile screens
- **Fairness & Security**:
  - **Deterministic RNG**: Identical obstacles for both players
  - **Anti-Cheat**: Server validates score jumps and rejects suspicious updates
- **Leaderboard**: Global high scores saved to PostgreSQL (Paginated)

## Project Structure

```
dino-multiplayer/
├── backend/                 # Go Backend
│   ├── cmd/server/          # Entry point
│   └── internal/
│       ├── db/              # PostgreSQL & Redis
│       ├── game/            # Matchmaking logic
│       └── ws/              # WebSocket handlers
├── frontend/                # Next.js Frontend
│   └── src/
│       ├── app/             # Pages (lobby, game, leaderboard)
│       ├── components/      # UI Components
│       └── lib/             # Game engine & utilities
└── docker-compose.yml
```

## Communication Protocol

### Client → Server

- `JOIN_QUEUE` - Join matchmaking queue
- `UPDATE_SCORE` - Send score updates
- `PLAYER_DIED` - Notify death
- `LEAVE_GAME` - Gracefully exit active game (after death)

### Server → Client

- `GAME_START` - Match found with seed
- `OPPONENT_UPDATE` - Opponent score/status
- `OPPONENT_LEFT` - Opponent disconnected/left
- `GAME_OVER` - Winner announcement
