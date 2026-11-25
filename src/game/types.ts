export type TeamId = 'A' | 'B'

export interface Player {
  id: string
  name: string
  team: TeamId | null
  isBot?: boolean
  connected: boolean
}

/** 1v1 … 5v5 are fixed team sizes; 'team' lets everyone in the room split freely. */
export type GameMode = '1v1' | '2v2' | '3v3' | '4v4' | '5v5' | 'team'

export interface MatchSettings {
  mode: GameMode
  overs: number // 1..10
  wickets: number // 1..10
  teamNames: Record<TeamId, string>
}

export type DeliveryType = 'fast' | 'swing' | 'spin' | 'yorker' | 'bouncer' | 'slower'

export interface Delivery {
  type: DeliveryType
  /** Lateral aim at the bounce point, metres. Negative = leg side, positive = off side. */
  line: number
  /** 0 = very full (near batter), 1 = very short. */
  length: number
  /** Power-meter quality 0..1 (1 = perfect release). */
  power: number
  /** Swing / spin direction: -1 or 1. */
  turn: number
  seed: number
}

export interface ShotInput {
  swung: boolean
  /** -1 (leg side, hard left) … 1 (off side, hard right). 0 = straight. */
  dir: number
  loft: boolean
  /** Timing error in ms. Negative = early, positive = late. */
  timing: number
}

export type TimingGrade = 'perfect' | 'good' | 'early' | 'late' | 'miss' | 'none'

export interface PathPoint {
  t: number
  x: number
  y: number
  z: number
}

export type ShotType =
  | 'leave'
  | 'miss'
  | 'block'
  | 'straight drive'
  | 'cover drive'
  | 'on drive'
  | 'lofted drive'
  | 'flick'
  | 'slog'
  | 'pull'
  | 'hook'
  | 'cut'
  | 'upper cut'

export interface BallOutcome {
  runs: number
  extra: null | 'wide'
  wicket: null | 'bowled' | 'caught' | 'caught behind' | 'run out'
  grade: TimingGrade
  label: string
  boundary: null | 4 | 6
  /** Ball path after contact (world coords), empty if not hit. */
  path: PathPoint[]
  /** Fielder that collects / catches the ball, -1 for none. */
  fielder: number
  fielderPath: PathPoint[]
  edged: boolean
  shot: ShotType
  footwork: 'front' | 'back'
  /** Fielder had to dive. */
  dive: boolean
  /** Return throw to the stumps (world coords, same clock as `path`). */
  throwPath: PathPoint[]
}

export interface BatterStat {
  runs: number
  balls: number
  fours: number
  sixes: number
  out: string | null
}

export interface BowlerStat {
  balls: number
  runs: number
  wickets: number
}

export interface Innings {
  batting: TeamId
  runs: number
  wickets: number
  balls: number
  extras: number
  strikerIdx: number
  bowlerIdx: number
  thisOver: string[]
  batters: Record<string, BatterStat>
  bowlers: Record<string, BowlerStat>
  target: number | null
}

export interface MatchState {
  phase: 'playing' | 'break' | 'done'
  settings: MatchSettings
  teams: Record<TeamId, string[]>
  names: Record<string, string>
  tossWinner: TeamId
  innings: Innings[]
  current: number
  ballId: number
  /** Who acts next. */
  turn: { bowler: string; striker: string; stage: 'bowl' | 'bat' } | null
  result: { winner: TeamId | null; text: string } | null
  lastOutcome: BallOutcome | null
  startedAt: number
}

export interface LobbyState {
  code: string
  hostId: string
  players: Player[]
  settings: MatchSettings
  inMatch: boolean
}
