import type { InningsState, GamePlayer, PitchCondition, WeatherState, BallEvent, OverState } from './types'
import { processBall, autoResolveBall, type BallContext } from './ball-manager'
import { getNextBatter } from './wicket-manager'
import { getBowlingStats, isInningsComplete } from './score-manager'

export function createOver(overNumber: number, bowler: GamePlayer): OverState {
  return {
    overNumber,
    bowlerId: bowler.id,
    bowlerName: bowler.name,
    balls: [],
    runsConceded: 0,
    wickets: 0,
    legalDeliveries: 0,
    completed: false,
  }
}

export function selectBowler(
  state: InningsState,
  availableBowlers: GamePlayer[],
): GamePlayer | null {
  const eligible = availableBowlers.filter((b) => {
    const oversBowled = state.bowlerOversCount[b.id] ?? 0
    return oversBowled < 4
  })
  if (eligible.length === 0) return null
  return eligible[Math.floor(Math.random() * eligible.length)]
}

export interface OverResult {
  over: OverState
  events: BallEvent[]
  inningsComplete: boolean
}

export function simulateOver(
  state: InningsState,
  striker: GamePlayer,
  nonStriker: GamePlayer,
  bowler: GamePlayer,
  battingOrder: GamePlayer[],
  allPlayers: GamePlayer[],
  pitch: PitchCondition,
  weather: WeatherState | null,
  overNumber: number,
  totalBalls: number,
): OverResult {
  const over = createOver(overNumber, bowler)
  const events: BallEvent[] = []
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]))
  let currentStriker = striker
  let currentNonStriker = nonStriker
  let inningsComplete = false

  for (let ballInOver = 1; ballInOver <= 6; ballInOver++) {
    if (isInningsComplete(state)) {
      inningsComplete = true
      break
    }

    const outcome = autoResolveBall(
      state, currentStriker, bowler, pitch, weather,
      overNumber, ballInOver, totalBalls,
    )

    const ctx: BallContext = {
      state,
      striker: currentStriker,
      nonStriker: currentNonStriker,
      bowler,
      pitch,
      weather,
      overNumber,
      ballInOver,
      totalBalls,
    }

    const event = processBall(ctx, outcome)

    if (outcome.isLegal) {
      over.runsConceded += outcome.runs
    } else {
      over.runsConceded += outcome.runs + (outcome.extraType === 'wide' ? 1 : 0)
    }

    if (outcome.isLegal && !outcome.isWicket) {
      over.legalDeliveries++
    }

    event.runsThisOver = over.runsConceded
    event.ballsInOver = over.legalDeliveries

    if (outcome.isWicket) {
      over.wickets++
      const bowlingStats = getBowlingStats(state, bowler.id)
      bowlingStats.wickets++

      const nextBatterId = getNextBatter(state, battingOrder)
      if (nextBatterId) {
        const nextPlayer = playerMap.get(nextBatterId)
        if (nextPlayer) {
          currentStriker = nextPlayer
        }
      }
    }

    events.push(event)

    if (isInningsComplete(state)) {
      inningsComplete = true
      break
    }
  }

  over.completed = true
  state.bowlerOversCount[bowler.id] = (state.bowlerOversCount[bowler.id] ?? 0) + 1
  state.currentOver = over
  state.completedOvers.push(over)

  if (!inningsComplete) {
    const temp = currentStriker
    currentStriker = currentNonStriker
    currentNonStriker = temp
  }

  state.strikerId = currentStriker.id
  state.nonStrikerId = currentNonStriker.id

  return { over, events, inningsComplete }
}
