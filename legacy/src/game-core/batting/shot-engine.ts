import type { BallOutcome } from '../types'
import { type ShotInput, type TimingResult, type BallApproach, type ShotType } from './types'
import type { GamePlayer, PitchCondition } from '../types'
import type { FieldingState } from '../fielding/types'
import { getFieldersNearShot } from '../fielding/types'
import { calcCatchSuccess } from '../fielding/catching'

const SHOT_EFFECTIVENESS: Record<ShotType, Record<string, number>> = {
  defensive: { yorker: 0.6, full: 0.7, good: 0.8, short: 0.5, bouncer: 0.3 },
  drive: { yorker: 0.3, full: 0.9, good: 0.7, short: 0.3, bouncer: 0.1 },
  cut: { yorker: 0.0, full: 0.2, good: 0.6, short: 0.8, bouncer: 0.6 },
  pull: { yorker: 0.0, full: 0.1, good: 0.5, short: 0.9, bouncer: 0.7 },
  sweep: { yorker: 0.3, full: 0.7, good: 0.6, short: 0.3, bouncer: 0.1 },
  lofted: { yorker: 0.2, full: 0.8, good: 0.6, short: 0.5, bouncer: 0.2 },
}

const SHOT_RISK: Record<ShotType, number> = {
  defensive: 0.05,
  drive: 0.15,
  cut: 0.2,
  pull: 0.25,
  sweep: 0.3,
  lofted: 0.35,
}

function calcShotQuality(
  shotInput: ShotInput,
  ball: BallApproach,
  batter: GamePlayer,
): number {
  const lengthEffect = SHOT_EFFECTIVENESS[shotInput.shotType]?.[ball.length] ?? 0.3
  const timingBonus = shotInput.timing * 0.6
  const powerBonus = shotInput.power * 0.2
  const skillBonus = (batter.skills.power / 100) * 0.1 + (batter.skills.timing / 100) * 0.1
  const techniqueBonus = (batter.skills.technique / 100) * 0.1
  const riskPenalty = SHOT_RISK[shotInput.shotType] * (1 - shotInput.timing) * 0.5

  return Math.max(0, Math.min(1,
    lengthEffect * 0.3 + timingBonus + powerBonus * 0.1 + skillBonus + techniqueBonus * 0.1 - riskPenalty,
  ))
}

function isEdge(shotQuality: number, timing: number, ball: BallApproach): boolean {
  const edgeChance = (1 - shotQuality) * 0.3 * (1 - timing * 0.5)
  const swingFactor = ball.type === 'pace' ? ball.swing * 0.5 : 0
  const spinFactor = ball.type === 'spin' ? ball.spin * 0.3 : 0
  return Math.random() < edgeChance + swingFactor * (1 - timing) + spinFactor * (1 - timing)
}

export interface ShotEvaluation {
  quality: number
  isEdge: boolean
  timing: TimingResult
}

export function evaluateShot(
  shotInput: ShotInput,
  ball: BallApproach,
  batter: GamePlayer,
): ShotEvaluation {
  const quality = calcShotQuality(shotInput, ball, batter)
  const edge = isEdge(quality, shotInput.timing, ball)

  return { quality, isEdge: edge, timing: shotInput.timing as unknown as TimingResult }
}

