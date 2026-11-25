import { randomSeed, trajectory, timingWindows } from './physics'
import type { Delivery, DeliveryType, ShotInput } from './types'

const TYPES: DeliveryType[] = ['fast', 'fast', 'swing', 'spin', 'yorker', 'bouncer', 'slower']

export function botDelivery(): Delivery {
  const type = TYPES[Math.floor(Math.random() * TYPES.length)]
  return {
    type,
    line: (Math.random() - 0.35) * 0.7,
    length: type === 'yorker' ? 0.03 : type === 'bouncer' ? 0.9 : 0.25 + Math.random() * 0.45,
    power: 0.55 + Math.random() * 0.4,
    turn: Math.random() < 0.5 ? -1 : 1,
    seed: randomSeed(),
  }
}

/** A bot batter: decent timing, sometimes greedy. */
export function botShot(d: Delivery): ShotInput {
  const tr = trajectory(d)
  const w = timingWindows(d)
  const gauss = (Math.random() + Math.random() + Math.random() - 1.5) * 1.4
  const timing = gauss * w.good
  const leave = Math.abs(tr.xAtStumps) > 0.8 && Math.random() < 0.6
  const dir = tr.xAtContact > 0.3 ? 0.3 + Math.random() * 0.6 : tr.xAtContact < -0.15 ? -0.4 - Math.random() * 0.5 : (Math.random() - 0.5) * 1.2
  return { swung: !leave, dir, loft: Math.random() < 0.35, timing }
}
