import type { BowlingMeter, BowlingInput, DeliveryType } from './types'
import type { BallLine, BallLength } from '../batting/types'

export function createBowlingMeter(): BowlingMeter {
  return { power: 0, phase: 'idle' }
}

export function startCharge(): BowlingMeter {
  return { power: 0, phase: 'charging' }
}

export function updateCharge(current: BowlingMeter, deltaMs: number): BowlingMeter {
  if (current.phase !== 'charging') return current
  const increment = deltaMs * 0.002
  const power = Math.min(1, current.power + increment)
  return { ...current, power }
}

export function releaseCharge(current: BowlingMeter): BowlingMeter {
  return { ...current, phase: 'locked' }
}

export function resetMeter(): BowlingMeter {
  return { power: 0, phase: 'idle' }
}

export function calcAccuracyPenalty(
  delivery: DeliveryType,
  _targetLine: BallLine,
  _targetLength: BallLength,
  power: number,
  accuracy: number,
  stamina: number,
  oversBowled: number,
): number {
  const base = 1 - accuracy * 0.6
  const powerPenalty = Math.abs(power - 0.7) * 0.2
  const staminaDecay = (1 - stamina / 100) * (oversBowled / 4) * 0.15
  const deliveryDifficulty = delivery === 'yorker' || delivery === 'bouncer' ? 0.1 : 0
  return Math.min(0.6, base + powerPenalty + staminaDecay + deliveryDifficulty)
}

export function calcSpeed(
  delivery: DeliveryType,
  power: number,
  paceSkill: number,
): number {
  const speedRange = DELIVERY_SPEEDS_RANGE[delivery]
  const baseSpeed = speedRange.min + (speedRange.max - speedRange.min) * power
  const skillBonus = (paceSkill / 100) * 10
  return Math.round(baseSpeed + skillBonus)
}

const DELIVERY_SPEEDS_RANGE: Record<string, { min: number; max: number }> = {
  fast: { min: 140, max: 155 },
  medium: { min: 115, max: 135 },
  yorker: { min: 130, max: 150 },
  bouncer: { min: 135, max: 150 },
  inswing: { min: 130, max: 148 },
  outswing: { min: 130, max: 148 },
  off_spin: { min: 75, max: 95 },
  leg_spin: { min: 75, max: 95 },
}

export function createBowlingInput(
  delivery: DeliveryType,
  targetLine: BallLine,
  targetLength: BallLength,
  power: number,
  swingAmount: number,
  releaseTime: number,
): BowlingInput {
  return { delivery, targetLine, targetLength, power, swingAmount, releaseTime }
}
