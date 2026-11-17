# HARBOUR LINE — a harbour-yard tactical FPS

A first-person 3D shooter in the browser. You are the point of a blue
squad clearing a dusk harbour yard of CINDER bots: eight rounds, a round
timer, and a match score. Win 5 of 8 rounds to secure the harbour.

## How to run

Serve `game/` with any static server and open `index.html` in a desktop
browser (Chrome or Firefox). With Node:

```
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no fetched assets: Three.js is
vendored under `game/vendor/`, the map and textures are generated in code,
and the sounds are synthesized with WebAudio.

## Controls

- **W A S D** move · **Mouse** aim (click to lock the pointer)
- **Click** shoot · **R** reload · **Shift** sprint · **Space** jump
- **P** pause · **R** play again on the results screen

Arrow keys turn as a fallback when the pointer is not locked.

## Rules

- Each round fields 4–8 CINDER bots. Clear them all before the timer ends.
- Eliminations score 100, headshots add 50, streaks add a bonus, a round
  win adds 250. Lose a round when the timer runs out or you go down.
- The match ends after round 8. Win 5 rounds and the harbour is yours.

## Files

- `game/index.html` — page, HUD and import map
- `game/src/main.js` — match flow and game loop
- `game/src/world.js` — the harbour map, colliders, waypoints
- `game/src/player.js` — first-person controller
- `game/src/bots.js` — bot soldiers and their AI
- `game/src/weapons.js` — the hitscan rifle and view model
- `game/src/fx.js` — tracers, muzzle flashes, sparks
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/hud.js` — DOM HUD, kill feed, menus, results
- `game/src/shots.js` — staged `?shot=` scenes for screenshots
- `game/src/config.js` — tuning constants
- `game/src/state.js` — match state and scoring
