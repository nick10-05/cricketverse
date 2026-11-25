import type { Timestamp } from 'firebase/firestore'

export interface PlayerProgression {
  playerId: string
  xp: number
  level: number
  totalMatches: number
  totalRuns: number
  totalWickets: number
  totalCatches: number
  totalSixes: number
  totalFours: number
  manOfMatchCount: number
  centuries: number
  fiveWicketHauls: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PlayerMatchRecord {
  id: string
  playerId: string
  matchId: string
  tournamentId: string
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  strikeRate: number
  wickets: number
  oversBowled: number
  runsConceded: number
  economy: number
  catches: number
  stumpings: number
  runOuts: number
  isManOfMatch: boolean
  isWinner: boolean
  xpEarned: number
  createdAt: Timestamp
}

export interface Badge {
  id: string
  playerId: string
  type: BadgeType
  category: BadgeCategory
  name: string
  description: string
  icon: string
  earnedAt: Timestamp
}

export type BadgeCategory = 'level' | 'performance' | 'milestone' | 'special'
export type BadgeType =
  | 'level_10' | 'level_25' | 'level_50' | 'level_75' | 'level_100'
  | 'centurion' | 'five_for' | 'all_rounder_show'
  | 'runs_1000' | 'runs_5000' | 'runs_10000'
  | 'wickets_50' | 'wickets_100' | 'wickets_200'
  | 'mom_10' | 'tournament_winner' | 'hat_trick'

export const BADGE_DEFINITIONS: Record<BadgeType, { name: string; description: string; icon: string; category: BadgeCategory }> = {
  level_10:            { name: 'Rising Star',       description: 'Reached Level 10',           icon: '⭐', category: 'level' },
  level_25:            { name: 'Seasoned Pro',      description: 'Reached Level 25',           icon: '🌟', category: 'level' },
  level_50:            { name: 'Veteran',           description: 'Reached Level 50',           icon: '💎', category: 'level' },
  level_75:            { name: 'Legend',            description: 'Reached Level 75',           icon: '👑', category: 'level' },
  level_100:           { name: 'Immortal',          description: 'Reached Level 100',          icon: '🏆', category: 'level' },
  centurion:           { name: 'Centurion',         description: 'Scored 100+ runs in a match', icon: '💯', category: 'performance' },
  five_for:            { name: 'Five-For',          description: 'Took 5+ wickets in a match',  icon: '🎯', category: 'performance' },
  all_rounder_show:    { name: 'All-Rounder Show',  description: '50+ runs & 3+ wickets',       icon: '🔥', category: 'performance' },
  runs_1000:           { name: 'Run Machine',       description: 'Scored 1000 total runs',     icon: '📈', category: 'milestone' },
  runs_5000:           { name: 'Run Factory',       description: 'Scored 5000 total runs',     icon: '📊', category: 'milestone' },
  runs_10000:          { name: 'Cricket Legend',    description: 'Scored 10000 total runs',    icon: '🏅', category: 'milestone' },
  wickets_50:          { name: 'Wicket Taker',      description: 'Took 50 wickets',            icon: '🖐️', category: 'milestone' },
  wickets_100:         { name: 'Bowling Maestro',   description: 'Took 100 wickets',           icon: '🎳', category: 'milestone' },
  wickets_200:         { name: 'Bowling Supreme',   description: 'Took 200 wickets',           icon: '🏏', category: 'milestone' },
  mom_10:              { name: 'Match Winner',      description: 'Won 10 Man of the Match awards', icon: '🥇', category: 'special' },
  tournament_winner:   { name: 'Champion',          description: 'Won a tournament',           icon: '🏆', category: 'special' },
  hat_trick:           { name: 'Hat Trick Hero',    description: 'Took 3 wickets in 3 balls',  icon: '🎩', category: 'special' },
}

export interface LevelInfo {
  level: number
  currentXp: number
  xpForNext: number
  totalXp: number
  progress: number
}
