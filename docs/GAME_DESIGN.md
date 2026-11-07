# CITYFLOW — Game Design Document

## Product vision

CITYFLOW is an original, minimalist urban-transit strategy game. The player designs a public-transport network for a growing city. The game should be approachable in seconds but reward planning, adaptation, and system-level thinking.

The design takes broad inspiration from the readability of minimalist route-planning games, but its mechanics, code, presentation, setting, and assets are original.

## Design pillars

1. **Readable pressure:** players can see where demand forms and understand why.
2. **Meaningful trade-offs:** capacity, speed, coverage, and transfers should compete for limited resources.
3. **Emergent city patterns:** time, district types, and special events should change passenger demand.
4. **Calm presentation, interesting decisions:** clean typography, restrained colors, gentle animation, and responsive sound.
5. **Fast replay:** a session should create a recognizable story and invite a better attempt.

## Core loop

Observe demand → draw or adjust routes → move passengers → detect bottlenecks → invest in improvements → respond to changing city patterns → review the shift.

## First playable prototype (v0.1)

- One fictional coastal city map.
- Four editable metro lines.
- Stations with different visual identities.
- A train automatically runs each connected line.
- Passengers are generated between connected stations.
- Passengers select a shortest route across the network.
- Interchange transfers are supported.
- Queues build when service is insufficient.
- Prolonged overcrowding ends the session.
- Pause and 1× / 2× / 3× simulation speed.
- Capacity and express-service upgrades.
- Optional original synthesized ambient audio (no Spotify dependency).
- Responsive interface and keyboard pause control.

## Planned systems

### v0.2 — Strategic core and visual identity (in progress)
- Passenger demand shifts with morning and evening commute patterns.
- Grand Stadium event is announced before its demand spike.
- Passenger delivery earns operating funds.
- Capacity and express upgrades have escalating prices.
- Detailed coastal map overlay: street hierarchy, parks, bridge, stadium, campus, harbor, airfield, and district labels.
- Stations have distinct colors, transfer rings, queue counts, and overload indicators.
- Trains use layered bodywork, windows, directional lights, shadows, and passenger-capacity labels.

### v0.3 — Improve the strategic core
- More than one train per line.
- Frequency, dwell time, and capacity balancing.
- Clearer interchange and route diagnostics.
- More event types with warning windows and different demand patterns.
- Upgrade choices with explicit costs and trade-offs.

### v0.3 — City variety
- Multiple maps with rivers, bridges, hills, and different station layouts.
- Distinct district behaviors: residential, business, education, culture, health, and leisure.
- Daily/weekly demand cycles.
- Weather and special events.
- Map modifiers that change strategic priorities.

### v0.4 — Modes and progression
- Endless score mode.
- Curated campaign with objectives.
- Daily seed challenge.
- Sandbox.
- Unlockable maps, visual themes, and vehicle styles.
- Run history and local high scores.

### v0.5 — Audio and polish
- Original soundtrack with adaptive layers.
- Station, vehicle, interchange, and UI sound effects.
- Accessibility: color-safe palette, reduced motion, volume controls, clear status labels.
- Performance profiling and device testing.

## Audio direction

Build an original ambient/electronic identity. Music should be layered and adaptive: sparse at low demand, subtly more rhythmic as the city grows, and tense only when the player is under real pressure. The prototype uses Web Audio synthesis for a quiet sound bed. A later soundtrack can use commissioned or properly licensed original recordings.

Spotify should be treated as an optional external listening destination, not a required game audio engine. The game must remain fully playable when Spotify is unavailable.

## Technical direction

- Vite + TypeScript.
- Canvas 2D for the map and moving vehicles.
- HTML/CSS for accessible interface controls.
- Deterministic simulation updates independent from drawing.
- Shortest-path routing over a graph assembled from active line segments.
- Local storage for settings and high scores.
- No account system or backend until online features genuinely require them.

## Quality gates

- A first-time player can create a route without instructions.
- Passengers only spawn when a valid path exists.
- A player can explain why a station is overloaded.
- Pausing freezes simulation state.
- Changing simulation speed does not change route correctness.
- Route editing never corrupts passenger or train state.
- The map remains usable at laptop and mobile widths.
- Audio is opt-in and respects browser autoplay restrictions.
- No third-party proprietary game assets are used.
