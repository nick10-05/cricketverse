# Third-party notices

CricketVerse Arena contains **no third-party art, 3D models or textures**. The stadium, players, animations and textures are generated in code in this repository (`src/render3d/`) and are covered by the project's [MIT License](LICENSE).

## Audio

The short clips in `public/audio/` were cut, filtered and level-matched from recordings by Joseph Sardin at [BigSoundBank](https://bigsoundbank.com), released under **[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)** (public domain; attribution is not required but is given here with thanks). The remaining sounds (umpire cues, crowd swells, glove pops) are synthesised in `src/render/sound.ts`.

| Clips in `public/audio/` | Source recording (CC0) |
|---|---|
| `crowd-bed` | [Outside Talks #1](https://bigsoundbank.com/outside-talks-1-s2968.html) (muffled to a murmur) |
| `applause-big-*` | [Applause: 600 people](https://bigsoundbank.com/applause-600-people-s0021.html) |
| `applause-small-*` | [Applause: 150 people](https://bigsoundbank.com/applause-150-people-s0019.html) |
| `bounce-*` | [Tennis Ball: Bounce](https://bigsoundbank.com/tennis-ball-bounce-s0584.html) |
| `wood-*` | [Drumsticks #2](https://bigsoundbank.com/drumsticks-2-s1489.html) |
| `run-grass` | [Running in the Tall Grass](https://bigsoundbank.com/running-in-the-tall-grass-s1843.html) |
| `whistle-*` | [Plastic Whistle #1](https://bigsoundbank.com/plastic-whistle-s1017.html) |
| `shout` | [Shouts and Applauses of Teens #1](https://bigsoundbank.com/shouts-and-applauses-of-teens-1-s0236.html) |

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
