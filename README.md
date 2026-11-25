# CricketVerse Arena

A fast, arcade-style online cricket game you play with friends in private rooms.

- **Private rooms**: the host creates a room and shares a 5-letter code (or invite link). Only people with the code can join.
- **Any format**: 1v1, 2v2, 3v3, 4v4, 5v5, or **Teams** (split any number of players into two sides). Empty seats can be filled with bots.
- **1–10 overs** and **1–10 wickets** per side, chosen by the host.
- **Timing-based batting**: tap left / middle / right of the batter as the ball arrives; LOFT for aerial shots. Early pulls to leg, late steers to off.
- **Bowling**: Fast, Swing, Spin, Yorker, Bouncer, Slower. Drag the target on the pitch, stop the power meter in the green.
- Full 3D-projected stadium, ball physics (drag, bounce, swing, spin), fielders who chase and catch, chase camera, scorecards, quick chat, sound.

## Run it

```
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in dist/
```

## How online play works

There is no game server. The host's browser runs the match (`src/net/host.ts`), and friends connect to it
directly over WebRTC using [PeerJS](https://peerjs.com). PeerJS's free public relay is used only to introduce
the players to each other. If the host closes the tab, the match ends.

The deployed site must be served over HTTPS (any static host works: Firebase Hosting, Netlify, Vercel, GitHub Pages).

## Code map

| Path | What |
|---|---|
| `src/game/physics.ts` | Delivery trajectories, timing windows, shot/ball-flight simulation, fielding, runs |
| `src/game/rules.ts` | Match state: innings, overs, wickets, batting/bowling rotation, results |
| `src/game/ai.ts` | Bot bowler and batter |
| `src/net/host.ts` | Authoritative room host: lobby, teams, settings, turn flow, bots |
| `src/net/client.ts` | Room client used by every player's UI (host included) |
| `src/render/scene.ts` | Canvas renderer: stadium, players, ball, cameras, effects |
| `src/ui/*` | Home, Lobby, Game screen, Scorecard |
| `legacy/` | The previous version of the project (kept for reference, not built) |
