# Paws & Pours

A browser-based, server-authoritative co-op bartending roguelike prototype for the Handshake × OpenAI Multiplayer Game Challenge.

## Play locally

Requires Node.js 22+.

```bash
corepack enable
pnpm install
pnpm dev
```

Open `http://localhost:5173` in two browser windows. In the first, create a room; in the second, enter the four-letter room code and join. The lobby handles up to four players.

## Deploy online

This repository is ready to deploy as **one Node/Docker web service**. The production process serves the compiled browser game and Socket.IO multiplayer server from the same domain.

1. Push this project to a Git repository.
2. Create a new web service on any host that supports Docker or Node.js (for example, Render, Railway, Fly.io, or a container service).
3. Point it at the repository. If the host detects the included `Dockerfile`, it needs no custom build or start command.
4. Ensure the host exposes the service's `PORT` environment variable. The game uses port `3001` locally and automatically respects the platform-provided port online.
5. Open the public HTTPS URL and share it with players. The browser and WebSocket server use the same origin, so no URL configuration is required.

Do not use GitHub Pages for the complete multiplayer game: it can host the built client only, not this game's Node.js/Socket.IO server.

To run the automated core-logic checks:

```bash
npm test
```

## First playable slice

- Room-code lobby with cat name, role, fur colour, and accessory selection.
- Shared 2–4 player WebSocket session, with reconnecting players retaining their cat identity in the room.
- Server-authoritative movement, ingredients, prepared drinks, customer queues, shift clock, coins, reputation, health, hazards, and upgrades.
- Three complete recipes: Catnip Cooler, Moonmilk Latte, and Tuna Tonic.
- The shift loop: pantry → mixer → service bell → timed customer rewards → upgrade → a second seeded tavern.
- Deterministic tavern generation from a server seed, cycling among cozy, haunted, and pirate themes.
- Responsive desktop/smaller-screen interface with no art-asset download required.

## Controls

- `WASD` or arrow keys: move your cat.
- `E`: interact at a station.
- Pick up three ingredients at the pantry, combine a matching recipe at the mixer, then serve it at the bell.
- Use the mop bucket to clear a hazard.

## Architecture

```
client/        Browser UI, canvas renderer, keyboard input, Socket.IO client
server/        Express health endpoint and authoritative Socket.IO game server
shared/        Deterministic generation, recipes, upgrades, and shared types
tests/         Recipe and procedural-generation rule checks
```

The browser never receives an OpenAI API key. If an AI-powered game-master is added, it belongs behind a server endpoint so the real-time simulation can stay deterministic and responsive.

## Future work

This vertical slice intentionally defers persistent accounts/progression, authoritative collision, mobile touch controls, sound, art/animation assets, spectator handling, rate limiting, persistence, and richer hazards. The data and networking boundaries are organized to support those additions without replacing the core loop.
