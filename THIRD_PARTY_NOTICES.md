# Third-party notices

CricketVerse Arena contains **no third-party art, 3D models, textures or audio files**. The stadium, players, animations, textures and sound effects are all generated in code in this repository (`src/render3d/`, `src/render/sound.ts`) and are covered by the project's [MIT License](LICENSE).

The game is an original work. It is not affiliated with, endorsed by, or based on the assets or code of any other cricket game or company.

## Runtime libraries

| Package | Licence | Use |
|---|---|---|
| [React](https://react.dev) / react-dom | MIT | User interface |
| [three.js](https://threejs.org) | MIT | 3D rendering (including its post-processing examples) |
| [Socket.IO](https://socket.io) (server and client) | MIT | Real-time multiplayer |
| [PeerJS](https://peerjs.com) | MIT | Peer-to-peer fallback when no game server is reachable |
| [Tailwind CSS](https://tailwindcss.com) | MIT | Styling |
| [tsx](https://github.com/privatenumber/tsx) | MIT | Runs the TypeScript game server |

Development tools (Vite, TypeScript, ESLint, Vitest and their plugins) are MIT or Apache-2.0 licensed and are not shipped to players.

## Fonts

Loaded from Google Fonts at runtime, not bundled:

| Font | Licence |
|---|---|
| [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) | SIL Open Font License 1.1 |
| [Outfit](https://fonts.google.com/specimen/Outfit) | SIL Open Font License 1.1 |

## Services

The peer-to-peer fallback uses PeerJS's free public signalling server only to introduce players to each other; no game data passes through it.
