import { SeededRNG } from './rng'
import {
  type BallOutcome,
  type BallOutcomeType,
  type BallEvent,
  type WicketType,
  type FallOfWicket,
  type Partnership,
  type PlayerBattingStats,
  type PlayerBowlingStats,
  type InningsResult,
  type MatchResult,
  type MatchPlayer,
  type PlayerSkills,
  type PitchCondition,
  type TeamLineup,
} from './types'
import { generateCommentary } from './commentary'
import type { WeatherDefinition } from '@/lib/match-conditions'

const MAX_OVERS_PER_BOWLER = 4

type BattingStats = Record<string, PlayerBattingStats>
type BowlingStats = Record<string, PlayerBowlingStats>

/* ─── Probability Calculation ────────────────────────── */

function calcProbabilities(
  batter: MatchPlayer,
  bowler: MatchPlayer,
  battingFatigue: number,
  bowlingFatigue: number,
  pressure: number,
  pitch: PitchCondition,
  overs: number,
  ballInOver: number,
  bowlerOversBowled: number,
  weather?: WeatherDefinition,
): number[] {
  const bSkill = (s: keyof PlayerSkills) => (batter.skills[s] / 100) * battingFatigue
  const bwSkill = (s: keyof PlayerSkills) => (bowler.skills[s] / 100) * bowlingFatigue

  const power = bSkill('power')
  const timing = bSkill('timing')
  const technique = bSkill('technique')

  const accuracy = bwSkill('accuracy')
  const pace = bwSkill('pace')
  const swing = bwSkill('swing')
  const spin = bwSkill('spin')

  const isPacer = bowler.skills.pace > bowler.skills.spin
  const bowlingPrimary = isPacer ? pace : spin

  let dotW = 100
  let singleW = 80
  let doubleW = 22
  let tripleW = 5
  let fourW = 35
  let sixW = 10
  let wicketW = 14
  let wideW = 10
  let noBallW = 5

  // batter skill adjustments
  dotW *= 1 - timing * 0.12
  singleW *= 1 + timing * 0.10
  doubleW *= 1 + timing * 0.08
  fourW *= 1 + power * 0.20 + timing * 0.05
  sixW *= 1 + power * 0.35
  wicketW *= 1 - technique * 0.20

  // bowler skill adjustments
  dotW *= 1 + accuracy * 0.15 + bowlingPrimary * 0.10
  singleW *= 1 - accuracy * 0.08
  fourW *= 1 - (accuracy * 0.10 + bowlingPrimary * 0.08)
  sixW *= 1 - bowlingPrimary * 0.15
  wicketW *= 1 + (swing + spin) * 0.15 + accuracy * 0.08
  wideW *= 1 - accuracy * 0.60
  noBallW *= 1 - accuracy * 0.40

  // stamina effects
  const staminaDecay = (4 - battingFatigue) * 0.15
  wicketW *= 1 + staminaDecay
  dotW *= 1 + staminaDecay * 0.5
  fourW *= 1 - staminaDecay * 0.3
  sixW *= 1 - staminaDecay * 0.4

  const bowlStaminaDecay = (4 - bowlingFatigue) * 0.1
  wideW *= 1 + bowlStaminaDecay
  noBallW *= 1 + bowlStaminaDecay * 1.5
  fourW *= 1 + bowlStaminaDecay * 0.3

  // pressure effects
  dotW *= 1 - pressure * 0.15
  fourW *= 1 + pressure * 0.15
  sixW *= 1 + pressure * 0.20
  wicketW *= 1 + pressure * 0.25
  singleW *= 1 - pressure * 0.10

  // pitch effects
  dotW *= 1 - pitch.batting * 0.10 + pitch.bowling * 0.10
  fourW *= 1 + pitch.batting * 0.15
  sixW *= 1 + pitch.batting * 0.10
  wicketW *= 1 + pitch.bowling * 0.15 - pitch.batting * 0.10

  if (isPacer) {
    wicketW *= 1 + pitch.paceSupport * 0.15
    fourW *= 1 - pitch.paceSupport * 0.05
  } else {
    wicketW *= 1 + pitch.spinSupport * 0.20
    fourW *= 1 - pitch.spinSupport * 0.05
  }

  // death overs bonus (overs 16-20)
  if (overs >= 16) {
    fourW *= 1.15
    sixW *= 1.20
    wicketW *= 1.10
  }

  // atmospheric weather effects
  if (weather) {
    if (weather.swingMod !== 1.0 && isPacer) {
      const swingBoost = (weather.swingMod - 1.0) * 0.3
      wicketW *= 1 + swingBoost
      fourW *= 1 - swingBoost * 0.5
      dotW *= 1 + swingBoost * 0.3
    }
    if (weather.spinMod !== 1.0 && !isPacer) {
      const spinBoost = (weather.spinMod - 1.0) * 0.3
      wicketW *= 1 + spinBoost
      fourW *= 1 - spinBoost * 0.5
      dotW *= 1 + spinBoost * 0.3
    }
    if (weather.battingMod < 1.0) {
      const battingPenalty = (1.0 - weather.battingMod) * 0.5
      dotW *= 1 + battingPenalty * 0.2
      fourW *= 1 - battingPenalty * 0.15
      sixW *= 1 - battingPenalty * 0.2
    }
  }

  // boundary pressure per ball in over
  if (ballInOver >= 4) {
    dotW *= 1.05
  }

  // bowler fatigue per over bowled
  const overFatigue = bowlerOversBowled / MAX_OVERS_PER_BOWLER
  wideW *= 1 + overFatigue * 0.15
  fourW *= 1 + overFatigue * 0.10

  return [
    Math.max(dotW, 5),
    Math.max(singleW, 5),
    Math.max(doubleW, 2),
    Math.max(tripleW, 1),
    Math.max(fourW, 5),
    Math.max(sixW, 1),
    Math.max(wicketW, 2),
    Math.max(wideW, 1),
    Math.max(noBallW, 1),
  ]
}

