import type {
  BallOutcome, BallEvent, BallOutcomeType,
  GamePlayer, PlayerSkills, PitchCondition, WeatherState,
  InningsState,
} from './types'
import { getBattingStats, getBowlingStats, recordBattingEvent, recordBowlingEvent, getOversBowled } from './score-manager'
import { swapStrikeIfNeeded, resolveWicketType } from './wicket-manager'

function calcFatigue(stamina: number, ballsDone: number, totalBalls: number): number {
  const base = stamina / 100
  const decay = (ballsDone / Math.max(totalBalls, 1)) * (1 - base) * 0.5
  return Math.max(0.4, base - decay)
}

function calcPressure(score: number, _wickets: number, oversBowled: number, target: number | null): number {
  if (target === null) return 0
  const remainingRuns = target - score
  const remainingOvers = Math.max(0.1, 20 - oversBowled)
  const requiredRate = remainingRuns / remainingOvers
  const scoringRate = score / Math.max(oversBowled, 0.1)
  const baseRate = Math.max(scoringRate, 3)
  if (requiredRate <= 0) return 0
  const pressure = (requiredRate / baseRate - 1) * 0.5
  return Math.max(0, Math.min(1, pressure))
}

export function autoResolveBall(
  state: InningsState,
  striker: GamePlayer,
  bowler: GamePlayer,
  pitch: PitchCondition,
  weather: WeatherState | null,
  overNumber: number,
  ballInOver: number,
  totalBalls: number,
): BallOutcome {
  const bSkill = (s: keyof PlayerSkills) => (striker.skills[s] / 100) * calcFatigue(striker.skills.stamina, getBattingStats(state, striker.id).ballsFaced, totalBalls)
  const bwSkill = (s: keyof PlayerSkills) => (bowler.skills[s] / 100) * calcFatigue(bowler.skills.stamina, getBowlingStats(state, bowler.id).legalBalls, totalBalls)

  const power = bSkill('power')
  const timing = bSkill('timing')
  const technique = bSkill('technique')

  const accuracy = bwSkill('accuracy')
  const pace = bwSkill('pace')
  const swing = bwSkill('swing')
  const spin = bwSkill('spin')

  const isPacer = bowler.skills.pace > bowler.skills.spin
  const bowlingPrimary = isPacer ? pace : spin

  const oversBowled = getOversBowled(state.legalBalls)
  const pressure = calcPressure(state.total, state.wickets, oversBowled, state.target)

  let dotW = 100
  let singleW = 80
  let doubleW = 22
  let tripleW = 5
  let fourW = 35
  let sixW = 10
  let wicketW = 14
  let wideW = 10
  let noBallW = 5

  dotW *= 1 - timing * 0.12
  singleW *= 1 + timing * 0.10
  doubleW *= 1 + timing * 0.08
  fourW *= 1 + power * 0.20 + timing * 0.05
  sixW *= 1 + power * 0.35
  wicketW *= 1 - technique * 0.20

  dotW *= 1 + accuracy * 0.15 + bowlingPrimary * 0.10
  singleW *= 1 - accuracy * 0.08
  fourW *= 1 - (accuracy * 0.10 + bowlingPrimary * 0.08)
  sixW *= 1 - bowlingPrimary * 0.15
  wicketW *= 1 + (swing + spin) * 0.15 + accuracy * 0.08
  wideW *= 1 - accuracy * 0.60
  noBallW *= 1 - accuracy * 0.40

  const staminaDecay = (4 - calcFatigue(striker.skills.stamina, getBattingStats(state, striker.id).ballsFaced, totalBalls)) * 0.15
  wicketW *= 1 + staminaDecay
  dotW *= 1 + staminaDecay * 0.5
  fourW *= 1 - staminaDecay * 0.3
  sixW *= 1 - staminaDecay * 0.4

  dotW *= 1 - pressure * 0.15
  fourW *= 1 + pressure * 0.15
  sixW *= 1 + pressure * 0.20
  wicketW *= 1 + pressure * 0.25
  singleW *= 1 - pressure * 0.10

  dotW *= 1 - pitch.batting * 0.10 + pitch.bowling * 0.10
  fourW *= 1 + pitch.batting * 0.15
  sixW *= 1 + pitch.batting * 0.10
  wicketW *= 1 + pitch.bowling * 0.15 - pitch.batting * 0.10

  if (isPacer) {
    wicketW *= 1 + pitch.paceSupport * 0.15
    fourW *= 1 - pitch.paceSupport * 0.05
  } else {
    wicketW *= 1 + pitch.spinSupport * 0.20
    fourW *= 1 - pitch.spinSupport * 0.05
  }

  if (overNumber >= 16) {
    fourW *= 1.15
    sixW *= 1.20
    wicketW *= 1.10
  }

  if (weather) {
    if (weather.swingMod !== 1.0 && isPacer) {
      const swingBoost = (weather.swingMod - 1.0) * 0.3
      wicketW *= 1 + swingBoost
      fourW *= 1 - swingBoost * 0.5
      dotW *= 1 + swingBoost * 0.3
    }
    if (weather.spinMod !== 1.0 && !isPacer) {
      const spinBoost = (weather.spinMod - 1.0) * 0.3
      wicketW *= 1 + spinBoost
      fourW *= 1 - spinBoost * 0.5
      dotW *= 1 + spinBoost * 0.3
    }
    if (weather.battingMod < 1.0) {
      const battingPenalty = (1.0 - weather.battingMod) * 0.5
      dotW *= 1 + battingPenalty * 0.2
      fourW *= 1 - battingPenalty * 0.15
      sixW *= 1 - battingPenalty * 0.2
    }
  }

  if (ballInOver >= 4) {
    dotW *= 1.05
  }

  const bowlerOversBowled = state.bowlerOversCount[bowler.id] ?? 0
  const overFatigue = bowlerOversBowled / 4
  wideW *= 1 + overFatigue * 0.15
  fourW *= 1 + overFatigue * 0.10

  const weights = [
    Math.max(dotW, 5), Math.max(singleW, 5), Math.max(doubleW, 2),
    Math.max(tripleW, 1), Math.max(fourW, 5), Math.max(sixW, 1),
    Math.max(wicketW, 2), Math.max(wideW, 1), Math.max(noBallW, 1),
  ]

  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * totalWeight
  let outcomeIdx = 0
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]
    if (roll <= 0) {
      outcomeIdx = i
      break
    }
  }

  return resolveOutcome(outcomeIdx, striker, bowler, pitch)
}

