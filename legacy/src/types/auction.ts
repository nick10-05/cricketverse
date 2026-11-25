import type { Timestamp } from 'firebase/firestore'

export type AuctionStatus = 'inactive' | 'setup' | 'active' | 'paused' | 'completed'
export type AuctionPlayerStatus = 'pending' | 'active' | 'sold' | 'unsold'

export interface AuctionSettings {
  enabled: boolean
  baseBudget: number
  minIncrement: number
  bidTimerSeconds: number
}

export const DEFAULT_AUCTION_SETTINGS: AuctionSettings = {
  enabled: false,
  baseBudget: 1000,
  minIncrement: 10,
  bidTimerSeconds: 15,
}

export interface AuctionState {
  status: AuctionStatus
  currentPlayerId: string | null
  currentBid: number
  currentBidderId: string | null
  currentBidderTeamId: string | null
  currentBidderTeamName: string | null
  round: number
  startedAt: Timestamp | null
}

export interface AuctionPlayer {
  id: string
  playerId: string
  name: string
  role: string
  skills: Record<string, number>
  overall: number
  basePrice: number
  status: AuctionPlayerStatus
  soldToTeamId: string | null
  soldToTeamName: string | null
  soldPrice: number | null
  order: number
  createdAt: Timestamp
}

export interface AuctionBid {
  id: string
  playerId: string
  teamId: string
  teamName: string
  amount: number
  timestamp: Timestamp
}

export interface TeamBudget {
  teamId: string
  teamName: string
  initialBudget: number
  spent: number
  remaining: number
  playersBought: number
}

export const AUTO_BID_STEPS = [10, 25, 50, 100, 200]

export function getBidIncrements(currentBid: number): number[] {
  if (currentBid < 100) return [currentBid + 10, currentBid + 25, currentBid + 50]
  if (currentBid < 500) return [currentBid + 25, currentBid + 50, currentBid + 100]
  if (currentBid < 1000) return [currentBid + 50, currentBid + 100, currentBid + 200]
  return [currentBid + 100, currentBid + 200, currentBid + 500]
}
