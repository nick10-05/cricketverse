export type ExcitementLevel = 0 | 1 | 2 | 3 | 4 | 5

export type OverStage = 'powerplay' | 'middle' | 'death'

export interface CommentaryContext {
  excitement: ExcitementLevel
  label: string
  color: string
  prefix: string
}

export interface BatterForm {
  runs: number
  ballsFaced: number
  strikeRate: number
  fours: number
  sixes: number
  isSet: boolean
  isNew: boolean
  isDangerous: boolean
}

export interface BowlerForm {
  wickets: number
  runsConceded: number
  legalBalls: number
  economy: number
  isOnFire: boolean
  isExpensive: boolean
}

export interface MatchSituation {
  over: number
  ball: number
  overStage: OverStage
  totalScore: number
  totalWickets: number
  target: number | null
  requiredRate: number
  currentRunRate: number
  pressureIndex: number
  ballsRemaining: number
  wicketsRemaining: number
  isChase: boolean
}

export interface CommentaryLine {
  id: string
  type: 'ball' | 'milestone' | 'summary' | 'analysis' | 'strategic'
  text: string
  excitement: ExcitementLevel
  timestamp: number
}

export interface OverSummary {
  overNumber: number
  runs: number
  wickets: number
  boundaries: number
  sixes: number
  dots: number
  text: string
}

export const EXCITEMENT_CONFIG: Record<ExcitementLevel, { label: string; color: string; prefix: string }> = {
  0: { label: '', color: 'text-gray-500', prefix: '' },
  1: { label: 'Casual', color: 'text-gray-400', prefix: '' },
  2: { label: 'Interesting', color: 'text-blue-400', prefix: '👀 ' },
  3: { label: 'Exciting!', color: 'text-yellow-400', prefix: '⚡ ' },
  4: { label: 'THRILLING!', color: 'text-orange-400', prefix: '🔥 ' },
  5: { label: 'UNBELIEVABLE!', color: 'text-red-400', prefix: '💥 ' },
}
