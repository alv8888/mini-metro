# CITYFLOW

A small, original urban-transit strategy game prototype. Build metro lines, connect stations, move passengers, manage capacity, and keep the network flowing.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

To create a production build:

```bash
npm run build
npm run preview
```

## Prototype controls

- Select a colored line in the toolbar.
- Click stations on the map in the order you want the line to visit them.
- Click a station already on the line to trim the route back to that station.
- Use **Undo** to remove the last station from the selected line.
- Use **Pause** and the speed control to manage the simulation.
- Open **Ambient audio** to enable the original synthesized background sound.

Passengers only appear between stations that are connected by the current network. Trains reverse at the ends of each line. At interchange stations, passengers can change lines when the route requires it.

## Current scope — v0.2

The first playable city now includes a detailed coastal map, streets and landmarks, animated trains, route connections, passenger pathfinding and transfers, station queues, overload conditions, adaptive time-of-day passenger patterns, an announced stadium event, an operating-funds system, paid capacity/speed upgrades, simulation controls, and synthesized ambient audio.

Passengers earn operating funds when delivered. Capacity and express upgrades have explicit prices, so the player must balance immediate service needs against future investment.

The project deliberately starts without accounts, a backend, or external music services. The game should first prove that its core loop is fun and understandable.

## Project structure

- `src/main.ts`: simulation, rendering, input, and audio.
- `src/style.css`: game interface and responsive layout.
- `index.html`: application shell.
- `docs/GAME_DESIGN.md`: product direction and development roadmap.

## Design principles

1. The player should understand the basic action in under a minute.
2. Every upgrade and event should create a meaningful trade-off.
3. Difficulty should rise from readable systems, not random punishment.
4. The simulation must remain separate enough from rendering to evolve safely.
5. A small, polished playable loop is more valuable than many unfinished features.

## License and assets

The prototype uses original code and procedurally drawn graphics/audio. No Mini Metro or Mini Motorways code, artwork, audio, or other assets are included.