/* ─── Outcome Resolution ─────────────────────────────── */

function resolveOutcome(
  index: number,
  rng: SeededRNG,
  batter: MatchPlayer,
  bowler: MatchPlayer,
  pitch: PitchCondition,
): BallOutcome {
  const outcomeTypes: BallOutcomeType[] = ['dot', 'single', 'double', 'triple', 'four', 'six', 'wicket', 'wide', 'no_ball']
  const type = outcomeTypes[index]

  if (type === 'wide') {
    return { type, runs: 1, isWicket: false, wicketType: null, isExtra: true, extraType: 'wide', isLegal: false }
  }

  if (type === 'no_ball') {
    const nbRuns = rng.pick([1, 2, 4])
    return { type, runs: nbRuns, isWicket: false, wicketType: null, isExtra: true, extraType: 'no_ball', isLegal: false }
  }

  if (type === 'wicket') {
    return resolveWicket(rng, batter, bowler, pitch)
  }

  const runMap: Record<string, number> = { dot: 0, single: 1, double: 2, triple: 3, four: 4, six: 6 }
  const runs = runMap[type] ?? 0

  return { type, runs, isWicket: false, wicketType: null, isExtra: false, extraType: null, isLegal: true }
}

function resolveWicket(
  rng: SeededRNG,
  batter: MatchPlayer,
  bowler: MatchPlayer,
  pitch: PitchCondition,
): BallOutcome {
  const isPacer = bowler.skills.pace > bowler.skills.spin
  const bTech = batter.skills.technique / 100
  const bTiming = batter.skills.timing / 100

  let probs: { type: WicketType; weight: number }[]

  if (isPacer) {
    probs = [
      { type: 'bowled', weight: 25 + (1 - bTech) * 20 },
      { type: 'caught', weight: 30 + (1 - bTiming) * 20 + (bowler.skills.swing / 100) * 15 },
      { type: 'lbw', weight: 20 + (1 - bTech) * 10 + (pitch.paceSupport) * 10 },
      { type: 'run_out', weight: 8 },
      { type: 'stumped', weight: 2 },
      { type: 'hit_wicket', weight: 5 + (1 - bTiming) * 10 },
    ]
  } else {
    probs = [
      { type: 'bowled', weight: 20 + (1 - bTech) * 15 + (pitch.spinSupport) * 15 },
      { type: 'caught', weight: 20 + (1 - bTiming) * 15 },
      { type: 'lbw', weight: 25 + (1 - bTech) * 15 + (pitch.spinSupport) * 15 },
      { type: 'run_out', weight: 8 },
      { type: 'stumped', weight: 15 + (bowler.skills.accuracy / 100) * 10 },
      { type: 'hit_wicket', weight: 5 },
    ]
  }

  const idx = rng.weightedIndex(probs.map((p) => p.weight))
  const wicketType = probs[idx].type

  return { type: 'wicket', runs: 0, isWicket: true, wicketType, isExtra: false, extraType: null, isLegal: true }
}

