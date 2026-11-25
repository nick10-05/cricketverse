import type { TeamRoleState } from './team-types'
import type { SessionTeamState } from './types'
import { AGGRESSION_FIELD_MAP, type FieldAggression } from './team-types'
import type { FieldingState } from '../fielding/types'
import type { GamePlayer } from '../types'

export class TeamCoordinator {
  private sessionTeamState: SessionTeamState
  private format: '1v1' | '2v2'

  constructor(
    format: '1v1' | '2v2',
    initialRoles?: SessionTeamState,
  ) {
    this.format = format
    this.sessionTeamState = initialRoles ?? this.createEmptyRoles()
  }

  getState(): SessionTeamState {
    return this.sessionTeamState
  }

  setState(state: SessionTeamState): void {
    this.sessionTeamState = state
  }

  private createEmptyRoles(): SessionTeamState {
    return {
      teamA: { strikerId: '', nonStrikerId: '', bowlerId: '', captainId: '', lastOverBowlerId: null },
      teamB: { strikerId: '', nonStrikerId: '', bowlerId: '', captainId: '', lastOverBowlerId: null },
    }
  }

  initializeRoles(
    teamA: { playerIds: string[]; name: string },
    teamB: { playerIds: string[]; name: string },
  ): SessionTeamState {
    if (this.format === '1v1') {
      this.sessionTeamState = {
        teamA: {
          strikerId: teamA.playerIds[0] ?? '',
          nonStrikerId: teamA.playerIds[0] ?? '',
          bowlerId: teamA.playerIds[0] ?? '',
          captainId: teamA.playerIds[0] ?? '',
          lastOverBowlerId: null,
        },
        teamB: {
          strikerId: teamB.playerIds[0] ?? '',
          nonStrikerId: teamB.playerIds[0] ?? '',
          bowlerId: teamB.playerIds[0] ?? '',
          captainId: teamB.playerIds[0] ?? '',
          lastOverBowlerId: null,
        },
      }
    } else {
      this.sessionTeamState = {
        teamA: this.initTeamRoles(teamA.playerIds),
        teamB: this.initTeamRoles(teamB.playerIds),
      }
    }
    return this.sessionTeamState
  }

  private initTeamRoles(playerIds: string[]): TeamRoleState {
    const p1 = playerIds[0] ?? ''
    const p2 = playerIds[1] ?? ''
    return {
      teamId: '',
      strikerId: p1,
      nonStrikerId: p2,
      bowlerId: p1,
      captainId: p2,
      lastOverBowlerId: null,
    }
  }

  getTeamRole(playerId: string, teamId: 'teamA' | 'teamB'): import('./team-types').TeamRole | null {
    const t = this.sessionTeamState[teamId]
    if (t.strikerId === playerId) return 'striker'
    if (t.nonStrikerId === playerId) return 'non_striker'
    if (t.bowlerId === playerId) return 'bowler'
    if (t.captainId === playerId) return 'captain'
    return null
  }

  getRolesForTeam(teamId: 'teamA' | 'teamB'): TeamRoleState {
    return this.sessionTeamState[teamId] as TeamRoleState
  }

  swapBattingRoles(teamId: 'teamA' | 'teamB'): void {
    const t = this.sessionTeamState[teamId]
    const temp = t.strikerId
    t.strikerId = t.nonStrikerId
    t.nonStrikerId = temp
  }

  onWicket(teamId: 'teamA' | 'teamB', dismissedId: string, availableBatters: string[]): void {
    const t = this.sessionTeamState[teamId]
    if (t.strikerId === dismissedId) {
      const replacement = availableBatters.find((id) => id !== t.nonStrikerId && id !== dismissedId)
      if (replacement) t.strikerId = replacement
    } else if (t.nonStrikerId === dismissedId) {
      const replacement = availableBatters.find((id) => id !== t.strikerId && id !== dismissedId)
      if (replacement) t.nonStrikerId = replacement
    }
  }

  rotateBowlingRoles(teamId: 'teamA' | 'teamB'): void {
    const t = this.sessionTeamState[teamId]
    t.lastOverBowlerId = t.bowlerId
    const temp = t.bowlerId
    t.bowlerId = t.captainId
    t.captainId = temp
  }

  endOfOverRotation(battingTeamId: 'teamA' | 'teamB', bowlingTeamId: 'teamA' | 'teamB'): void {
    this.swapBattingRoles(battingTeamId)
    this.rotateBowlingRoles(bowlingTeamId)
  }

  buildFieldingState(
    bowlingTeamId: 'teamA' | 'teamB',
    teamPlayers: GamePlayer[],
    aggression: FieldAggression = 'neutral',
  ): FieldingState {
    const roles = this.sessionTeamState[bowlingTeamId]
    const nonBowlerFielders = teamPlayers.filter((p) => p.id !== roles.bowlerId)

    const zones = AGGRESSION_FIELD_MAP[aggression]
    const fielders = nonBowlerFielders.slice(0, zones.length).map((p, i) => ({
      playerId: p.id,
      playerName: p.name,
      position: zones[i] ?? 'point',
      catchingSkill: p.skills.catching / 100,
      throwingSkill: p.skills.accuracy / 100,
      reflexes: (p.skills.catching * 0.7 + p.skills.accuracy * 0.3) / 100,
      stamina: p.skills.stamina / 100,
      speed: 0.4 + (p.skills.stamina / 100) * 0.4,
    }))

    return {
      fielders,
      wicketKeeperId: fielders.find((f) => f.position === 'wicket')?.playerId ?? '',
      bowlerId: roles.bowlerId,
    }
  }

  hasRoleInTeam(playerId: string, teamId: 'teamA' | 'teamB'): boolean {
    const t = this.sessionTeamState[teamId]
    return (
      t.strikerId === playerId ||
      t.nonStrikerId === playerId ||
      t.bowlerId === playerId ||
      t.captainId === playerId
    )
  }

  isPartOfBattingTeam(playerId: string, battingTeamId: 'teamA' | 'teamB'): boolean {
    return this.hasRoleInTeam(playerId, battingTeamId)
  }

  isPartOfBowlingTeam(playerId: string, bowlingTeamId: 'teamA' | 'teamB'): boolean {
    return this.hasRoleInTeam(playerId, bowlingTeamId)
  }

  getPlayerTeamId(playerId: string, teamAIds: string[], teamBIds: string[]): 'teamA' | 'teamB' | null {
    if (teamAIds.includes(playerId)) return 'teamA'
    if (teamBIds.includes(playerId)) return 'teamB'
    return null
  }

  getTeammateId(playerId: string, teamId: 'teamA' | 'teamB'): string | null {
    const t = this.sessionTeamState[teamId]
    const all = [t.strikerId, t.nonStrikerId, t.bowlerId, t.captainId]
    return all.find((id) => id !== playerId && id !== '') ?? null
  }
}

export function createTeamCoordinator(
  format: '1v1' | '2v2',
  teamA: { playerIds: string[]; name: string },
  teamB: { playerIds: string[]; name: string },
): TeamCoordinator {
  const coordinator = new TeamCoordinator(format)
  coordinator.initializeRoles(teamA, teamB)
  return coordinator
}
