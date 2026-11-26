# Contributing to CricketVerse Arena

Thanks for helping! Bug reports, ideas, docs fixes and code are all welcome. You don't need to be a game developer to help.

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer and Git.

```bash
git clone https://github.com/nick10-05/cricketverse.git
cd cricketverse
npm install
npm run server   # terminal 1: game server on http://localhost:3001
npm run dev      # terminal 2: the game on http://localhost:3000
```

Open http://localhost:3000. To try multiplayer on one computer, open a second browser window (or a private window), create a room in one and join with the code in the other.

## Before you open a pull request

Run the same checks CI runs:

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npx tsc -p tsconfig.server.json
npm test
npm run build
```

With the server running, `npm run smoke` plays a full match through it with two bot clients.

## How the code is organised

| Folder | What lives there |
|---|---|
| `src/game/` | Pure game logic: physics, rules, AI and the `Room` that runs a match. No browser APIs, so it runs on the server too. **Changes here need tests** in `src/game/game.test.ts`. |
| `src/net/` | Networking: Socket.IO client, peer-to-peer fallback, message types. |
| `server/` | The Node server (Socket.IO rooms + static file hosting). |
| `src/render3d/` | Three.js renderer: stadium, procedural players, animations, cameras. |
| `src/render/` | Lightweight 2D canvas renderer (fallback for devices without WebGL) and sound. |
| `src/ui/` | React screens: home, lobby, game, scorecard, stats. |
| `legacy/` | The previous version of the project. Not built; kept for reference. |

Key idea: every ball is **deterministic**. The bowler's delivery includes a random seed, and `resolveBall(delivery, shot)` always gives the same result for the same inputs. The server decides the outcome and every client replays the identical ball. If you change physics, keep it deterministic: use the seeded `rng`, never `Math.random()`, inside `src/game/physics.ts`.

## Guidelines

- **Small, focused pull requests** are easiest to review. One feature or fix per PR.
- **Describe what and why** in the PR. Screenshots or a short clip help a lot for visual changes.
- **Keep it original.** Do not add art, models, sounds, names or code copied from other games, or anything you don't have the rights to. Everything in the game is made in code or comes from openly licensed packages.
- **Licences.** New dependencies or assets must have a licence compatible with MIT (MIT, BSD, Apache-2.0, ISC, CC0, CC-BY, SIL OFL). Add them to [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **No secrets.** Never commit API keys, tokens, passwords or `.env` files. The game doesn't need any.
- **Style.** 2 spaces, no semicolons, single quotes, and the ESLint config in the repo. TypeScript strict mode stays on.
- **Performance matters.** The game should stay smooth on mid-range phones. Test the `low` graphics setting if you touch rendering.

## Reporting bugs

Open an issue with:

1. What you did (steps to reproduce).
2. What you expected, and what happened instead.
3. Browser, device, and whether it was practice, server or peer-to-peer play.
4. Console errors if there are any (press F12, then Console).

## Ideas and feature requests

Open an issue describing the idea and why it would make the game better. For bigger changes, please discuss in an issue before writing a lot of code.

## Code of conduct

By taking part you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Licence

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
