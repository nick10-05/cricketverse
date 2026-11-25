import type { InningsState, BattingStats, BowlingStats, Partnership, MatchResult } from './types'

export function createBattingStats(playerId: string, playerName: string): BattingStats {
  return { playerId, playerName, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, dotBalls: 0, isOut: false, dismissal: null }
}

export function createBowlingStats(playerId: string, playerName: string): BowlingStats {
  return { playerId, playerName, legalBalls: 0, runsConceded: 0, wickets: 0, wides: 0, noBalls: 0, dotBalls: 0 }
}

export function initInningsState(
  battingTeamId: string,
  battingTeamName: string,
  bowlingTeamId: string,
  bowlingTeamName: string,
  battingOrder: string[],
  bowlers: string[],
  maxOvers: number,
  target: number | null,
): InningsState {
  const battingStats: Record<string, BattingStats> = {}
  const bowlingStats: Record<string, BowlingStats> = {}

  return {
    battingTeamId,
    battingTeamName,
    bowlingTeamId,
    bowlingTeamName,
    total: 0,
    wickets: 0,
    legalBalls: 0,
    totalDeliveries: 0,
    battingStats,
    bowlingStats,
    strikerId: battingOrder[0],
    nonStrikerId: battingOrder[1],
    nextBatterIndex: 2,
    battingOrder,
    currentOver: null,
    completedOvers: [],
    fallOfWickets: [],
    partnerships: [],
    currentPartnershipRuns: 0,
    currentPartnershipBalls: 0,
    bowlerOversCount: Object.fromEntries(bowlers.map((id) => [id, 0])),
    target,
    completed: false,
    maxOvers,
  }
}

export function getBattingStats(state: InningsState, playerId: string): BattingStats {
  if (!state.battingStats[playerId]) {
    state.battingStats[playerId] = createBattingStats(playerId, '')
  }
  return state.battingStats[playerId]
}

export function getBowlingStats(state: InningsState, playerId: string): BowlingStats {
  if (!state.bowlingStats[playerId]) {
    state.bowlingStats[playerId] = createBowlingStats(playerId, '')
  }
  return state.bowlingStats[playerId]
}

export function recordBattingEvent(
  state: InningsState,
  playerId: string,
  runs: number,
  isFour: boolean,
  isSix: boolean,
  isDot: boolean,
): void {
  const stats = getBattingStats(state, playerId)
  if (runs > 0 || isDot) {
    stats.ballsFaced++
  }
  stats.runs += runs
  if (isFour) stats.fours++
  if (isSix) stats.sixes++
  if (isDot) stats.dotBalls++
}

export function recordBowlingEvent(
  state: InningsState,
  playerId: string,
  runs: number,
  isWicket: boolean,
  isWide: boolean,
  isNoBall: boolean,
  isDot: boolean,
): void {
  const stats = getBowlingStats(state, playerId)
  if (!isWide && !isNoBall) {
    stats.legalBalls++
  }
  stats.runsConceded += runs
  if (isWicket) stats.wickets++
  if (isWide) stats.wides++
  if (isNoBall) stats.noBalls++
  if (isDot) stats.dotBalls++
}

export function getOversBowled(legalBalls: number): number {
  return Math.floor(legalBalls / 6) + (legalBalls % 6) / 10
}

export function calcRunRate(total: number, legalBalls: number): number {
  const overs = getOversBowled(legalBalls)
  return overs > 0 ? Math.round((total / overs) * 100) / 100 : 0
}

export function getBowlingFigure(_overs: number, legalBalls: number, runs: number, wickets: number): string {
  const o = legalBalls > 0 ? getOversBowled(legalBalls) : 0
  return `${o}-${runs}-${wickets}`
}

export function finalizeBattingStats(state: InningsState): void {
  for (const stats of Object.values(state.battingStats)) {
    if (stats.ballsFaced > 0 || stats.isOut) {
      Object.assign(stats, stats)
    }
  }
}

export function finalizeBowlingStats(state: InningsState): void {
  for (const stats of Object.values(state.bowlingStats)) {
    if (stats.legalBalls > 0) {
      Object.assign(stats, stats)
    }
  }
}

export function recordPartnership(state: InningsState, dismissedId: string, _dismissedName: string): Partnership {
  const p: Partnership = {
    batter1Id: state.strikerId,
    batter1Name: '',
    batter2Id: state.nonStrikerId,
    batter2Name: '',
    runs: state.currentPartnershipRuns,
    balls: state.currentPartnershipBalls,
    dismissedId,
  }
  state.partnerships.push(p)
  state.currentPartnershipRuns = 0
  state.currentPartnershipBalls = 0
  return p
}

export function finalizePartnership(state: InningsState): Partnership | null {
  if (state.wickets < 10 && state.currentPartnershipBalls > 0) {
    const p: Partnership = {
      batter1Id: state.strikerId,
      batter1Name: '',
      batter2Id: state.nonStrikerId,
      batter2Name: '',
      runs: state.currentPartnershipRuns,
      balls: state.currentPartnershipBalls,
      dismissedId: null,
    }
    state.partnerships.push(p)
    return p
  }
  return null
}

export function computeMatchResult(innings1: InningsState, innings2: InningsState, team1Id: string, team1Name: string, team2Id: string, team2Name: string): MatchResult {
  let winnerId: string | null = null
  let winnerName: string | null = null
  let winMargin = ''

  if (innings2.total > innings1.total) {
    winnerId = team2Id
    winnerName = team2Name
    const wicketsLeft = 10 - innings2.wickets
    winMargin = `${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`
  } else if (innings2.total < innings1.total) {
    winnerId = team1Id
    winnerName = team1Name
    const runsDiff = innings1.total - innings2.total
    winMargin = `${runsDiff} run${runsDiff !== 1 ? 's' : ''}`
  } else {
    winMargin = 'Match Tied'
  }

  const allBatting = [...Object.values(innings1.battingStats), ...Object.values(innings2.battingStats)]
  const mom = allBatting.sort((a, b) => b.runs - a.runs)[0]

  return {
    winnerId,
    winnerName,
    winMargin,
    team1Id,
    team1Name,
    team2Id,
    team2Name,
    innings: [innings1, innings2],
    manOfMatchId: mom?.playerId ?? '',
    manOfMatchName: mom?.playerName ?? '',
  }
}

export function getScoreSummary(state: InningsState): string {
  const overs = getOversBowled(state.legalBalls)
  return `${state.total}/${state.wickets} (${overs})`
}

export function isInningsComplete(state: InningsState): boolean {
  if (state.wickets >= 10) return true
  if (state.legalBalls >= state.maxOvers * 6) return true
  if (state.target !== null && state.total >= state.target) return true
  return false
}

export function getRequiredRunRate(state: InningsState): number {
  if (state.target === null) return 0
  const remaining = state.target - state.total
  const oversLeft = state.maxOvers - getOversBowled(state.legalBalls)
  if (oversLeft <= 0) return 999
  return Math.round((remaining / oversLeft) * 100) / 100
}
