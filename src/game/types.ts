export type TeamId = 'A' | 'B'

export interface Player {
  id: string
  name: string
  team: TeamId | null
  isBot?: boolean
  connected: boolean
  /** Disconnected mid-match: a bot is playing for them until they return. */
  away?: boolean
  spectator?: boolean
}

/** '1v1' … '11v11' are fixed team sizes; 'team' lets everyone in the room split freely (up to 11 a side). */
export type GameMode = `${number}v${number}` | 'team'

export interface MatchSettings {
  mode: GameMode
  overs: number // 1..30
  /** Wickets per side. Clamped to the team size (1-player teams get "lives", up to 10). */
  wickets: number
  teamNames: Record<TeamId, string>
  /** Reject new joiners while a match is running (otherwise they watch as spectators). */
  locked?: boolean
}

export type DeliveryType = 'fast' | 'swing' | 'seam' | 'spin' | 'yorker' | 'bouncer' | 'slower'
export type FieldSetting = 'attacking' | 'balanced' | 'defensive'

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
  /** Field placement chosen by the bowler. */
  field?: FieldSetting
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

export type WicketType = 'bowled' | 'caught' | 'caught behind' | 'run out' | 'lbw' | 'stumped'

export interface BallOutcome {
  runs: number
  extra: null | 'wide' | 'noball' | 'bye' | 'legbye'
  wicket: null | WicketType
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
  /** Dismissals (for 1-player teams batting on "lives"). */
  outs?: number
}

export interface BowlerStat {
  balls: number
  runs: number
  wickets: number
  dots?: number
  extras?: number
}

export interface Innings {
  batting: TeamId
  runs: number
  wickets: number
  balls: number
  extras: number
  /** Indexes into the batting team's list. nonStriker is -1 when batting alone. */
  striker: number
  nonStriker: number
  nextBat: number
  bowlerIdx: number
  /** Index of the bowler of the previous over (no one bowls two in a row). */
  lastBowler: number
  freeHit: boolean
  fours: number
  sixes: number
  /** Runs at the end of each over, for the run-rate chart. */
  overRuns: number[]
  fallOfWickets: { runs: number; balls: number; batter: string }[]
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
  /** Wickets that end an innings, per batting team. */
  maxWickets: Record<TeamId, number>
}

export interface LobbyState {
  code: string
  hostId: string
  players: Player[]
  settings: MatchSettings
  inMatch: boolean
}

export interface MatchRecord {
  at: number
  teamNames: Record<TeamId, string>
  scores: string[]
  result: string
  overs: number
  mode: GameMode
  me?: { name: string; runs: number; balls: number; wickets: number; conceded: number; bowled: number; won: boolean | null }
}
