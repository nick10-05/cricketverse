# CricketVerse Arena

**An open-source 3D cricket game you play online with friends in private rooms.**

Create a room, share the 5-letter code, pick your teams and play: anything from a 1v1 duel to a full 11-a-side match, from 1 to 30 overs. No account, no download, no ads. It runs in the browser on desktop and mobile.

**[▶ Play it now: cricketverse-arena.onrender.com](https://cricketverse-arena.onrender.com)** (free hosting, so the first visit after a quiet spell can take up to a minute to wake the server)

Created by **[nick10-05](https://github.com/nick10-05)**.

[![CI](https://github.com/nick10-05/cricketverse/actions/workflows/ci.yml/badge.svg)](https://github.com/nick10-05/cricketverse/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

**Play with friends**
- Private rooms with an invite code or link. Only people with the code can join.
- **1v1 up to 11v11**, or a free split of everyone in the room. Empty slots fill with bots.
- **Overs**: presets of 1, 2, 3, 5, 10, 15, 20, 25 or 30, or any custom number from 1 to 30.
- See every slot, teammate and opponent in the lobby. Rename teams, kick players, fill with bots.
- Lock the room during a match, or let late joiners watch as spectators.
- Drop out mid-match and a bot plays your turns until you reconnect. The host role passes on automatically.
- Practice offline against bots at any team size.

**Real cricket**
- Timing-based batting: drives, flicks, pulls, hooks, cuts, upper cuts, slogs, blocks and leaves, picked from the ball's line and length and the direction you choose. Loft it for sixes, at a risk.
- Bowling: pace, swing, seam, spin, yorker, bouncer and slower ball. Aim on the pitch and time the power meter.
- Field placements: attacking (slips, short leg), balanced or defensive (sweepers on the rope).
- Ball physics with drag, bounce, swing, seam and spin. Fielders chase, dive, catch and throw.
- Proper scoring: striker and non-striker, strike rotation, overs and ends, no consecutive overs for a bowler, bowling quotas, wides, no-balls with free hits, byes, leg byes.
- Dismissals: bowled, caught, caught behind, LBW, stumped and run out.
- Small teams: "last man stands" lets the final batter bat alone; a 1-player side bats on lives.

**3D presentation**
- Floodlit stadium with tiered stands, an animated crowd (with Mexican waves), LED boards and a live big screen.
- Procedurally built, animated cricketers: batting strokes, bowling action, running between wickets, diving and catching, throws, keeper, and umpires who signal fours, sixes, wides and wickets.
- TV-style camera director: batting view, chase cam, stump cam and slow-motion replays of sixes and wickets.
- Bloom, shadows and tone mapping, with High / Medium / Low / 2D quality settings for any device.
- Stadium sound: a living crowd murmur, crisp bat on ball, pitch bounce and keeper's gloves, roars for fours and sixes, a wicket reaction and umpire cues for wides and no-balls. Separate volume sliders for ambience, crowd and effects.

**Stats**
- Full scorecards with strike rates, economy, extras, fall of wickets and a run-progression chart.
- Career stats and match history saved in your browser.

## Getting started

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/nick10-05/cricketverse.git
cd cricketverse
npm install
```

Run the game server and the client in two terminals:

```bash
npm run server     # game server on http://localhost:3001 (Socket.IO)
npm run dev        # the game on http://localhost:3000
```

Open http://localhost:3000. To test multiplayer on one machine, open a second window (or a private window) and join the room code.

No `.env` file or API keys are needed. See [.env.example](.env.example) for the optional settings.

## How to play

| | |
|---|---|
| **Bat** | Watch the yellow ring where the ball pitches. Tap left, middle or right of the batter as the ball arrives, or swipe (swipe up to loft). Keyboard: ← ↑ →, hold Shift or press L to loft. |
| **Timing** | Perfect timing middles it. Early pulls it to the leg side, late steers it to the off side. Way off and you miss. |
| **Bowl** | Pick a delivery and a field, drag the target on the pitch, and stop the power meter in the green (Space). A rushed red-zone release can be a no-ball, and the next ball is a free hit. |

## Deploying

The Node server serves both the built game and the multiplayer rooms, so one web service is enough.

```bash
npm run build
npm start          # PORT defaults to 3001; health check at /healthz
```

- **Render**: [render.yaml](render.yaml) is included (works on the free plan). Click the button, sign in to Render and it builds and starts the whole game for you:

  [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nick10-05/cricketverse)
- **Docker**: `docker build -t cricketverse . && docker run -p 3001:3001 cricketverse`
- **Any Node host** (Railway, Fly.io, a VPS): build, then `npm start`.

The client can also be hosted as a static site (`dist/`) on its own. Players then fall back to peer-to-peer rooms, or you can point it at a game server with `VITE_SERVER_URL` at build time.

## How online play works

One authoritative `Room` class ([src/game/room.ts](src/game/room.ts)) runs each match on the server. Clients only send intents (bowl this delivery, play this shot, join that team). The room validates them, resolves the ball and broadcasts the result.

Ball physics are seeded and deterministic, so every client replays exactly the same delivery and shot from a few bytes of data. The batter's timing is measured on their own device against their own animation, so network lag doesn't affect timing.

If the server can't be reached, the host's browser runs the same `Room` and friends connect directly over WebRTC ([PeerJS](https://peerjs.com)). Practice mode runs it locally against bots.

For the full walkthrough (the life of one ball, disconnects and bots, server protection and the design trade-offs), see [docs/multiplayer.md](docs/multiplayer.md).

## Project structure

| Path | What |
|---|---|
| `src/game/` | Physics, rules, AI and the authoritative `Room` (shared by server and browser), plus unit tests |
| `src/net/` | Room client (server, peer-to-peer and local transports) and message types |
| `server/` | Node server: Socket.IO rooms, rate limiting, static hosting |
| `src/render3d/` | Three.js renderer: stadium, procedural cricketers, animations, camera director, replays |
| `src/render/` | 2D canvas fallback renderer and the sound engine |
| `public/audio/` | Short CC0 sound clips (see THIRD_PARTY_NOTICES.md) |
| `src/ui/` | React screens: home, lobby, game, scorecard, stats |
| `scripts/smoke-server.ts` | End-to-end test: two bots play a full match through a running server |
| `legacy/` | The previous version of the project (not built) |

## Checks

```bash
npm run lint
npm test           # unit tests: physics, rules, room logic
npm run smoke      # full match through a running server
npm run build
```

CI runs lint, both typechecks, the tests and the build on every push and pull request.

## Contributing

Contributions are welcome, whether it's a bug report, an idea or code. Read [CONTRIBUTING.md](CONTRIBUTING.md) to get set up, and please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## Credits and licence

CricketVerse Arena was created by **[nick10-05](https://github.com/nick10-05)**.

It is an original game and is not affiliated with any other cricket game or company. All art and models are generated in code. Sound clips come from public-domain (CC0) recordings at [BigSoundBank](https://bigsoundbank.com); they, the third-party libraries and fonts are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Released under the [MIT License](LICENSE).
