import type { GameSession, DeliveryTurn } from './types'
import { MAX_RECONNECT_TIME_MS } from './types'
import { getSession, getLatestTurn } from './match-session'
import { createMatchState } from '../match-manager'
import type { MatchState } from '../types'

export interface ReconnectData {
  session: GameSession
  latestTurn: DeliveryTurn | null
  lastDeliveryNumber: number
  needsResync: boolean
}

export async function attemptReconnect(sessionId: string): Promise<ReconnectData | null> {
  const session = await getSession(sessionId)
  if (!session) return null

  if (Date.now() - session.updatedAt > MAX_RECONNECT_TIME_MS) {
    return null
  }

  const latestTurn = await getLatestTurn(sessionId)
  const lastDeliveryNumber = latestTurn?.deliveryNumber ?? 0

  return {
    session,
    latestTurn,
    lastDeliveryNumber,
    needsResync: session.status === 'playing',
  }
}

export function rebuildMatchState(session: GameSession): MatchState {
  const teamA: import('../types').TeamConfig = {
    id: session.teams.teamA.id,
    name: session.teams.teamA.name,
    players: session.teams.teamA.playerIds.map((id) => ({
      id,
      name: session.players.find((p) => p.id === id)?.displayName ?? `Player ${id.slice(0, 4)}`,
      role: 'batsman' as const,
      battingOrder: 0,
      stats: { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, overs: 0, maidens: 0 },
    })),
    battingOrder: session.teams.teamA.playerIds.map((id, i) => ({
      playerId: id,
      position: i + 1,
    })),
  }

  const teamB: import('../types').TeamConfig = {
    id: session.teams.teamB.id,
    name: session.teams.teamB.name,
    players: session.teams.teamB.playerIds.map((id) => ({
      id,
      name: session.players.find((p) => p.id === id)?.displayName ?? `Player ${id.slice(0, 4)}`,
      role: 'batsman' as const,
      battingOrder: 0,
      stats: { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, overs: 0, maidens: 0 },
    })),
    battingOrder: session.teams.teamB.playerIds.map((id, i) => ({
      playerId: id,
      position: i + 1,
    })),
  }

  const state = createMatchState(
    session.id,
    session.id,
    teamA,
    teamB,
    5,
    { batting: 0.5, bowling: 0.5, paceSupport: 0.5, spinSupport: 0.5, label: 'Normal' },
    null,
  )

  return state
}

export function isPlayerInSession(session: GameSession, playerId: string): boolean {
  return session.players.some((p) => p.id === playerId)
}

export function getPlayerRole(session: GameSession, playerId: string): 'host' | 'guest' {
  return playerId === session.hostId ? 'host' : 'guest'
}

export function isSessionExpired(session: GameSession): boolean {
  return Date.now() - session.updatedAt > MAX_RECONNECT_TIME_MS * 2
}