export function resolveShot(
  shotInput: ShotInput,
  ball: BallApproach,
  batter: GamePlayer,
  bowler: GamePlayer,
  pitch: PitchCondition,
  fielding: FieldingState | null = null,
): BallOutcome {
  const quality = calcShotQuality(shotInput, ball, batter)
  const edge = isEdge(quality, shotInput.timing, ball)
  const isMissed = shotInput.timing < 0.1

  if (isMissed) {
    const bowledChance = ball.length === 'yorker' ? 0.6 : ball.length === 'full' ? 0.3 : 0.1
    if (Math.random() < bowledChance) {
      return { type: 'wicket', runs: 0, isWicket: true, wicketType: 'bowled', isExtra: false, extraType: null, isLegal: true }
    }
    const lbwChance = ball.line === 'middle_stump' ? 0.4 : 0.1
    if (Math.random() < lbwChance) {
      return { type: 'wicket', runs: 0, isWicket: true, wicketType: 'lbw', isExtra: false, extraType: null, isLegal: true }
    }
    return { type: 'dot', runs: 0, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
  }

  if (edge) {
    return resolveEdgeCatch(quality, shotInput, ball, fielding)
  }

  return resolveRuns(quality, shotInput, ball, bowler, pitch, fielding)
}

function resolveEdgeCatch(
  quality: number,
  shotInput: ShotInput,
  ball: BallApproach,
  fielding: FieldingState | null,
): BallOutcome {
  if (fielding) {
    const { primary } = getFieldersNearShot(fielding, shotInput.direction)
    if (primary) {
      const catchChance = calcCatchSuccess({
        fielder: primary,
        shotQuality: quality,
        shotPower: shotInput.power,
        isEdge: true,
        isLofted: shotInput.shotType === 'lofted',
        timing: shotInput.timing,
        ballSpeed: ball.speed * 45,
        distanceToFielder: 15,
      })
      if (Math.random() < catchChance) {
        return { type: 'wicket', runs: 0, isWicket: true, wicketType: 'caught', isExtra: false, extraType: null, isLegal: true }
      }
    }
  } else {
    if (Math.random() < (ball.type === 'pace' ? 0.7 : 0.5)) {
      return { type: 'wicket', runs: 0, isWicket: true, wicketType: 'caught', isExtra: false, extraType: null, isLegal: true }
    }
  }
  const runs = Math.random() < 0.3 ? 1 : 0
  return { type: runs === 0 ? 'dot' : 'single', runs, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
}

function resolveRuns(
  quality: number,
  shotInput: ShotInput,
  ball: BallApproach,
  bowler: GamePlayer,
  pitch: PitchCondition,
  fielding: FieldingState | null = null,
): BallOutcome {
  const isFourZone = quality > 0.75
  const isSixZone = quality > 0.9 && shotInput.power > 0.6

  if (isSixZone && Math.random() < 0.6) {
    if (fielding) {
      const { primary } = getFieldersNearShot(fielding, shotInput.direction)
      if (primary && primary.position !== 'wicket') {
        const boundarySaveChance = primary.speed * 0.15 + primary.reflexes * 0.15
        if (Math.random() < boundarySaveChance * 0.25) {
          return { type: 'four', runs: 4, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
        }
      }
    }
    return { type: 'six', runs: 6, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
  }
  if (isFourZone && Math.random() < 0.65) {
    if (fielding) {
      const { primary } = getFieldersNearShot(fielding, shotInput.direction)
      if (primary) {
        const saveChance = primary.speed * 0.2 + primary.reflexes * 0.15
        if (Math.random() < saveChance * 0.15) {
          return { type: 'triple', runs: 3, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
        }
      }
    }
    return { type: 'four', runs: 4, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
  }

  const runProbs = calcRunProbabilities(quality, shotInput, ball, bowler, pitch, fielding)
  const totalProb = runProbs.reduce((a, b) => a + b, 0)
  let roll = Math.random() * totalProb
  const outcomes = [0, 1, 2, 3, 4, 6]
  for (let i = 0; i < runProbs.length; i++) {
    roll -= runProbs[i]
    if (roll <= 0) {
      const runs = outcomes[i]
      if (runs === 0) {
        return { type: 'dot', runs: 0, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
      }
      return { type: runs === 4 ? 'four' : runs === 6 ? 'six' : runs === 1 ? 'single' : runs === 2 ? 'double' : 'triple', runs, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
    }
  }

  return { type: 'dot', runs: 0, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
}

function calcRunProbabilities(
  quality: number,
  shotInput: ShotInput,
  _ball: BallApproach,
  bowler: GamePlayer,
  pitch: PitchCondition,
  fielding: FieldingState | null = null,
): number[] {
  const baseDot = 40 - quality * 30
  const baseSingle = 30 + quality * 10
  const baseDouble = 10 + quality * 15
  const baseTriple = 2 + quality * 5
  const baseFour = 5 + quality * 30
  const baseSix = 1 + quality * 15

  const fieldingPenalty = (bowler.skills.catching / 100) * 0.3
  const pitchBonus = pitch.batting * 0.2
  const isLofted = shotInput.shotType === 'lofted'

  let fieldingModifier = 1
  if (fielding) {
    const avgSkill = fielding.fielders.reduce((a, f) => a + f.reflexes * 0.5 + f.speed * 0.3 + f.catchingSkill * 0.2, 0) / fielding.fielders.length
    fieldingModifier = 1 - avgSkill * 0.15
  }

  return [
    Math.max(5, baseDot + baseDot * (1 - quality) * 0.5 * fieldingModifier),
    Math.max(5, baseSingle + baseSingle * fieldingPenalty * 0.2 + baseSingle * (1 - fieldingModifier) * 0.1),
    Math.max(2, baseDouble - baseDouble * fieldingPenalty * 0.3 + baseDouble * (1 - fieldingModifier) * 0.15),
    Math.max(1, baseTriple - baseTriple * fieldingPenalty * 0.5 + baseTriple * (1 - fieldingModifier) * 0.2),
    Math.max(2, (baseFour + baseFour * (quality - 0.5) * 0.5 + baseFour * pitchBonus) * fieldingModifier),
    Math.max(1, (isLofted ? baseSix * 1.5 : baseSix) + baseSix * (quality - 0.7) * 0.3 + baseSix * pitchBonus),
  ]
}
