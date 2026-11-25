import type { BallLine, BallLength } from '../batting/types'

export type DeliveryType =
  | 'fast'
  | 'medium'
  | 'yorker'
  | 'bouncer'
  | 'inswing'
  | 'outswing'
  | 'off_spin'
  | 'leg_spin'

export type BowlingAction = 'select' | 'charge' | 'release'

export interface BowlingInput {
  delivery: DeliveryType
  targetLine: BallLine
  targetLength: BallLength
  power: number
  swingAmount: number
  releaseTime: number
}

export interface BowlingMeter {
  power: number
  phase: 'idle' | 'charging' | 'locked'
}

export interface DeliveryResult {
  delivery: DeliveryType
  approach: import('../batting/types').BallApproach
  accuracy: number
  deviation: { line: number; length: number }
  isWide: boolean
  isNoBall: boolean
  speed: number
  swingEffective: number
  bounceAmount: number
}

export const DELIVERY_SPEEDS: Record<DeliveryType, { min: number; max: number }> = {
  fast: { min: 140, max: 155 },
  medium: { min: 115, max: 135 },
  yorker: { min: 130, max: 150 },
  bouncer: { min: 135, max: 150 },
  inswing: { min: 130, max: 148 },
  outswing: { min: 130, max: 148 },
  off_spin: { min: 75, max: 95 },
  leg_spin: { min: 75, max: 95 },
}

export const DELIVERY_LABELS: Record<DeliveryType, string> = {
  fast: 'Fast',
  medium: 'Medium',
  yorker: 'Yorker',
  bouncer: 'Bouncer',
  inswing: 'Inswing',
  outswing: 'Outswing',
  off_spin: 'Off Spin',
  leg_spin: 'Leg Spin',
}

export const DELIVERY_GROUPS: { label: string; types: DeliveryType[] }[] = [
  { label: 'Pace', types: ['fast', 'medium', 'yorker', 'bouncer', 'inswing', 'outswing'] },
  { label: 'Spin', types: ['off_spin', 'leg_spin'] },
]

export const LINE_LABELS: Record<BallLine, string> = {
  off_stump: 'Off',
  middle_stump: 'Middle',
  leg_stump: 'Leg',
  outside_off: 'Outside Off',
  down_leg: 'Down Leg',
}

export const LENGTH_LABELS: Record<BallLength, string> = {
  yorker: 'Yorker',
  full: 'Full',
  good: 'Good',
  short: 'Short',
  bouncer: 'Bouncer',
}

export const LINE_ORDER: BallLine[] = ['outside_off', 'off_stump', 'middle_stump', 'leg_stump', 'down_leg']
export const LENGTH_ORDER: BallLength[] = ['yorker', 'full', 'good', 'short', 'bouncer']
