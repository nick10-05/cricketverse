import type { InningsState, GamePlayer, PitchCondition, WeatherState, InningsEvent } from './types'
import { simulateOver, selectBowler } from './over-manager'
import { isInningsComplete } from './score-manager'

export function createInnings(
  battingTeam: { id: string; name: string; players: GamePlayer[]; battingOrder: string[] },
  bowlingTeam: { id: string; name: string; players: GamePlayer[] },
  maxOvers: number,
  target: number | null,
): InningsState {
  const bowlers = bowlingTeam.players.filter(
    (p) => p.role === 'bowler' || p.role === 'all_rounder',
  )

  const battingStats: Record<string, import('./types').BattingStats> = {}
  const bowlingStats: Record<string, import('./types').BowlingStats> = {}

  return {
    battingTeamId: battingTeam.id,
    battingTeamName: battingTeam.name,
    bowlingTeamId: bowlingTeam.id,
    bowlingTeamName: bowlingTeam.name,
    total: 0,
    wickets: 0,
    legalBalls: 0,
    totalDeliveries: 0,
    battingStats,
    bowlingStats,
    strikerId: battingTeam.battingOrder[0],
    nonStrikerId: battingTeam.battingOrder[1],
    nextBatterIndex: 2,
    battingOrder: [...battingTeam.battingOrder],
    currentOver: null,
    completedOvers: [],
    fallOfWickets: [],
    partnerships: [],
    currentPartnershipRuns: 0,
    currentPartnershipBalls: 0,
    bowlerOversCount: Object.fromEntries(bowlers.map((b) => [b.id, 0])),
    target,
    completed: false,
    maxOvers,
  }
}

export interface InningsSimResult {
  state: InningsState
  events: InningsEvent[]
}

export function simulateInnings(
  battingTeam: { id: string; name: string; players: GamePlayer[]; battingOrder: string[] },
  bowlingTeam: { id: string; name: string; players: GamePlayer[] },
  maxOvers: number,
  pitch: PitchCondition,
  weather: WeatherState | null,
  target: number | null,
): InningsSimResult {
  const state = createInnings(battingTeam, bowlingTeam, maxOvers, target)
  const events: InningsEvent[] = []
  const playerMap = new Map(battingTeam.players.map((p) => [p.id, p]))
  const bowlers = bowlingTeam.players.filter(
    (p) => p.role === 'bowler' || p.role === 'all_rounder',
  )
  const totalBalls = maxOvers * 6

  let striker = playerMap.get(state.strikerId)!
  let nonStriker = playerMap.get(state.nonStrikerId)!

  for (let overNumber = 1; overNumber <= maxOvers; overNumber++) {
    if (isInningsComplete(state)) {
      state.completed = true
      break
    }

    const bowler = selectBowler(state, bowlers)
    if (!bowler) break

    events.push({
      type: 'over_start',
      overNumber,
      bowlerId: bowler.id,
      bowlerName: bowler.name,
    })

    const result = simulateOver(
      state, striker, nonStriker, bowler,
      battingTeam.players, battingTeam.players,
      pitch, weather, overNumber, totalBalls,
    )

    for (const ballEvent of result.events) {
      events.push({ type: 'ball', event: ballEvent })
    }

    events.push({ type: 'over_end', over: result.over })

    striker = playerMap.get(state.strikerId)!
    nonStriker = playerMap.get(state.nonStrikerId)!

    if (result.inningsComplete) {
      state.completed = true
      break
    }
  }

  state.completed = true
  events.push({ type: 'innings_end', state })

  return { state, events }
}
