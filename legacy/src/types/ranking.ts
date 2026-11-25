export type RankingCategory = 'batting' | 'bowling' | 'fielding' | 'overall'

export interface PlayerRankingEntry {
  playerId: string
  name: string
  role: string
  rating: number
  battingRating: number
  bowlingRating: number
  fieldingRating: number
  level: number
  totalXp: number
  totalMatches: number
  totalRuns: number
  totalWickets: number
  totalCatches: number
  manOfMatchCount: number
  centuries: number
  fiveWicketHauls: number
}

export interface TeamRankingEntry {
  teamId: string
  teamName: string
  tournamentId: string
  tournamentName: string
  rating: number
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  nrr: number
  winPercent: number
  tournamentWins: number
}

export interface TournamentRankingEntry {
  tournamentId: string
  name: string
  format: string
  rating: number
  teamCount: number
  totalMatches: number
  completedMatches: number
  avgTeamRating: number
  overs: number
}

export interface RankingsSnapshot {
  players: PlayerRankingEntry[]
  teams: TeamRankingEntry[]
  tournaments: TournamentRankingEntry[]
}
