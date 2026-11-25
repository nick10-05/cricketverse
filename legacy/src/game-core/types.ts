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

export interface GamePlayer {
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

export interface WeatherState {
  battingMod: number
  bowlingMod: number
  swingMod: number
  spinMod: number
  atmosphere: string
  description: string
}

export type BallOutcomeType = 'dot' | 'single' | 'double' | 'triple' | 'four' | 'six' | 'wicket'

export type WicketType = 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket'

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
  batterId: string
  batterName: string
  bowlerId: string
  bowlerName: string
  outcome: BallOutcome
  totalScore: number
  totalWickets: number
  partnershipRuns: number
  partnershipBalls: number
  runsThisOver: number
  ballsInOver: number
}

export interface BattingStats {
  playerId: string
  playerName: string
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  dotBalls: number
  isOut: boolean
  dismissal: string | null
}

export interface BowlingStats {
  playerId: string
  playerName: string
  legalBalls: number
  runsConceded: number
  wickets: number
  wides: number
  noBalls: number
  dotBalls: number
}

export interface OverState {
  overNumber: number
  bowlerId: string
  bowlerName: string
  balls: BallEvent[]
  runsConceded: number
  wickets: number
  legalDeliveries: number
  completed: boolean
}

export interface FallOfWicket {
  wicketNumber: number
  score: number
  over: number
  batterId: string
  batterName: string
  bowlerId: string
  bowlerName: string
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
  dismissedId: string | null
}

export interface InningsState {
  battingTeamId: string
  battingTeamName: string
  bowlingTeamId: string
  bowlingTeamName: string
  total: number
  wickets: number
  legalBalls: number
  totalDeliveries: number
  battingStats: Record<string, BattingStats>
  bowlingStats: Record<string, BowlingStats>
  strikerId: string
  nonStrikerId: string
  nextBatterIndex: number
  battingOrder: string[]
  currentOver: OverState | null
  completedOvers: OverState[]
  fallOfWickets: FallOfWicket[]
  partnerships: Partnership[]
  currentPartnershipRuns: number
  currentPartnershipBalls: number
  bowlerOversCount: Record<string, number>
  target: number | null
  completed: boolean
  maxOvers: number
}

export interface TossResult {
  winnerId: string
  winnerName: string
  chose: 'bat' | 'bowl'
  battingTeamId: string
  bowlingTeamId: string
}

export interface MatchResult {
  winnerId: string | null
  winnerName: string | null
  winMargin: string
  team1Id: string
  team1Name: string
  team2Id: string
  team2Name: string
  innings: [InningsState, InningsState]
  manOfMatchId: string
  manOfMatchName: string
}

export interface TeamConfig {
  id: string
  name: string
  players: GamePlayer[]
  battingOrder: string[]
}

export type MatchStatus = 'toss' | 'innings1' | 'innings2' | 'completed'

export interface MatchState {
  id: string
  tournamentId: string
  status: MatchStatus
  maxOvers: number
  pitch: PitchCondition
  weather: WeatherState | null
  toss: TossResult | null
  teamA: TeamConfig
  teamB: TeamConfig
  currentInnings: 1 | 2 | null
  innings: [InningsState | null, InningsState | null]
  result: MatchResult | null
}

export interface BattingDecision {
  shotType: 'aggressive' | 'normal' | 'defensive' | 'leave'
  timing: number
  power: number
  direction: 'straight' | 'leg' | 'off' | 'cover' | 'third_man'
}

export interface BowlingDecision {
  ballType: 'pace' | 'spin'
  length: 'yorker' | 'full' | 'good' | 'short' | 'bouncer'
  line: 'off_stump' | 'middle_stump' | 'leg_stump' | 'outside_off' | 'down_leg'
  speed: number
  variation: number
}

export type BallDecision = BattingDecision | BowlingDecision

export interface BallResolution {
  outcome: BallOutcome
  commentary: string
}

export type InningsEvent =
  | { type: 'over_start'; overNumber: number; bowlerId: string; bowlerName: string }
  | { type: 'ball'; event: BallEvent }
  | { type: 'over_end'; over: OverState }
  | { type: 'wicket'; fall: FallOfWicket }
  | { type: 'partnership'; partnership: Partnership }
  | { type: 'innings_end'; state: InningsState }

export type MatchEvent =
  | { type: 'toss'; result: TossResult }
  | { type: 'innings_start'; innings: 1 | 2; state: InningsState }
  | { type: 'innings_event'; innings: 1 | 2; event: InningsEvent }
  | { type: 'innings_end'; innings: 1 | 2; state: InningsState }
  | { type: 'match_end'; result: MatchResult }
