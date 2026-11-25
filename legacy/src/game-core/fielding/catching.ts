import type { FielderEntry, CatchAttempt } from './types'

export interface CatchParams {
  fielder: FielderEntry
  shotQuality: number
  shotPower: number
  isEdge: boolean
  isLofted: boolean
  timing: number
  ballSpeed: number
  distanceToFielder: number
}

export function calcCatchDifficulty(params: CatchParams): number {
  let difficulty = 0.5

  if (params.isEdge) difficulty += 0.15
  if (params.isLofted) difficulty += 0.1

  difficulty += (1 - params.timing) * 0.2
  difficulty += params.shotPower * 0.15
  difficulty += (params.ballSpeed / 45) * 0.1
  difficulty += (params.distanceToFielder / 50) * 0.15

  if (params.fielder.position === 'wicket' || params.fielder.position === 'slip') {
    difficulty += 0.1
  }

  return Math.min(1, Math.max(0, difficulty))
}

export function calcCatchSuccess(params: CatchParams): number {
  const difficulty = calcCatchDifficulty(params)
  const baseSkill = params.fielder.catchingSkill
  const reflexBonus = params.fielder.reflexes * 0.3
  const staminaPenalty = (1 - params.fielder.stamina) * 0.1

  let successChance = (baseSkill * 0.5 + reflexBonus - staminaPenalty) * (1 - difficulty * 0.6)
  successChance = Math.min(0.98, Math.max(0.05, successChance))

  return successChance
}

export function attemptCatch(params: CatchParams): CatchAttempt {
  const successChance = calcCatchSuccess(params)
  const isOut = Math.random() < successChance
  const difficulty = calcCatchDifficulty(params)

  return {
    fielder: params.fielder,
    difficulty,
    successChance,
    isOut,
  }
}

export function getCatchCommentary(attempt: CatchAttempt): string {
  if (attempt.isOut) {
    if (attempt.difficulty > 0.7) return `DROPPED? No! An absolute blinder from ${attempt.fielder.playerName}!`
    if (attempt.difficulty > 0.5) return `That's a sharp chance, and ${attempt.fielder.playerName} holds on!`
    return `Safe catch for ${attempt.fielder.playerName}.`
  }
  if (attempt.difficulty > 0.7) return `Incredible effort but ${attempt.fielder.playerName} couldn't hold on!`
  if (attempt.difficulty > 0.5) return `${attempt.fielder.playerName} puts it down! A tough chance goes begging.`
  return `${attempt.fielder.playerName} drops a sitter!`
}
