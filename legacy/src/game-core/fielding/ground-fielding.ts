import type { FielderEntry, GroundFieldResult, BoundarySaveResult, FieldingZone } from './types'
import type { ShotDirection } from '../batting/types'

export interface GroundFieldParams {
  fielder: FielderEntry | null
  shotPower: number
  shotDirection: ShotDirection
  timing: number
  ballSpeed: number
  isBoundarySave: boolean
}

export function resolveGroundField(params: GroundFieldParams): GroundFieldResult {
  if (!params.fielder) {
    return { stopped: false, runsSaved: 0, fielder: null }
  }

  const baseSkill = params.fielder.reflexes * 0.4 + params.fielder.speed * 0.3 + params.fielder.stamina * 0.3
  const difficulty = (1 - params.timing) * 0.4 + (params.ballSpeed / 45) * 0.3
  const successChance = Math.min(0.95, baseSkill * (1 - difficulty * 0.5))

  const stopped = Math.random() < successChance

  let runsSaved = 0
  if (stopped) {
    runsSaved = Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 0
    runsSaved = Math.min(runsSaved, Math.ceil(params.ballSpeed / 15))
  }

  return { stopped, runsSaved, fielder: params.fielder }
}

export function resolveBoundarySave(params: GroundFieldParams): BoundarySaveResult {
  if (!params.fielder) {
    return { saved: false, runsConceded: 4, fielder: null }
  }

  const isDeepFielder = isBoundaryZone(params.fielder.position)

  if (!isDeepFielder) {
    const distancePenalty = 0.3
    const baseSkill = (params.fielder.speed * 0.5 + params.fielder.reflexes * 0.3) * (1 - distancePenalty)
    const saved = Math.random() < baseSkill * 0.15
    return {
      saved,
      runsConceded: saved ? (Math.random() < 0.5 ? 2 : 3) : (Math.random() < 0.7 ? 4 : 6),
      fielder: params.fielder,
    }
  }

  const interceptChance = params.fielder.speed * 0.5 + params.fielder.reflexes * 0.3
  const saved = Math.random() < interceptChance * 0.35

  if (saved) {
    return { saved: true, runsConceded: Math.random() < 0.5 ? 2 : 3, fielder: params.fielder }
  }

  const partialStop = Math.random() < params.fielder.stamina * 0.3
  const runsConceded = partialStop ? (Math.random() < 0.5 ? 3 : 4) : (Math.random() < 0.7 ? 4 : 6)
  return { saved: false, runsConceded, fielder: params.fielder }
}

export function calcRunsFromShot(
  shotPower: number,
  timing: number,
  isLofted: boolean,
): number {
  let base = 1 + shotPower * 3
  base *= 0.5 + timing * 0.5
  if (isLofted) base *= 1.2
  return Math.floor(base)
}

function isBoundaryZone(zone: FieldingZone): boolean {
  return ['long_off', 'long_on', 'deep_cover', 'deep_square_leg', 'third_man'].includes(zone)
}
