import type { InningsState, FallOfWicket, WicketType, GamePlayer, PlayerSkills, PitchCondition, WeatherState } from './types'
import { getOversBowled, recordPartnership, getBattingStats } from './score-manager'

export type WicketMethod = 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket'

export interface WicketResolution {
  wicketType: WicketType
  caughtBy?: string
  runOutBy?: string
  stumpedBy?: string
}

export function resolveWicketType(
  batterSkills: PlayerSkills,
  bowlerSkills: PlayerSkills,
  pitch: PitchCondition,
  _weather: WeatherState | null,
  bowlingIsPace: boolean,
): WicketResolution {
  const bTech = batterSkills.technique / 100
  const bTiming = batterSkills.timing / 100

  const probs: { type: WicketType; weight: number }[] = bowlingIsPace
    ? [
        { type: 'bowled', weight: 25 + (1 - bTech) * 20 },
        { type: 'caught', weight: 30 + (1 - bTiming) * 20 + (bowlerSkills.swing / 100) * 15 },
        { type: 'lbw', weight: 20 + (1 - bTech) * 10 + pitch.paceSupport * 10 },
        { type: 'run_out', weight: 8 },
        { type: 'stumped', weight: 2 },
        { type: 'hit_wicket', weight: 5 + (1 - bTiming) * 10 },
      ]
    : [
        { type: 'bowled', weight: 20 + (1 - bTech) * 15 + pitch.spinSupport * 15 },
        { type: 'caught', weight: 20 + (1 - bTiming) * 15 },
        { type: 'lbw', weight: 25 + (1 - bTech) * 15 + pitch.spinSupport * 15 },
        { type: 'run_out', weight: 8 },
        { type: 'stumped', weight: 15 + (bowlerSkills.accuracy / 100) * 10 },
        { type: 'hit_wicket', weight: 5 },
      ]

  const totalWeight = probs.reduce((a, b) => a + b.weight, 0)
  let roll = Math.random() * totalWeight
  let chosen = probs[0].type
  for (const p of probs) {
    roll -= p.weight
    if (roll <= 0) {
      chosen = p.type
      break
    }
  }

  return { wicketType: chosen }
}

export function recordWicket(
  state: InningsState,
  _overNumber: number,
  _ballsInOver: number,
  wicketType: WicketType,
  strikerId: string,
  strikerName: string,
  bowlerId: string,
  bowlerName: string,
): FallOfWicket {
  state.wickets++

  const battingStats = getBattingStats(state, strikerId)
  battingStats.isOut = true
  battingStats.dismissal = wicketType

  const over = getOversBowled(state.legalBalls)
  const fow: FallOfWicket = {
    wicketNumber: state.wickets,
    score: state.total,
    over: over,
    batterId: strikerId,
    batterName: strikerName,
    bowlerId,
    bowlerName,
    wicketType,
    partnershipRuns: state.currentPartnershipRuns,
    partnershipBalls: state.currentPartnershipBalls,
  }
  state.fallOfWickets.push(fow)

  recordPartnership(state, strikerId, strikerName)

  return fow
}

export function getNextBatter(state: InningsState, battingOrder: GamePlayer[]): string | null {
  if (state.nextBatterIndex >= battingOrder.length) return null
  return battingOrder[state.nextBatterIndex++].id
}

export function rotateStrike(state: InningsState): void {
  const temp = state.strikerId
  state.strikerId = state.nonStrikerId
  state.nonStrikerId = temp
}

export function swapStrikeIfNeeded(state: InningsState, runs: number): void {
  if (runs % 2 === 1) {
    rotateStrike(state)
  }
}