/* ─── Fatigue / Pressure ────────────────────────────── */

export function calcFatigue(stamina: number, ballsBowled: number, totalBalls: number): number {
  const base = stamina / 100
  const decay = (ballsBowled / Math.max(totalBalls, 1)) * (1 - base) * 0.5
  return Math.max(0.4, base - decay)
}

export function calcPressure(score: number, _wickets: number, overs: number, target: number | null): number {
  if (target === null) return 0

  const remainingRuns = target - score
  const remainingOvers = Math.max(0.1, 20 - overs)
  const requiredRate = remainingRuns / remainingOvers
  const scoringRate = score / Math.max(overs, 0.1)
  const baseRate = Math.max(scoringRate, 3)

  if (requiredRate <= 0) return 0

  const pressure = (requiredRate / baseRate - 1) * 0.5
  return Math.max(0, Math.min(1, pressure))
}

/* ─── Innings Simulation ────────────────────────────── */

export function simulateInnings(
  teamName: string,
  battingOrder: MatchPlayer[],
  bowlers: MatchPlayer[],
  maxOvers: number,
  pitch: PitchCondition,
  rng: SeededRNG,
  target: number | null,
  weather?: WeatherDefinition,
): InningsResult {
  const events: BallEvent[] = []
  const fallOfWickets: FallOfWicket[] = []
  const partnerships: Partnership[] = []

  const battingStats: BattingStats = {}
  const bowlingStats: BowlingStats = {}

  for (const p of battingOrder) {
    battingStats[p.id] = { playerId: p.id, playerName: p.name, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, dotBalls: 0, strikeRate: 0, isOut: false, dismissal: null }
  }

  const allBowlers = [...bowlers]
  for (const p of allBowlers) {
    bowlingStats[p.id] = { playerId: p.id, playerName: p.name, overs: 0, legalBalls: 0, runsConceded: 0, wickets: 0, economy: 0, wides: 0, noBalls: 0, dotBalls: 0 }
  }

  const totalBalls = maxOvers * 6

  let strikerIdx = 0
  let nonStrikerIdx = 1
  let nextBatterIdx = 2

  let totalScore = 0
  let totalWickets = 0
  let legalBalls = 0
  let ballsBowled = 0

  let currentPartnershipRuns = 0
  let currentPartnershipBalls = 0

  let bowlerOvers: Record<string, number> = {}
  for (const p of allBowlers) bowlerOvers[p.id] = 0

  let striker = battingOrder[strikerIdx]
  let nonStriker = battingOrder[nonStrikerIdx]

  for (let over = 1; over <= maxOvers && totalWickets < 10; over++) {
    // Select bowler
    const availableBowlers = allBowlers.filter((b) => {
      const bowled = bowlerOvers[b.id] ?? 0
      return bowled < MAX_OVERS_PER_BOWLER
    })
    if (availableBowlers.length === 0) break

    const bowler = rng.pick(availableBowlers)
    bowlerOvers[bowler.id] = (bowlerOvers[bowler.id] ?? 0) + 1

    let runsThisOver = 0
    let ballsInOver = 0

    for (let ballInOver = 0; ballInOver < 6; ballInOver++) {
      if (totalWickets >= 10) break
      if (target !== null && totalScore >= target) break

      ballsBowled++

      const battingFatigue = calcFatigue(striker.skills.stamina, battingStats[striker.id]?.ballsFaced ?? 0, totalBalls)
      const bowlingFatigue = calcFatigue(bowler.skills.stamina, bowlingStats[bowler.id].legalBalls, totalBalls)
      const pressure = calcPressure(totalScore, totalWickets, over - 1 + ballInOver / 6, target)

      const weights = calcProbabilities(
        striker, bowler, battingFatigue, bowlingFatigue,
        pressure, pitch, over, ballInOver + 1, bowlerOvers[bowler.id] - 1,
        weather,
      )

      const outcomeIdx = rng.weightedIndex(weights)
      const outcome = resolveOutcome(outcomeIdx, rng, striker, bowler, pitch)

      const isLegalDelivery = outcome.isLegal

      if (isLegalDelivery) {
        legalBalls++
        ballsInOver++
        battingStats[striker.id].ballsFaced++
        bowlingStats[bowler.id].legalBalls++

        if (outcome.type === 'dot') {
          battingStats[striker.id].dotBalls++
          bowlingStats[bowler.id].dotBalls++
        }

        if (outcome.type === 'four') {
          battingStats[striker.id].fours++
        }
        if (outcome.type === 'six') {
          battingStats[striker.id].sixes++
        }

        if (outcome.isWicket) {
          totalWickets++
          battingStats[striker.id].isOut = true
          battingStats[striker.id].dismissal = outcome.wicketType
          bowlingStats[bowler.id].wickets++

          fallOfWickets.push({
            wicketNumber: totalWickets,
            score: totalScore,
            over: over - 1 + ballsInOver / 6,
            batterName: striker.name,
            batterId: striker.id,
            bowlerName: bowler.name,
            bowlerId: bowler.id,
            wicketType: outcome.wicketType!,
            partnershipRuns: currentPartnershipRuns,
            partnershipBalls: currentPartnershipBalls,
          })

          partnerships.push({
            batter1Id: striker.id,
            batter1Name: striker.name,
            batter2Id: nonStriker.id,
            batter2Name: nonStriker.name,
            runs: currentPartnershipRuns,
            balls: currentPartnershipBalls,
            dismissed: striker.name,
          })

          currentPartnershipRuns = 0
          currentPartnershipBalls = 0

          if (nextBatterIdx < battingOrder.length) {
            striker = battingOrder[nextBatterIdx++]
          } else {
            striker = battingOrder[battingOrder.length - 1]
          }
        } else {
          totalScore += outcome.runs
          battingStats[striker.id].runs += outcome.runs
          bowlingStats[bowler.id].runsConceded += outcome.runs
          runsThisOver += outcome.runs
          currentPartnershipRuns += outcome.runs
          currentPartnershipBalls++

          if (outcome.runs % 2 === 1) {
            const temp = striker
            striker = nonStriker
            nonStriker = temp
          }
        }
      } else {
        // Extra delivery
        if (outcome.extraType === 'wide') {
          totalScore++
          bowlingStats[bowler.id].runsConceded++
          bowlingStats[bowler.id].wides++
          runsThisOver++
        } else if (outcome.extraType === 'no_ball') {
          totalScore += outcome.runs
          bowlingStats[bowler.id].runsConceded += outcome.runs
          bowlingStats[bowler.id].noBalls++
          runsThisOver += outcome.runs
          battingStats[striker.id].runs += outcome.runs
          battingStats[striker.id].ballsFaced++
          if (outcome.runs % 2 === 1) {
            const temp = striker
            striker = nonStriker
            nonStriker = temp
          }
        }

        ballsInOver++
        currentPartnershipRuns += outcome.runs
      }

      const comm = generateCommentary(outcome, striker, bowler, totalScore, totalWickets, over, ballInOver + 1, !outcome.isLegal)

      events.push({
        over,
        ballInOver: ballInOver + 1,
        batterName: striker.name,
        batterId: striker.id,
        bowlerName: bowler.name,
        bowlerId: bowler.id,
        outcome,
        commentary: comm,
        totalScore,
        totalWickets,
        partnershipRuns: currentPartnershipRuns,
        partnershipBalls: currentPartnershipBalls,
        runsThisOver,
        ballsInOver,
      })

      if (outcome.isWicket && totalWickets >= 10) break
      if (target !== null && totalScore >= target) break
    }

    // End of over: strike rotates
    if (totalWickets < 10) {
      const temp = striker
      striker = nonStriker
      nonStriker = temp
    }
  }

  // Add final partnership
  if (totalWickets < 10 && currentPartnershipBalls > 0) {
    partnerships.push({
      batter1Id: striker.id,
      batter1Name: striker.name,
      batter2Id: nonStriker.id,
      batter2Name: nonStriker.name,
      runs: currentPartnershipRuns,
      balls: currentPartnershipBalls,
      dismissed: null,
    })
  }

  return buildResult(teamName, events, fallOfWickets, partnerships, battingStats, bowlingStats, maxOvers, legalBalls)
}

