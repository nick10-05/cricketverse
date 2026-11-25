import type { GameSession, DeliveryTurn } from './types'
import { TURN_TIMEOUT_MS } from './types'
import {
  subscribeSession, subscribeTurns,
  createDeliveryTurn, submitBowlingInput, submitBattingInput,
  submitDeliveryResult, updateSessionStatus, updateSessionMatchState,
  leaveSession,
} from './match-session'
import { TeamCoordinator } from './team-coordinator'
import type { Unsubscribe } from 'firebase/firestore'

export type SyncPhase = 'idle' | 'connecting' | 'synced' | 'desynced' | 'reconnecting'

export interface SyncState {
  phase: SyncPhase
  session: GameSession | null
  latestTurn: DeliveryTurn | null
  pendingTurnId: string | null
  isHost: boolean
  playerId: string
  lastPing: number
}

export function createSyncState(playerId: string, isHost: boolean): SyncState {
  return {
    phase: 'idle',
    session: null,
    latestTurn: null,
    pendingTurnId: null,
    isHost,
    playerId,
    lastPing: 0,
  }
}

export class SyncEngine {
  private state: SyncState
  private sessionUnsub: Unsubscribe | null = null
  private turnsUnsub: Unsubscribe | null = null
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private coordinator: TeamCoordinator | null = null

  private onTurnReady: ((turn: DeliveryTurn) => void) | null = null
  private onStateChange: ((state: SyncState) => void) | null = null
  private onReconnect: (() => void) | null = null
  private onRoleChange: ((role: import('./team-types').TeamRole | null) => void) | null = null

  constructor(playerId: string, isHost: boolean) {
    this.state = createSyncState(playerId, isHost)
  }

  getState(): SyncState {
    return this.state
  }

  setCallbacks(cbs: {
    onTurnReady?: (turn: DeliveryTurn) => void
    onStateChange?: (state: SyncState) => void
    onReconnect?: () => void
    onRoleChange?: (role: import('./team-types').TeamRole | null) => void
  }): void {
    this.onTurnReady = cbs.onTurnReady ?? null
    this.onStateChange = cbs.onStateChange ?? null
    this.onReconnect = cbs.onReconnect ?? null
    this.onRoleChange = cbs.onRoleChange ?? null
  }

  getCoordinator(): TeamCoordinator | null {
    return this.coordinator
  }

  async connect(sessionId: string): Promise<void> {
    this.setPhase('connecting')

    this.sessionUnsub = subscribeSession(sessionId, (session) => {
      const prevStatus = this.state.session?.status
      this.state.session = session
      this.state.lastPing = Date.now()

      if (session.format === '2v2' && !this.coordinator) {
        this.coordinator = new TeamCoordinator('2v2')
        if (session.teamRoles) {
          this.coordinator.setState(session.teamRoles)
        }
      }

      if (prevStatus === 'paused' && session.status === 'playing') {
        this.onReconnect?.()
      }

      if (session.teamRoles && this.coordinator) {
        this.coordinator.setState(session.teamRoles)
      }

      if (session.status === 'playing' || session.status === 'toss') {
        this.state.phase = 'synced'
      }

      this.onStateChange?.(this.state)
    })

    this.turnsUnsub = subscribeTurns(sessionId, (turn) => {
      this.state.latestTurn = turn
      if (turn.phase === 'complete') {
        this.state.pendingTurnId = null
      }

      if (this.isTurnRelevant(turn)) {
        this.onTurnReady?.(turn)
      }

      this.onStateChange?.(this.state)
    })

    this.startPing()
  }

  private isTurnRelevant(turn: DeliveryTurn): boolean {
    const session = this.state.session
    if (!session) return false

    if (session.format === '1v1') {
      if (turn.phase === 'bowling' && turn.bowlerId === this.state.playerId) return true
      if (turn.phase === 'batting' && turn.batterId === this.state.playerId) return true
      return false
    }

    if (session.format === '2v2') {
      const playerId = this.state.playerId

      if (turn.phase === 'bowling') {
        const isBowler = turn.bowlerId === playerId
        if (isBowler) return true
        const isCaptain = turn.captainId === playerId
        if (isCaptain) {
          this.onRoleChange?.('captain')
          return true
        }
        return false
      }

      if (turn.phase === 'batting') {
        const isBatter = turn.batterId === playerId
        if (isBatter) return true
        return turn.nonStrikerId === playerId
      }

      if (turn.phase === 'resolving') {
        const isBowler = turn.bowlerId === playerId
        const isBatter = turn.batterId === playerId
        const isCaptain = turn.captainId === playerId
        return isBowler || isBatter || isCaptain
      }
    }

    return false
  }

