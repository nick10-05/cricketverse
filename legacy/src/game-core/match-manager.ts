import type { MatchState, TeamConfig, PitchCondition, WeatherState, TossResult, InningsState, MatchResult, MatchEvent } from './types'
import { simulateInnings as autoSimulateInnings } from './innings-manager'
import { computeMatchResult, getScoreSummary } from './score-manager'

export function createMatchState(
  id: string,
  tournamentId: string,
  teamA: TeamConfig,
  teamB: TeamConfig,
  maxOvers: number,
  pitch: PitchCondition,
  weather: WeatherState | null,
): MatchState {
  return {
    id,
    tournamentId,
    status: 'toss',
    maxOvers,
    pitch,
    weather,
    toss: null,
    teamA,
    teamB,
    currentInnings: null,
    innings: [null, null],
    result: null,
  }
}

export function doToss(teamA: TeamConfig, teamB: TeamConfig): TossResult {
  const winner = Math.random() < 0.5 ? teamA : teamB
  const chose = Math.random() < 0.5 ? 'bat' : 'bowl'
  const battingTeamId = chose === 'bat' ? winner.id : (winner.id === teamA.id ? teamB.id : teamA.id)
  const bowlingTeamId = chose === 'bowl' ? winner.id : (winner.id === teamA.id ? teamB.id : teamA.id)
  return {
    winnerId: winner.id,
    winnerName: winner.name,
    chose,
    battingTeamId,
    bowlingTeamId,
  }
}

export function getTeamConfig(state: MatchState, teamId: string): TeamConfig {
  return state.teamA.id === teamId ? state.teamA : state.teamB
}

export function getBattingTeam(state: MatchState, inningsNum: 1 | 2): TeamConfig {
  if (!state.toss) throw new Error('Toss not completed')
  if (inningsNum === 1) {
    return getTeamConfig(state, state.toss.battingTeamId)
  }
  return getTeamConfig(state, state.toss.bowlingTeamId)
}

export function getBowlingTeam(state: MatchState, inningsNum: 1 | 2): TeamConfig {
  if (!state.toss) throw new Error('Toss not completed')
  if (inningsNum === 1) {
    return getTeamConfig(state, state.toss.bowlingTeamId)
  }
  return getTeamConfig(state, state.toss.battingTeamId)
}

export function startMatch(state: MatchState, toss: TossResult): MatchState {
  return {
    ...state,
    toss,
    status: 'innings1',
    currentInnings: 1,
  }
}

export function autoPlayMatch(state: MatchState): MatchEvent[] {
  const events: MatchEvent[] = []

  const toss = doToss(state.teamA, state.teamB)
  state.toss = toss
  state.status = 'innings1'
  state.currentInnings = 1
  events.push({ type: 'toss', result: toss })

  const inns1State = autoPlayInnings(state, 1, events)
  state.innings[0] = inns1State

  state.status = 'innings2'
  state.currentInnings = 2

  const inns2State = autoPlayInnings(state, 2, events)
  state.innings[1] = inns2State

  const result = computeMatchResult(
    inns1State, inns2State,
    state.teamA.id, state.teamA.name,
    state.teamB.id, state.teamB.name,
  )
  state.result = result
  state.status = 'completed'
  events.push({ type: 'match_end', result })

  return events
}

function autoPlayInnings(state: MatchState, inningsNum: 1 | 2, events: MatchEvent[]): InningsState {
  const battingTeam = getBattingTeam(state, inningsNum)
  const bowlingTeam = getBowlingTeam(state, inningsNum)
  const target = inningsNum === 2 && state.innings[0]
    ? state.innings[0]!.total + 1
    : null

  const result = autoSimulateInnings(
    battingTeam,
    bowlingTeam,
    state.maxOvers,
    state.pitch,
    state.weather,
    target,
  )

  events.push({ type: 'innings_end', innings: inningsNum, state: result.state })
  return result.state
}

export function switchInnings(state: MatchState): void {
  if (state.currentInnings === 1) {
    state.currentInnings = 2
    state.status = 'innings2'
  }
}

export function setInningsResult(state: MatchState, inningsNum: 1 | 2, innings: InningsState): void {
  state.innings[inningsNum - 1] = innings
}

export function finalizeMatch(state: MatchState): MatchResult | null {
  if (!state.innings[0] || !state.innings[1]) return null

  const result = computeMatchResult(
    state.innings[0], state.innings[1],
    state.teamA.id, state.teamA.name,
    state.teamB.id, state.teamB.name,
  )
  state.result = result
  state.status = 'completed'
  return result
}

export function getMatchSummary(state: MatchState): string {
  const lines: string[] = [`${state.teamA.name} vs ${state.teamB.name}`]
  if (state.toss) {
    lines.push(`${state.toss.winnerName} won the toss and chose to ${state.toss.chose}`)
  }
  for (let i = 0; i < 2; i++) {
    const inns = state.innings[i]
    if (inns) {
      const battingTeam = i === 0
        ? getTeamConfig(state, state.toss!.battingTeamId)
        : getTeamConfig(state, state.toss!.bowlingTeamId)
      lines.push(`${battingTeam.name}: ${getScoreSummary(inns)}`)
    }
  }
  if (state.result) {
    lines.push(`${state.result.winnerName} won by ${state.result.winMargin}`)
  }
  return lines.join('\n')
}
