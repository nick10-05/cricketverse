import type { GamePlayer, PitchCondition, WeatherState, InningsState } from '../types'
import type { BallApproach } from '../batting/types'
import type { BowlingInput, DeliveryResult, DeliveryType } from './types'
import { calcAccuracyPenalty, calcSpeed } from './controls'

export function resolveDelivery(
  input: BowlingInput,
  bowler: GamePlayer,
  pitch: PitchCondition,
  weather: WeatherState | null,
  state: InningsState,
): DeliveryResult {
  const accuracy = bowler.skills.accuracy / 100
  const swingSkill = bowler.skills.swing / 100
  const spinSkill = bowler.skills.spin / 100
  const stamina = bowler.skills.stamina
  const oversBowled = state.bowlerOversCount[bowler.id] ?? 0

  const accuracyPenalty = calcAccuracyPenalty(
    input.delivery, input.targetLine, input.targetLength,
    input.power, accuracy, stamina, oversBowled,
  )

  const lineDeviation = (Math.random() * 2 - 1) * accuracyPenalty * 2
  const lengthDeviation = (Math.random() * 2 - 1) * accuracyPenalty * 1.5

  const actualLineIndex = clampLine(LINE_ORDER.indexOf(input.targetLine) + Math.round(lineDeviation))
  const actualLengthIndex = clampLength(LENGTH_ORDER.indexOf(input.targetLength) + Math.round(lengthDeviation))

  const actualLine = LINE_ORDER[actualLineIndex]
  const actualLength = LENGTH_ORDER[actualLengthIndex]

  const isPace = input.delivery !== 'off_spin' && input.delivery !== 'leg_spin'

  const speed = calcSpeed(input.delivery, input.power, bowler.skills.pace)

  const swingFactor = resolveSwing(input.delivery, swingSkill, input.swingAmount, weather, pitch, isPace)
  const spinFactor = resolveSpin(input.delivery, spinSkill, input.swingAmount, weather, pitch, !isPace)
  const bounce = resolveBounce(input.delivery, pitch, actualLength)

  const approach: BallApproach = {
    type: isPace ? 'pace' : 'spin',
    length: actualLength,
    line: actualLine,
    speed: speed / 155,
    swing: swingFactor,
    spin: spinFactor,
    bounce,
  }

  const isWide = checkWide(actualLine, actualLength, accuracyPenalty)
  const isNoBall = Math.random() < (1 - accuracy) * 0.08

  return {
    delivery: input.delivery,
    approach,
    accuracy: 1 - accuracyPenalty,
    deviation: { line: lineDeviation, length: lengthDeviation },
    isWide,
    isNoBall,
    speed,
    swingEffective: swingFactor,
    bounceAmount: bounce,
  }
}

function resolveSwing(
  delivery: DeliveryType,
  swingSkill: number,
  swingInput: number,
  weather: WeatherState | null,
  pitch: PitchCondition,
  isPace: boolean,
): number {
  if (!isPace || (delivery !== 'inswing' && delivery !== 'outswing' && delivery !== 'fast' && delivery !== 'medium')) {
    return 0
  }

  let baseSwing = swingSkill * swingInput * 0.6

  if (delivery === 'inswing' || delivery === 'outswing') {
    baseSwing *= 1.5
  }

  if (weather && weather.swingMod !== 1.0 && isPace) {
    baseSwing *= weather.swingMod
  }

  baseSwing *= 1 + pitch.paceSupport * 0.3

  const direction = delivery === 'inswing' ? 1 : -1
  return Math.min(1, baseSwing) * direction
}

function resolveSpin(
  delivery: DeliveryType,
  spinSkill: number,
  spinInput: number,
  weather: WeatherState | null,
  pitch: PitchCondition,
  isSpin: boolean,
): number {
  if (!isSpin || (delivery !== 'off_spin' && delivery !== 'leg_spin')) {
    return 0
  }

  let baseSpin = spinSkill * spinInput * 0.7

  if (weather && weather.spinMod !== 1.0) {
    baseSpin *= weather.spinMod
  }

  baseSpin *= 1 + pitch.spinSupport * 0.4

  const direction = delivery === 'leg_spin' ? 1 : -1
  return Math.min(1, baseSpin) * direction
}

function resolveBounce(
  delivery: DeliveryType,
  pitch: PitchCondition,
  length: string,
): number {
  let base = 0.5
  if (delivery === 'bouncer') base += 0.3
  if (delivery === 'yorker') base -= 0.2

  if (length === 'short' || length === 'bouncer') base += 0.2
  if (length === 'yorker' || length === 'full') base -= 0.1

  base *= 1 + pitch.bowling * 0.3
  return Math.max(0, Math.min(1, base))
}

function checkWide(line: string, _length: string, accuracyPenalty: number): boolean {
  if (line === 'outside_off' || line === 'down_leg') {
    return Math.random() < accuracyPenalty * 0.5
  }
  return false
}

const LINE_ORDER = ['outside_off', 'off_stump', 'middle_stump', 'leg_stump', 'down_leg'] as const
const LENGTH_ORDER = ['yorker', 'full', 'good', 'short', 'bouncer'] as const

function clampLine(index: number): number {
  return Math.max(0, Math.min(LINE_ORDER.length - 1, index))
}

function clampLength(index: number): number {
  return Math.max(0, Math.min(LENGTH_ORDER.length - 1, index))
}

export function findEligibleBowlers(
  players: GamePlayer[],
  bowlerOversCount: Record<string, number>,
  maxOversPerBowler: number,
): GamePlayer[] {
  return players.filter(
    (p) => (p.role === 'bowler' || p.role === 'all_rounder')
      && (bowlerOversCount[p.id] ?? 0) < maxOversPerBowler,
  )
}
