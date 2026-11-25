import type { Timestamp } from 'firebase/firestore'

export type TournamentFormat = 'league' | 'knockout' | 'league_knockout'
export type TournamentStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled'
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'abandoned'

export interface Tournament {
  id: string
  name: string
  roomCode: string
  format: TournamentFormat
  overs: number
  maxTeams: number
  status: TournamentStatus
  createdBy: string
  creatorName: string
  winnerTeamId: string | null
  currentRound: number
  teamCount: number
  knockoutQualifiers: number | null
  totalRounds: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CreateTournamentInput {
  name: string
  format: TournamentFormat
  overs: number
  maxTeams: number
  knockoutQualifiers?: number
}

export interface TeamColors {
  primary: string
  secondary: string
}

export interface Team {
  id: string
  name: string
  ownerId: string
  ownerName: string
  totalPoints: number
  nrr: number
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  matchesTied: number
  colors: TeamColors
  logoURL: string | null
  createdAt: Timestamp
}

export interface UpdateTeamInput {
  name?: string
  colors?: TeamColors
  logoURL?: string | null
}

export interface Match {
  id: string
  round: number
  teamAId: string
  teamBId: string
  teamAName: string
  teamBName: string
  teamAScore: { runs: number; wickets: number; overs: number } | null
  teamBScore: { runs: number; wickets: number; overs: number } | null
  winnerId: string | null
  status: MatchStatus
  isBracketMatch: boolean
  createdAt: Timestamp
}

export interface ScoreEntry {
  teamId: string
  teamName: string
  played: number
  won: number
  lost: number
  tied: number
  points: number
  nrr: number
}