  getMyRole(teamId: 'teamA' | 'teamB'): import('./team-types').TeamRole | null {
    if (!this.coordinator || !this.state.session) return null
    if (this.state.session.format === '1v1') return 'striker'
    const session = this.state.session
    if (
      teamId === 'teamA' &&
      session.teams.teamA.playerIds.includes(this.state.playerId)
    ) {
      return this.coordinator.getTeamRole(this.state.playerId, 'teamA')
    }
    if (
      teamId === 'teamB' &&
      session.teams.teamB.playerIds.includes(this.state.playerId)
    ) {
      return this.coordinator.getTeamRole(this.state.playerId, 'teamB')
    }

    const teamAPlayers = session.teams.teamA.playerIds
    const teamAHasPlayer = teamAPlayers.includes(this.state.playerId)
    const actualTeamId = teamAHasPlayer ? 'teamA' : 'teamB'
    return this.coordinator.getTeamRole(this.state.playerId, actualTeamId)
  }

  getBatterFromRole(turn: DeliveryTurn): string {
    return turn.nonStrikerId && turn.nonStrikerId !== turn.batterId
      ? turn.batterId
      : turn.batterId
  }

  disconnect(): void {
    this.sessionUnsub?.()
    this.turnsUnsub?.()
    if (this.pingInterval) clearInterval(this.pingInterval)
    this.setPhase('idle')
    this.coordinator = null
  }

  async bowl(turnId: string, input: import('../bowling/types').BowlingInput): Promise<void> {
    if (!this.state.session) return
    this.state.pendingTurnId = turnId
    await submitBowlingInput(this.state.session.id, turnId, input)
  }

  async bat(
    turnId: string,
    input: import('../batting/types').ShotInput,
    gesture: import('../batting/types').BattingGesture,
    timing: import('../batting/types').TimingResult,
  ): Promise<void> {
    if (!this.state.session) return
    this.state.pendingTurnId = turnId
    await submitBattingInput(this.state.session.id, turnId, input, gesture, timing)
  }

  async resolveTurn(
    turnId: string,
    outcome: import('../types').BallOutcome,
    stateJson: string,
  ): Promise<void> {
    if (!this.state.session) return
    await submitDeliveryResult(this.state.session.id, turnId, outcome, stateJson)
    this.state.pendingTurnId = null
  }

  async createTurn(turn: Omit<DeliveryTurn, 'id'>): Promise<string> {
    if (!this.state.session) throw new Error('No session')
    return await createDeliveryTurn(this.state.session.id, turn)
  }

  async updateMatchState(matchState: import('../types').MatchState): Promise<void> {
    if (!this.state.session) return
    await updateSessionMatchState(this.state.session.id, matchState)
  }

  async updateStatus(
    status: import('./types').SessionStatus,
    updates?: Partial<GameSession>,
  ): Promise<void> {
    if (!this.state.session) return
    await updateSessionStatus(this.state.session.id, status, updates)
  }

  async leave(): Promise<void> {
    if (!this.state.session) return
    await leaveSession(this.state.session.id, this.state.playerId)
  }

  private setPhase(phase: SyncPhase): void {
    this.state.phase = phase
    this.onStateChange?.(this.state)
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.state.session) {
        this.state.lastPing = Date.now()
      }
    }, 5000)
  }

  static checkTurnTimeout(turn: DeliveryTurn): boolean {
    return turn.phase !== 'complete' && Date.now() - turn.timestamp > TURN_TIMEOUT_MS
  }

  static checkReconnectTimeout(session: GameSession): boolean {
    return Date.now() - session.updatedAt > 60000
  }
}
