export interface GlobalStats {
  totalRuns: number
  totalWickets: number
  totalMatches: number
  totalTournaments: number
  totalPlayers: number
  totalFours: number
  totalSixes: number
  totalCenturies: number
  totalFiveWickets: number
}

export interface BattingRecord {
  playerId: string
  name: string
  matches: number
  runs: number
  ballsFaced: number
  average: number
  strikeRate: number
  fours: number
  sixes: number
  centuries: number
  fifties: number
  highestScore: number
}

export interface BowlingRecord {
  playerId: string
  name: string
  matches: number
  wickets: number
  runsConceded: number
  ballsBowled: number
  average: number
  economy: number
  strikeRate: number
  bestWickets: number
  bestRuns: number
  fiveWickets: number
}

export interface TeamStats {
  teamName: string
  tournamentName: string
  matchesPlayed: number
  won: number
  lost: number
  tied: number
  winPercent: number
  nrr: number
  runsScored: number
  runsConceded: number
}

export interface TournamentStats {
  tournamentId: string
  name: string
  format: string
  totalRuns: number
  totalWickets: number
  totalFours: number
  totalSixes: number
  highestScore: number
  bestBowling: string
  topScorer: string
  topWicketTaker: string
  totalMatches: number
  completedMatches: number
}

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export interface SeriesDataPoint {
  label: string
  values: number[]
}
