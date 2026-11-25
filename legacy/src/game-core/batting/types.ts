export type SwipeDirection =
  | 'none'
  | 'up'
  | 'up_right'
  | 'right'
  | 'down_right'
  | 'down'
  | 'down_left'
  | 'left'
  | 'up_left'

export type ShotType =
  | 'defensive'
  | 'drive'
  | 'cut'
  | 'pull'
  | 'sweep'
  | 'lofted'

export type ShotDirection =
  | 'straight'
  | 'cover'
  | 'point'
  | 'mid_wicket'
  | 'square_leg'
  | 'fine_leg'
  | 'third_man'
  | 'long_off'
  | 'long_on'

export type BallLength = 'yorker' | 'full' | 'good' | 'short' | 'bouncer'
export type BallLine = 'off_stump' | 'middle_stump' | 'leg_stump' | 'outside_off' | 'down_leg'
export type BowlingType = 'pace' | 'spin'

export interface BallApproach {
  type: BowlingType
  length: BallLength
  line: BallLine
  speed: number
  swing: number
  spin: number
  bounce: number
}

export interface BattingGesture {
  type: 'tap' | 'swipe'
  startX: number
  startY: number
  endX: number
  endY: number
  startTime: number
  endTime: number
  speed: number
  direction: SwipeDirection
  distance: number
}

export interface ShotInput {
  shotType: ShotType
  direction: ShotDirection
  power: number
  timing: number
  angle: number
}

export interface TimingResult {
  quality: 'early' | 'perfect' | 'late' | 'missed'
  score: number
  feedback: string
}

export interface ShotResult {
  timing: TimingResult
  shotInput: ShotInput
  outcome: import('../types').BallOutcome
}

export const SWIPE_THRESHOLD_PX = 30
export const SWIPE_MAX_TIME_MS = 800
export const TIMING_WINDOW_MS = 300
export const PERFECT_WINDOW_MS = 100

export const SHOT_MAP: Record<SwipeDirection, { shot: ShotType; direction: ShotDirection }> = {
  none: { shot: 'defensive', direction: 'straight' },
  up: { shot: 'drive', direction: 'long_off' },
  up_right: { shot: 'drive', direction: 'cover' },
  right: { shot: 'cut', direction: 'point' },
  down_right: { shot: 'pull', direction: 'mid_wicket' },
  down: { shot: 'sweep', direction: 'square_leg' },
  down_left: { shot: 'sweep', direction: 'fine_leg' },
  left: { shot: 'lofted', direction: 'long_on' },
  up_left: { shot: 'lofted', direction: 'long_off' },
}

export const SHOT_DIRECTION_DESCRIPTION: Record<string, string> = {
  straight: 'Straight down the ground',
  cover: 'Through cover point',
  point: 'Square of the wicket on off side',
  mid_wicket: 'Through mid-wicket',
  square_leg: 'Square of the wicket on leg side',
  fine_leg: 'Fine leg / glance',
  third_man: 'Behind square on off side',
  long_off: 'Over the top - long off',
  long_on: 'Over the top - long on',
}