function buildResult(
  teamName: string,
  events: BallEvent[],
  fallOfWickets: FallOfWicket[],
  partnerships: Partnership[],
  battingStats: BattingStats,
  bowlingStats: BowlingStats,
  _maxOvers: number,
  legalBalls: number,
): InningsResult {
  const last = events[events.length - 1]
  const total = last?.totalScore ?? 0
  const wickets = last?.totalWickets ?? 0
  const overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10

  for (const p of Object.values(battingStats)) {
    p.strikeRate = p.ballsFaced > 0 ? Math.round((p.runs / p.ballsFaced) * 100) : 0
  }
  for (const p of Object.values(bowlingStats)) {
    p.overs = Math.floor(p.legalBalls / 6) + (p.legalBalls % 6) / 10
    p.economy = p.overs > 0 ? Math.round((p.runsConceded / p.legalBalls) * 6 * 100) / 100 : 0
  }

  return {
    teamName,
    total,
    wickets,
    overs,
    legalBalls,
    runRate: overs > 0 ? Math.round((total / overs) * 100) / 100 : 0,
    ballEvents: events,
    fallOfWickets,
    partnerships,
    battingStats: Object.values(battingStats).filter((s) => s.ballsFaced > 0 || s.isOut),
    bowlingStats: Object.values(bowlingStats).filter((s) => s.legalBalls > 0),
  }
}