function resolveOutcome(
  index: number,
  striker: GamePlayer,
  bowler: GamePlayer,
  pitch: PitchCondition,
): BallOutcome {
  const outcomeTypes: BallOutcomeType[] = ['dot', 'single', 'double', 'triple', 'four', 'six', 'wicket']
  const isPacer = bowler.skills.pace > bowler.skills.spin

  if (index === 7) {
    return { type: 'dot', runs: 1, isWicket: false, wicketType: null, isExtra: true, extraType: 'wide', isLegal: false }
  }
  if (index === 8) {
    const nbRuns = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 4
    return { type: 'dot', runs: nbRuns, isWicket: false, wicketType: null, isExtra: true, extraType: 'no_ball', isLegal: false }
  }

  if (outcomeTypes[index] === 'wicket') {
    const wicketRes = resolveWicketType(striker.skills, bowler.skills, pitch, null, isPacer)
    return {
      type: 'wicket', runs: 0, isWicket: true,
      wicketType: wicketRes.wicketType, isExtra: false, extraType: null, isLegal: true,
    }
  }

  const runMap: Record<string, number> = { dot: 0, single: 1, double: 2, triple: 3, four: 4, six: 6 }
  const type = outcomeTypes[index]
  const runs = runMap[type] ?? 0

  return { type, runs, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
}

export interface BallContext {
  state: InningsState
  striker: GamePlayer
  nonStriker: GamePlayer
  bowler: GamePlayer
  pitch: PitchCondition
  weather: WeatherState | null
  overNumber: number
  ballInOver: number
  totalBalls: number
}

export function processBall(
  ctx: BallContext,
  outcome: BallOutcome,
): BallEvent {
  const { state, striker, bowler, overNumber, ballInOver } = ctx
  const isLegal = outcome.isLegal

  if (isLegal) {
    state.legalBalls++

    if (outcome.type === 'dot') {
      recordBattingEvent(state, striker.id, 0, false, false, true)
      recordBowlingEvent(state, bowler.id, 0, false, false, false, true)
    } else if (outcome.isWicket) {
      recordBowlingEvent(state, bowler.id, 0, true, false, false, false)
    } else {
      recordBattingEvent(state, striker.id, outcome.runs, outcome.type === 'four', outcome.type === 'six', false)
      recordBowlingEvent(state, bowler.id, outcome.runs, false, false, false, false)
      state.total += outcome.runs
      state.currentPartnershipRuns += outcome.runs
      state.currentPartnershipBalls++
      swapStrikeIfNeeded(state, outcome.runs)
    }
  } else {
    if (outcome.extraType === 'wide') {
      state.total++
      recordBowlingEvent(state, bowler.id, 1, false, true, false, false)
      state.currentPartnershipRuns++
    } else if (outcome.extraType === 'no_ball') {
      state.total += outcome.runs
      recordBattingEvent(state, striker.id, outcome.runs, false, false, false)
      recordBowlingEvent(state, bowler.id, outcome.runs, false, false, true, false)
      state.currentPartnershipRuns += outcome.runs
      swapStrikeIfNeeded(state, outcome.runs)
    }
  }

  state.totalDeliveries++

  const event: BallEvent = {
    over: overNumber,
    ballInOver,
    batterId: striker.id,
    batterName: striker.name,
    bowlerId: bowler.id,
    bowlerName: bowler.name,
    outcome,
    totalScore: state.total,
    totalWickets: state.wickets,
    partnershipRuns: state.currentPartnershipRuns,
    partnershipBalls: state.currentPartnershipBalls,
    runsThisOver: 0,
    ballsInOver: ballInOver,
  }

  return event
}
