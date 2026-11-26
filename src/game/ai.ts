import { randomSeed, trajectory, timingWindows } from './physics'
import { currentInnings, requiredRate } from './rules'
import type { Delivery, DeliveryType, FieldSetting, MatchState, ShotInput } from './types'

const PACE: DeliveryType[] = ['fast', 'fast', 'swing', 'seam', 'yorker', 'bouncer', 'slower']
const SPIN: DeliveryType[] = ['spin', 'spin', 'spin', 'slower', 'yorker']

/** Pick a field from the match situation: attack early wickets, defend a small target late on. */
export function botField(m?: MatchState | null): FieldSetting {
  if (!m) return 'balanced'
  const inn = currentInnings(m)
  const total = m.settings.overs * 6
  const left = total - inn.balls
  if (inn.target !== null) {
    const rr = requiredRate(inn, m.settings.overs)
    if (rr && rr.rate > 11) return 'attacking' // they must slog: set catchers
    if (rr && rr.rate < 7) return 'defensive' // cut off the boundaries
  }
  if (inn.balls < total * 0.25) return 'attacking'
  if (left <= 12) return 'defensive'
  return 'balanced'
}

export function botDelivery(m?: MatchState | null): Delivery {
  // Each bot bowler is a pacer or a spinner, decided by their position in the over rotation.
  const inn = m ? currentInnings(m) : null
  const spinner = inn ? inn.bowlerIdx % 3 === 2 : Math.random() < 0.25
  const pool = spinner ? SPIN : PACE
  const type = pool[Math.floor(Math.random() * pool.length)]
  return {
    type,
    line: (Math.random() - 0.35) * 0.7,
    length: type === 'yorker' ? 0.03 : type === 'bouncer' ? 0.9 : 0.25 + Math.random() * 0.45,
    power: 0.55 + Math.random() * 0.4,
    turn: Math.random() < 0.5 ? -1 : 1,
    seed: randomSeed(),
    field: botField(m),
  }
}

/** A bot batter: decent timing, sometimes greedy; slogs harder when chasing a steep rate. */
export function botShot(d: Delivery, m?: MatchState | null): ShotInput {
  const tr = trajectory(d)
  const w = timingWindows(d)
  const gauss = (Math.random() + Math.random() + Math.random() - 1.5) * 2.0
  const timing = gauss * w.good
  const leave = Math.abs(tr.xAtStumps) > 0.8 && Math.random() < 0.6
  const dir = tr.xAtContact > 0.3 ? 0.3 + Math.random() * 0.6 : tr.xAtContact < -0.15 ? -0.4 - Math.random() * 0.5 : (Math.random() - 0.5) * 1.2
  let loftChance = 0.35
  if (m) {
    const rr = requiredRate(currentInnings(m), m.settings.overs)
    if (rr) loftChance = rr.rate > 12 ? 0.7 : rr.rate > 9 ? 0.5 : rr.rate < 5 ? 0.15 : 0.3
    if (d.field === 'defensive') loftChance *= 0.7
  }
  return { swung: !leave, dir, loft: Math.random() < loftChance, timing }
}
