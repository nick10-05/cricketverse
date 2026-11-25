import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'user' | 'moderator' | 'admin'

export interface UserProfile {
  uid: string
  displayName: string
  email: string | null
  photoURL: string | null
  role: UserRole
  banned: boolean
  banReason?: string
  createdAt: Timestamp
  lastLogin: Timestamp | null
}

export interface AdminStats {
  totalUsers: number
  bannedUsers: number
  totalTournaments: number
  activeTournaments: number
  totalMatches: number
  totalPlayers: number
  openReports: number
  totalTeams: number
}

export interface Report {
  id: string
  reporterId: string
  reporterName: string
  targetId: string
  targetType: 'user' | 'message' | 'tournament' | 'team'
  reason: string
  description: string
  status: 'open' | 'resolved' | 'dismissed'
  resolvedBy?: string
  resolvedAt?: Timestamp
  createdAt: Timestamp
}

export interface AdminLog {
  id: string
  adminId: string
  adminName: string
  action: string
  targetId: string
  details: string
  createdAt: Timestamp
}

export interface AnalyticsData {
  usersByDay: { date: string; count: number }[]
  tournamentsByDay: { date: string; count: number }[]
  matchesByDay: { date: string; count: number }[]
  topPlayers: { name: string; runs: number }[]
  topBowlers: { name: string; wickets: number }[]
  formatDistribution: { format: string; count: number }[]
}
