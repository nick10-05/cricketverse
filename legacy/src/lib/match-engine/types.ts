export type BallOutcomeType =
  | 'dot'
  | 'single'
  | 'double'
  | 'triple'
  | 'four'
  | 'six'
  | 'wicket'
  | 'wide'
  | 'no_ball'

export type WicketType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'

export type ExtraType = 'wide' | 'no_ball'

export interface BallOutcome {
  type: BallOutcomeType
  runs: number
  isWicket: boolean
  wicketType: WicketType | null
  isExtra: boolean
  extraType: ExtraType | null
  isLegal: boolean
}

export interface BallEvent {
  over: number
  ballInOver: number
  batterName: string
  batterId: string
  bowlerName: string
  bowlerId: string
  outcome: BallOutcome
  commentary: string
  totalScore: number
  totalWickets: number
  partnershipRuns: number
  partnershipBalls: number
  runsThisOver: number
  ballsInOver: number
}

export interface FallOfWicket {
  wicketNumber: number
  score: number
  over: number
  batterName: string
  batterId: string
  bowlerName: string
  bowlerId: string
  wicketType: WicketType
  partnershipRuns: number
  partnershipBalls: number
}

export interface Partnership {
  batter1Id: string
  batter1Name: string
  batter2Id: string
  batter2Name: string
  runs: number
  balls: number
  dismissed: string | null
}

export interface PlayerBattingStats {
  playerId: string
  playerName: string
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  dotBalls: number
  strikeRate: number
  isOut: boolean
  dismissal: string | null
}

export interface PlayerBowlingStats {
  playerId: string
  playerName: string
  overs: number
  legalBalls: number
  runsConceded: number
  wickets: number
  economy: number
  wides: number
  noBalls: number
  dotBalls: number
}

export interface InningsResult {
  teamName: string
  total: number
  wickets: number
  overs: number
  legalBalls: number
  runRate: number
  ballEvents: BallEvent[]
  fallOfWickets: FallOfWicket[]
  partnerships: Partnership[]
  battingStats: PlayerBattingStats[]
  bowlingStats: PlayerBowlingStats[]
}

export interface MatchResult {
  team1Name: string
  team2Name: string
  innings1: InningsResult
  innings2: InningsResult
  winner: string | null
  winMargin: string
  manOfMatchId: string
  manOfMatchName: string
}

export type PlayerRole = 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper'

export interface PlayerSkills {
  power: number
  timing: number
  technique: number
  pace: number
  swing: number
  spin: number
  accuracy: number
  catching: number
  stamina: number
}

export interface MatchPlayer {
  id: string
  name: string
  role: PlayerRole
  skills: PlayerSkills
}

export interface PitchCondition {
  batting: number
  bowling: number
  paceSupport: number
  spinSupport: number
  label: string
}

export interface TeamLineup {
  name: string
  players: MatchPlayer[]
  battingOrder: string[]
}

export const PITCH_TYPES: Record<string, PitchCondition> = {
  flat: { batting: 0.8, bowling: 0.2, paceSupport: 0.3, spinSupport: 0.3, label: 'Flat Track' },
  normal: { batting: 0.5, bowling: 0.5, paceSupport: 0.5, spinSupport: 0.5, label: 'Normal' },
  green: { batting: 0.3, bowling: 0.7, paceSupport: 0.8, spinSupport: 0.3, label: 'Green Top' },
  dusty: { batting: 0.3, bowling: 0.7, paceSupport: 0.3, spinSupport: 0.8, label: 'Dusty' },
  crumbling: { batting: 0.2, bowling: 0.8, paceSupport: 0.4, spinSupport: 0.8, label: 'Crumbling' },
  road: { batting: 0.9, bowling: 0.1, paceSupport: 0.2, spinSupport: 0.2, label: 'Road' },
}

export function getDefaultSkills(role: PlayerRole): PlayerSkills {
  const base = { power: 50, timing: 50, technique: 50, pace: 50, swing: 50, spin: 50, accuracy: 50, catching: 50, stamina: 50 }

  switch (role) {
    case 'batsman':
      return { ...base, power: 75, timing: 80, technique: 80, stamina: 75, pace: 25, swing: 20, spin: 20, accuracy: 20, catching: 55 }
    case 'bowler':
      return { ...base, power: 25, timing: 30, technique: 40, pace: 75, swing: 70, spin: 70, accuracy: 80, stamina: 75, catching: 55 }
    case 'all_rounder':
      return { ...base, power: 60, timing: 60, technique: 60, pace: 60, swing: 55, spin: 55, accuracy: 60, stamina: 80, catching: 60 }
    case 'wicket_keeper':
      return { ...base, power: 55, timing: 70, technique: 70, catching: 90, stamina: 75, pace: 20, swing: 15, spin: 15, accuracy: 15 }
  }
}
