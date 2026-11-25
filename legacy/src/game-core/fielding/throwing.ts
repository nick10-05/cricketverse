import type { FielderEntry, ThrowResult, RunOutAttempt } from './types'

export interface ThrowParams {
  fielder: FielderEntry
  distanceToStumps: number
  pressure: number
  stamina: number
}

export function resolveThrow(params: ThrowParams): ThrowResult {
  const baseAccuracy = params.fielder.throwingSkill
  const distancePenalty = (params.distanceToStumps / 60) * 0.2
  const pressurePenalty = params.pressure * 0.15
  const staminaPenalty = (1 - params.stamina) * 0.1

  const accuracy = Math.max(0.05, baseAccuracy - distancePenalty - pressurePenalty - staminaPenalty)
  const hitStumps = Math.random() < accuracy * 0.6

  const throwSpeed = 25 + params.fielder.throwingSkill * 15 * (1 - params.distanceToStumps / 80 * 0.3)

  return { accuracy, speed: Math.round(throwSpeed), hitStumps }
}

export interface RunOutParams {
  fielder: FielderEntry
  distanceToStumps: number
  batterSpeed: number
  batterDistance: number
  pressure: number
  isDirectHit: boolean
  wicketKeeperSkill: number
}

export function resolveRunOut(params: RunOutParams): RunOutAttempt {
  const throwResult = resolveThrow({
    fielder: params.fielder,
    distanceToStumps: params.distanceToStumps,
    pressure: params.pressure,
    stamina: params.fielder.stamina,
  })

  const throwTime = params.distanceToStumps / throwResult.speed
  const batterTime = params.batterDistance / params.batterSpeed

  const timeDiff = throwTime - batterTime
  const baseOutChance = params.isDirectHit ? throwResult.accuracy * 0.8 : throwResult.accuracy * params.wicketKeeperSkill * 0.5

  const timeBonus = Math.max(0, Math.min(0.3, -timeDiff * 0.5))
  const outChance = Math.min(0.95, baseOutChance + timeBonus)

  const out = Math.random() < outChance

  return { throwResult, batterRunning: params.batterSpeed, out }
}

export function getRunOutCommentary(attempt: RunOutAttempt, fielderName: string): string {
  if (attempt.out) {
    if (attempt.throwResult.hitStumps) {
      return `Direct hit from ${fielderName} and the batter is short! RUN OUT!`
    }
    return `${fielderName} throws to the keeper who whips the bails off! RUN OUT!`
  }
  if (attempt.throwResult.hitStumps) {
    return `Direct hit from ${fielderName} but the batter is well home!`
  }
  return `${fielderName} misses the stumps! The batters steal through.`
}
