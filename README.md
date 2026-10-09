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
- Seven recipes made from the nine existing pantry ingredients. Lunar Fizz, Kelp Swirl, Star Spritz, and Seafoam Shake add new preparation sequences.
- The shift loop: kitchen ingredients → first-person mixing workspace → carry the drink through the bar opening → serve the matching numbered dining table → rewards → upgrades.
- Data-driven mixing sequences with ordered ingredients, server-timed tools, rhythmic chopping, alternating-paw hand mixing, mistakes, cancellation, timeout failure, and drink-quality rewards.
- Later orders introduce harder recipes and shorter patience windows. Every expired or unserved order costs a shared heart and reputation; a Nine Lives keepsake can restore one heart.
- Square one-cell counter primitives with shared client/server collision and seven visual variants per tavern theme.
- Three-minute shifts and a server-wide pause: any player can pause or resume; clocks, orders, movement, and mixing deadlines freeze together.
- Seeded tavern themes on a 16 × 11 elevated floor plan, with connected perimeter counters, two preparation islands, and generous aisles.
- Finished drinks can be placed on counters for teammates, preserving their recipe and preparation quality. Orders and ingredient illustrations stay in a dedicated top strip.
- Title menu with solo/create/join flow, locally persisted display/audio preferences, and solo-only profile/progress summary.
- Grid-aligned rectangular floor and counter collision, world-space hazards, seven illustrated drinks, and discard support for ingredients or completed drinks.
- Responsive desktop/smaller-screen interface with no art-asset download required.

## Controls

- `WASD` or arrow keys: move your cat.
- `E`: interact at a station.
- `Q`: place or pick up a finished drink at a preparation, ingredient, or mixing counter. At ordinary counters, `E` also transfers drinks. Occupied hands or surfaces never overwrite a drink.
- `Escape` or **Menu · Pause**: pause the room for everyone. The pause menu contains the illustrated recipe book and local display/audio settings.
- Pick up three ingredients, open the matching recipe at the mixer, then add them in recipe order. Hold timed tools near their target duration; for chopping and hand mixing, tap in rhythm with the highlighted beat (alternating left and right paws for hand mixing).
- The mixing workspace is private to the active player; the shared online shift continues for everyone else unless anyone pauses the room. An active tool hold or beat sequence restarts after resuming without a mistake.
- `Cancel` leaves the workspace and keeps the gathered ingredients. Three mistakes or a timeout spoils them.
- Use the mop bucket to clear a hazard.
- The Scrap Bin safely discards carried ingredients or a completed drink; it never alters orders.
- Settings persist locally. Solo profile/progress data never participates in party-room networking.

## Architecture

```
client/        Browser UI, tavern canvas, mixing workspace, keyboard input, Socket.IO client
server/        Express health endpoint and authoritative Socket.IO game server
shared/        Deterministic grid/collision, recipes, mixing rules, upgrades, and shared types
tests/         Recipe and procedural-generation rule checks
docs/          Expansion plan, asset audit, UI roadmap, and verification guide
```

The browser never receives an OpenAI API key. If an AI-powered game-master is added, it belongs behind a server endpoint so the real-time simulation can stay deterministic and responsive.

## Verification

Run the pure shared-logic suite and production build:

```bash
npm test
npm run build
```

For the real two-client server smoke test, start the built server in one terminal and run the smoke test in another:

```bash
npm start
npm run test:multiplayer
```

The smoke test creates two Socket.IO clients and verifies the shared pause, gathering, an independently controlled player during mixing, ordered recipe actions, server-owned timing and quality, drink completion, and serving the matching live order.

See [`docs/FLOOR_PLAN.md`](docs/FLOOR_PLAN.md) for the tavern layout, [`docs/TESTING.md`](docs/TESTING.md) for manual browser cases, and [`docs/EXPANSION_PLAN.md`](docs/EXPANSION_PLAN.md) for the architecture, full sprite inventory, risks, larger roadmap, and future UI plan.

## Future work

This vertical slice still defers persistent accounts, mid-shift snapshot restoration, controller and mobile-touch input, playable sound assets, spectator handling, rate limiting, and further preparation verbs such as heating and garnishing. The data and networking boundaries are organized to support those additions without replacing the core loop.
