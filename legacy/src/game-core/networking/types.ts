import type { MatchState, TossResult, BallOutcome, InningsState, MatchResult } from '../types'
import type { BowlingInput } from '../bowling/types'
import type { ShotInput, BallApproach, BattingGesture, TimingResult } from '../batting/types'
import type { FieldingState } from '../fielding/types'
import type { FieldCommand, TeamChatMessage } from './team-types'

export type NetworkPlayerRole = 'host' | 'guest'

export interface NetworkPlayer {
  id: string
  name: string
  role: NetworkPlayerRole
  connected: boolean
  ping: number
  teamId: string
}

export type SessionStatus =
  | 'idle'
  | 'waiting'
  | 'toss'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'disconnected'

export interface GameSession {
  id: string
  roomCode: string
  status: SessionStatus
  hostId: string
  players: NetworkPlayer[]
  matchState: MatchState | null
  currentTurn: 'bat' | 'bowl'
  turnPlayerId: string | null
  deliveryCount: number
  format: '1v1' | '2v2'
  teams: {
    teamA: { playerIds: string[]; name: string }
    teamB: { playerIds: string[]; name: string }
  }
  teamRoles: SessionTeamState | null
  createdAt: number
  updatedAt: number
  seed: number
}

export interface DeliveryTurn {
  id: string
  deliveryNumber: number
  over: number
  ballInOver: number
  bowlerId: string
  batterId: string
  nonStrikerId?: string
  captainId?: string
  bowlingInput: BowlingInput | null
  ballApproach: BallApproach | null
  shotInput: ShotInput | null
  gesture: BattingGesture | null
  timing: TimingResult | null
  outcome: BallOutcome | null
  fieldingState: FieldingState | null
  stateSnapshot: string | null
  phase: 'bowling' | 'batting' | 'resolving' | 'complete'
  timestamp: number
  hostTiming: number
  clientTiming: number
}

export type TeamRoleAssignment = 'striker' | 'non_striker' | 'bowler' | 'captain'

export interface SessionTeamState {
  teamA: {
    strikerId: string
    nonStrikerId: string
    bowlerId: string
    captainId: string
    lastOverBowlerId: string | null
  }
  teamB: {
    strikerId: string
    nonStrikerId: string
    bowlerId: string
    captainId: string
    lastOverBowlerId: string | null
  }
}

export type SessionEvent =
  | { type: 'player_joined'; player: NetworkPlayer }
  | { type: 'player_left'; playerId: string }
  | { type: 'toss_result'; toss: TossResult }
  | { type: 'innings_start'; innings: 1 | 2 }
  | { type: 'delivery_start'; turn: DeliveryTurn }
  | { type: 'bowl_input'; turnId: string; input: BowlingInput }
  | { type: 'bat_input'; turnId: string; input: ShotInput; gesture: BattingGesture; timing: TimingResult }
  | { type: 'delivery_result'; turn: DeliveryTurn }
  | { type: 'innings_end'; innings: InningsState }
  | { type: 'match_end'; result: MatchResult }
  | { type: 'player_disconnected'; playerId: string }
  | { type: 'player_reconnected'; playerId: string }
  | { type: 'host_transferred'; newHostId: string }
  | { type: 'field_command'; command: FieldCommand }
  | { type: 'team_chat'; message: TeamChatMessage }
  | { type: 'role_swap'; teamId: string; newRoles: SessionTeamState }
  | { type: 'pause' }
  | { type: 'resume' }

export type SyncPhase = 'idle' | 'connecting' | 'synced' | 'desynced' | 'reconnecting'

export const MAX_RECONNECT_TIME_MS = 60000
export const PING_INTERVAL_MS = 5000
export const TURN_TIMEOUT_MS = 30000

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function calcLatency(
  sendTime: number,
  receiveTime: number,
  processingTime: number,
): number {
  return Math.round((receiveTime - sendTime - processingTime) / 2)
}
