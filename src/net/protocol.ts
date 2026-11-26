import type { BallOutcome, Delivery, LobbyState, MatchSettings, MatchState, ShotInput, TeamId } from '../game/types'

export type ClientMsg =
  | { t: 'setTeam'; team: TeamId | null }
  | { t: 'settings'; settings: MatchSettings }
  | { t: 'addBot'; team: TeamId }
  | { t: 'fillBots' }
  | { t: 'kick'; pid: string }
  | { t: 'start' }
  | { t: 'bowl'; delivery: Delivery }
  | { t: 'shot'; ballId: number; shot: ShotInput }
  | { t: 'toLobby' }
  | { t: 'rematch' }
  | { t: 'chat'; text: string }

/** First message on a peer-to-peer data channel. */
export interface PeerHello {
  t: 'hello'
  pid: string
  name: string
}

export type HostMsg =
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'match'; match: MatchState | null }
  | { t: 'ball'; ballId: number; delivery: Delivery; striker: string }
  | { t: 'replay'; ballId: number; delivery: Delivery; shot: ShotInput; outcome: BallOutcome; match: MatchState }
  | { t: 'chat'; from: string; name: string; text: string; at: number }
  | { t: 'error'; text: string }
  | { t: 'kicked' }

/** Socket.IO events (client → server). */
export interface ServerJoinAck {
  ok: boolean
  code?: string
  error?: string
}

export const PEER_PREFIX = 'cvx-arena-v1-'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeCode() {
  let s = ''
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10)
}