/* ─── Full Match Simulation ──────────────────────────── */

export function simulateMatch(
  team1: TeamLineup,
  team2: TeamLineup,
  maxOvers: number,
  pitch: PitchCondition,
  seed: number,
  weather?: WeatherDefinition,
): MatchResult {
  const rng = new SeededRNG(seed)

  const team1Bowlers = team1.players.filter((p) => ['bowler', 'all_rounder'].includes(p.role))
  const team2Bowlers = team2.players.filter((p) => ['bowler', 'all_rounder'].includes(p.role))

  const innings1 = simulateInnings(
    team1.name,
    team1.players,
    team2Bowlers,
    maxOvers,
    pitch,
    rng,
    null,
    weather,
  )

  const innings2 = simulateInnings(
    team2.name,
    team2.players,
    team1Bowlers,
    maxOvers,
    pitch,
    rng,
    innings1.total + 1,
    weather,
  )

  let winner: string | null = null
  let winMargin = ''
  let manOfMatchId = ''
  let manOfMatchName = ''

  if (innings2.total > innings1.total) {
    winner = team2.name
    const wicketsLeft = 10 - innings2.wickets
    winMargin = `${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`
  } else if (innings2.total < innings1.total) {
    winner = team1.name
    const runsDiff = innings1.total - innings2.total
    winMargin = `${runsDiff} run${runsDiff !== 1 ? 's' : ''}`
  } else {
    winMargin = 'Match Tied'
  }

  const allBattingStats = [...innings1.battingStats, ...innings2.battingStats]
  const mom = allBattingStats.sort((a, b) => b.runs - a.runs)[0]
  if (mom) {
    manOfMatchId = mom.playerId
    manOfMatchName = mom.playerName
  }

  return {
    team1Name: team1.name,
    team2Name: team2.name,
    innings1,
    innings2,
    winner,
    winMargin,
    manOfMatchId,
    manOfMatchName,
  }
}
