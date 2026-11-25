export type * from './types'
export {
  createBattingStats,
  createBowlingStats,
  initInningsState,
  getBattingStats,
  getBowlingStats,
  recordBattingEvent,
  recordBowlingEvent,
  getOversBowled,
  calcRunRate,
  finalizeBattingStats,
  finalizeBowlingStats,
  recordPartnership,
  finalizePartnership,
  computeMatchResult,
  getScoreSummary,
  isInningsComplete,
  getRequiredRunRate,
} from './score-manager'

export {
  resolveWicketType,
  recordWicket,
  getNextBatter,
  rotateStrike,
  swapStrikeIfNeeded,
} from './wicket-manager'

export {
  autoResolveBall,
  processBall,
} from './ball-manager'

export type { BallContext } from './ball-manager'

export {
  createOver,
  selectBowler,
  simulateOver,
} from './over-manager'

export type { OverResult } from './over-manager'

export {
  createInnings,
  simulateInnings,
} from './innings-manager'

export type { InningsSimResult } from './innings-manager'

export {
  createMatchState,
  doToss,
  startMatch,
  autoPlayMatch,
  switchInnings,
  setInningsResult,
  finalizeMatch,
  getMatchSummary,
} from './match-manager'

export * from './batting'
export * from './bowling'
export * from './physics'
export * from './fielding'
export * from './networking'
