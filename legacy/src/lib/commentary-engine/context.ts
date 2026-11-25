import type { BallOutcome } from '@/lib/match-engine'
import type {
  CommentaryContext,
  ExcitementLevel,
  BatterForm,
  BowlerForm,
  MatchSituation,
} from './types'
import { EXCITEMENT_CONFIG } from './types'

/* ─── Batter Form ─────────────────────────────────── */

export function calcBatterForm(runs: number, balls: number, fours: number, sixes: number): BatterForm {
  return {
    runs,
    ballsFaced: balls,
    strikeRate: balls > 0 ? (runs / balls) * 100 : 0,
    fours,
    sixes,
    isSet: balls >= 20 && runs >= 20,
    isNew: balls < 5,
    isDangerous: balls >= 15 && runs >= 30,
  }
}

/* ─── Bowler Form ─────────────────────────────────── */

export function calcBowlerForm(w: number, runs: number, balls: number): BowlerForm {
  return {
    wickets: w,
    runsConceded: runs,
    legalBalls: balls,
    economy: balls > 0 ? (runs / balls) * 6 : 0,
    isOnFire: w >= 2 && balls >= 12,
    isExpensive: balls >= 12 && (runs / balls) * 6 > 10,
  }
}

/* ─── Match Situation ─────────────────────────────── */

export function calcMatchSituation(
  score: number,
  wickets: number,
  over: number,
  ball: number,
  target: number | null,
  maxOvers: number,
): MatchSituation {
  const totalBalls = over * 6 + ball
  const maxBalls = maxOvers * 6
  const ballsRemaining = Math.max(0, maxBalls - totalBalls)
  const oversRemaining = ballsRemaining / 6
  const currentRunRate = totalBalls > 0 ? (score / totalBalls) * 6 : 0
  const wicketsRemaining = 10 - wickets

  let requiredRate = 0
  let isChase = false
  if (target !== null) {
    isChase = true
    const runsNeeded = Math.max(0, target - score)
    requiredRate = oversRemaining > 0 ? runsNeeded / oversRemaining : 999
  }

  const overStage = over <= 6 ? 'powerplay' as const : over <= 15 ? 'middle' as const : 'death' as const

  let pressureIndex = 0
  if (isChase && target) {
    const runRateDiff = requiredRate - currentRunRate
    pressureIndex = Math.max(0, Math.min(1, runRateDiff / 8 + (10 - wicketsRemaining) / 20))
  } else if (!isChase) {
    pressureIndex = Math.min(1, (10 - wicketsRemaining) / 15 + Math.max(0, over - 10) / 20)
  }

  return { over, ball, overStage, totalScore: score, totalWickets: wickets, target, requiredRate, currentRunRate, pressureIndex, ballsRemaining, wicketsRemaining, isChase }
}

/* ─── Excitement Calculation ──────────────────────── */

export function calcExcitement(
  outcome: BallOutcome,
  situation: MatchSituation,
  batterForm: BatterForm,
  bowlerForm: BowlerForm,
): ExcitementLevel {
  let score = 1

  // Base by runs
  if (outcome.type === 'six') score += 2
  else if (outcome.type === 'four') score += 1
  else if (outcome.type === 'wicket') score += 2
  else if (outcome.type === 'double') score += 1

  // Pressure multiplier
  if (situation.pressureIndex > 0.5) score += 1
  if (situation.pressureIndex > 0.8) score += 1

  // Death overs
  if (situation.overStage === 'death') score += 1

  // Big moments
  if (outcome.type === 'wicket' && batterForm.isSet) score += 2
  if (outcome.type === 'wicket' && batterForm.isDangerous) score += 1
  if (outcome.type === 'six' && batterForm.isDangerous) score += 1
  if (outcome.type === 'four' && situation.overStage === 'death') score += 1

  // Chase context
  if (situation.isChase && situation.requiredRate < 6 && outcome.type === 'dot') score -= 1
  if (situation.isChase && situation.requiredRate > 12 && outcome.type === 'six') score += 2

  // Bowler on fire
  if (outcome.type === 'wicket' && bowlerForm.isOnFire) score += 1

  return Math.max(0, Math.min(5, score)) as ExcitementLevel
}

/* ─── Context Object ──────────────────────────────── */

export function buildCommentaryContext(
  excitement: ExcitementLevel,
): CommentaryContext {
  const cfg = EXCITEMENT_CONFIG[excitement]
  return {
    excitement,
    label: cfg.label,
    color: cfg.color,
    prefix: cfg.prefix,
  }
}
