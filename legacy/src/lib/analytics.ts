/**
 * CricketVerse Analytics Module
 *
 * Lightweight analytics for beta tracking without Firebase Analytics dependency.
 * Logs events to localStorage for debug viewing and sends to a configurable endpoint.
 * Can be swapped for Firebase Analytics / GA4 in production.
 */

import {
  collection, getDocs, query, orderBy, limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { GlobalStats, BattingRecord, BowlingRecord, TeamStats, TournamentStats, ChartDataPoint } from '@/types/analytics'

const ANALYTICS_KEY = 'cv_analytics_events'
const ANALYTICS_ENABLED_KEY = 'cv_analytics_enabled'

type EventCategory =
  | 'page_view'
  | 'auth'
  | 'match'
  | 'gameplay'
  | 'tournament'
  | 'error'
  | 'performance'
  | 'social'

interface AnalyticsEvent {
  category: EventCategory
  action: string
  label?: string
  value?: number
  metadata?: Record<string, string | number | boolean>
  timestamp: number
  sessionId: string
}

let sessionId = crypto.randomUUID?.() ?? Date.now().toString(36)

export function initAnalytics(): void {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(ANALYTICS_ENABLED_KEY)
    if (stored === null) {
      localStorage.setItem(ANALYTICS_ENABLED_KEY, 'true')
    }
    const existing = localStorage.getItem(ANALYTICS_KEY)
    if (!existing) {
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify([]))
    }
    trackEvent('page_view', 'analytics_init', 'Analytics initialized')
    trackPerformance('analytics_init_time', performance.now())
  } catch {
    // localStorage unavailable
  }
}

export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ANALYTICS_ENABLED_KEY, enabled.toString())
  } catch {
    // ignore
  }
}

export function isAnalyticsEnabled(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_ENABLED_KEY) !== 'false'
  } catch {
    return false
  }
}

export function trackEvent(
  category: EventCategory,
  action: string,
  label?: string,
  value?: number,
  metadata?: Record<string, string | number | boolean>,
): void {
  if (!isAnalyticsEnabled()) return

  const event: AnalyticsEvent = {
    category,
    action,
    label,
    value,
    metadata,
    timestamp: Date.now(),
    sessionId,
  }

  try {
    const stored = localStorage.getItem(ANALYTICS_KEY)
    const events: AnalyticsEvent[] = stored ? JSON.parse(stored) : []
    events.push(event)
    if (events.length > 1000) events.splice(0, events.length - 1000)
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events))
  } catch {
    // storage full, clear old entries
    try {
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify([event]))
    } catch {
      // give up
    }
  }

  if (import.meta.env.DEV) {
    console.debug('[Analytics]', category, action, label ?? '', value ?? '')
  }
}

export function trackError(error: Error, context?: string): void {
  trackEvent('error', error.name, context ?? error.message)
  if (typeof window !== 'undefined' && 'reportError' in window) {
    window.reportError(error)
  }
}

export function trackPerformance(name: string, durationMs: number): void {
  trackEvent('performance', name, undefined, Math.round(durationMs))
}

export function getStoredEvents(): AnalyticsEvent[] {
  try {
    const stored = localStorage.getItem(ANALYTICS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function clearStoredEvents(): void {
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify([]))
  } catch {
    // ignore
  }
}

export function getEventSummary(): Record<EventCategory, number> {
  const events = getStoredEvents()
  const summary: Record<string, number> = {}
  for (const e of events) {
    summary[e.category] = (summary[e.category] ?? 0) + 1
  }
  return summary as Record<EventCategory, number>
}

export function generateSessionReport(): string {
  const events = getStoredEvents()
  if (events.length === 0) return 'No analytics data'

  const lines: string[] = [
    `=== CricketVerse Analytics Report ===`,
    `Session: ${sessionId}`,
    `Events: ${events.length}`,
    `Period: ${new Date(events[0]?.timestamp ?? Date.now()).toISOString()} — ${new Date(events[events.length - 1]?.timestamp ?? Date.now()).toISOString()}`,
    ``,
    `Category Breakdown:`,
  ]

  const summary = getEventSummary()
  for (const [cat, count] of Object.entries(summary)) {
    lines.push(`  ${cat}: ${count}`)
  }

  lines.push(``, `Recent Events (last 20):`)
  for (const e of events.slice(-20)) {
    lines.push(`  [${new Date(e.timestamp).toISOString()}] ${e.category}:${e.action} ${e.label ?? ''}`)
  }

  return lines.join('\n')
}

// --- Game-specific tracking helpers ---

export function trackMatchStart(matchId: string, format: '1v1' | '2v2', overs: number): void {
  trackEvent('match', 'match_start', format, overs, { matchId })
}

export function trackMatchEnd(matchId: string, winnerId: string, totalBalls: number): void {
  trackEvent('match', 'match_end', winnerId, totalBalls, { matchId })
}

export function trackDeliveryComplete(deliveryNumber: number, outcome: string): void {
  trackEvent('gameplay', 'delivery_complete', outcome, deliveryNumber)
}

export function trackWicket(wicketType: string, deliveryNumber: number): void {
  trackEvent('gameplay', 'wicket', wicketType, deliveryNumber)
}

export function trackTournamentCreated(tournamentId: string, format: string, overs: number): void {
  trackEvent('tournament', 'created', format, overs, { tournamentId })
}

export function trackTournamentStarted(tournamentId: string, teamCount: number): void {
  trackEvent('tournament', 'started', undefined, teamCount, { tournamentId })
}

export function trackPlayerJoin(method: 'google'): void {
  trackEvent('auth', 'login', method)
}

export function trackPageView(page: string): void {
  trackEvent('page_view', page)
}

export function trackFriendInvite(sent: boolean): void {
  trackEvent('social', sent ? 'invite_sent' : 'invite_failed')
}

export function trackRoomCreated(roomCode: string, format: '1v1' | '2v2'): void {
  trackEvent('social', 'room_created', roomCode, undefined, { format })
}

// --- Firestore Analytics Query Functions (used by AnalyticsPage) ---

export async function getGlobalStats(): Promise<GlobalStats> {
  const matchesSnap = await getDocs(collection(db, 'matches'))
  const matches = matchesSnap.docs.map((d) => d.data())
  const tournamentsSnap = await getDocs(collection(db, 'tournaments'))
  const tournamentCount = tournamentsSnap.size
  const playersSnap = await getDocs(collection(db, 'users'))
  const playerCount = playersSnap.size

  let totalRuns = 0
  let totalWickets = 0
  let totalFours = 0
  let totalSixes = 0
  let totalCenturies = 0
  let totalFiveWickets = 0

  for (const m of matches) {
    const inns = (m as Record<string, unknown>).innings as Array<Record<string, unknown>> | undefined
    if (inns) {
      for (const inn of inns) {
        totalRuns += (inn.total as number) ?? 0
        totalWickets += (inn.wickets as number) ?? 0
        const batStats = inn.battingStats as Record<string, { runs: number; fours: number; sixes: number }> | undefined
        if (batStats) {
          for (const s of Object.values(batStats)) {
            totalFours += s.fours ?? 0
            totalSixes += s.sixes ?? 0
            if ((s.runs ?? 0) >= 100) totalCenturies++
          }
        }
      }
    }
  }

  return {
    totalRuns, totalWickets, totalMatches: matches.length,
    totalTournaments: tournamentCount, totalPlayers: playerCount,
    totalFours, totalSixes, totalCenturies, totalFiveWickets,
  }
}

export async function getBattingLeaderboard(count = 10): Promise<BattingRecord[]> {
  const matchesSnap = await getDocs(collection(db, 'matches'))
  const playerStats: Record<string, BattingRecord> = {}

  for (const doc of matchesSnap.docs) {
    const data = doc.data()
    const inns = data.innings as Array<Record<string, unknown>> | undefined
    if (!inns) continue
    for (const inn of inns) {
      const batStats = inn.battingStats as Record<string, { runs: number; ballsFaced: number; fours: number; sixes: number; playerName: string }> | undefined
      if (!batStats) continue
      for (const [pid, s] of Object.entries(batStats)) {
        if (!playerStats[pid]) {
          playerStats[pid] = { playerId: pid, name: s.playerName ?? pid, matches: 0, runs: 0, ballsFaced: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, centuries: 0, fifties: 0, highestScore: 0 }
        }
        const ps = playerStats[pid]
        ps.matches++
        ps.runs += s.runs ?? 0
        ps.ballsFaced += s.ballsFaced ?? 0
        ps.fours += s.fours ?? 0
        ps.sixes += s.sixes ?? 0
        if ((s.runs ?? 0) >= 100) ps.centuries++
        if ((s.runs ?? 0) >= 50 && (s.runs ?? 0) < 100) ps.fifties++
        if ((s.runs ?? 0) > ps.highestScore) ps.highestScore = s.runs ?? 0
      }
    }
  }

  return Object.values(playerStats)
    .map((p) => ({
      ...p,
      average: p.runs > 0 && p.matches > 0 ? Math.round((p.runs / p.matches) * 100) / 100 : 0,
      strikeRate: p.ballsFaced > 0 ? Math.round((p.runs / p.ballsFaced) * 100 * 100) / 100 : 0,
    }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, count)
}

export async function getBowlingLeaderboard(count = 10): Promise<BowlingRecord[]> {
  const matchesSnap = await getDocs(collection(db, 'matches'))
  const playerStats: Record<string, BowlingRecord> = {}

  for (const doc of matchesSnap.docs) {
    const data = doc.data()
    const inns = data.innings as Array<Record<string, unknown>> | undefined
    if (!inns) continue
    for (const inn of inns) {
      const bowlStats = inn.bowlingStats as Record<string, { wickets: number; runsConceded: number; legalBalls: number; playerName: string }> | undefined
      if (!bowlStats) continue
      for (const [pid, s] of Object.entries(bowlStats)) {
        if (!playerStats[pid]) {
          playerStats[pid] = { playerId: pid, name: s.playerName ?? pid, matches: 0, wickets: 0, runsConceded: 0, ballsBowled: 0, average: 0, economy: 0, strikeRate: 0, bestWickets: 0, bestRuns: 0, fiveWickets: 0 }
        }
        const ps = playerStats[pid]
        ps.matches++
        ps.wickets += s.wickets ?? 0
        ps.runsConceded += s.runsConceded ?? 0
        ps.ballsBowled += s.legalBalls ?? 0
        if ((s.wickets ?? 0) >= 5) ps.fiveWickets++
        if ((s.wickets ?? 0) > ps.bestWickets) { ps.bestWickets = s.wickets ?? 0; ps.bestRuns = s.runsConceded ?? 0 }
      }
    }
  }

  return Object.values(playerStats)
    .map((p) => ({
      ...p,
      average: p.wickets > 0 ? Math.round((p.runsConceded / p.wickets) * 100) / 100 : 0,
      economy: p.ballsBowled > 0 ? Math.round((p.runsConceded / (p.ballsBowled / 6)) * 100) / 100 : 0,
      strikeRate: p.wickets > 0 ? Math.round((p.ballsBowled / p.wickets) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, count)
}

export async function getTeamStats(count = 10): Promise<TeamStats[]> {
  const snap = await getDocs(query(collection(db, 'teams'), orderBy('name'), limit(count)))
  const results: TeamStats[] = []

  for (const doc of snap.docs) {
    const t = doc.data()
    results.push({
      teamName: t.name as string,
      tournamentName: '',
      matchesPlayed: 0, won: 0, lost: 0, tied: 0,
      winPercent: 0, nrr: 0, runsScored: 0, runsConceded: 0,
    })
  }

  return results
}

export async function getTournamentStats(count = 10): Promise<TournamentStats[]> {
  const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(count)))
  return snap.docs.map((doc) => {
    const t = doc.data()
    return {
      tournamentId: doc.id,
      name: t.name as string,
      format: t.format as string,
      totalRuns: 0, totalWickets: 0, totalFours: 0, totalSixes: 0,
      highestScore: 0, bestBowling: '', topScorer: '', topWicketTaker: '',
      totalMatches: 0, completedMatches: t.status === 'completed' ? 1 : 0,
    }
  })
}

export async function getFormatDistribution(): Promise<ChartDataPoint[]> {
  const snap = await getDocs(collection(db, 'tournaments'))
  const counts: Record<string, number> = {}
  for (const doc of snap.docs) {
    const fmt = (doc.data().format as string) ?? 'unknown'
    counts[fmt] = (counts[fmt] ?? 0) + 1
  }
  return Object.entries(counts).map(([label, value]) => ({ label, value }))
}

export async function getStatusDistribution(): Promise<ChartDataPoint[]> {
  const snap = await getDocs(collection(db, 'tournaments'))
  const counts: Record<string, number> = {}
  for (const doc of snap.docs) {
    const st = (doc.data().status as string) ?? 'unknown'
    counts[st] = (counts[st] ?? 0) + 1
  }
  return Object.entries(counts).map(([label, value]) => ({ label, value }))
}

export async function getTopScorers(count = 10): Promise<ChartDataPoint[]> {
  const lb = await getBattingLeaderboard(count)
  return lb.map((p) => ({ label: p.name, value: p.runs }))
}

export async function getTopWicketTakers(count = 10): Promise<ChartDataPoint[]> {
  const lb = await getBowlingLeaderboard(count)
  return lb.map((p) => ({ label: p.name, value: p.wickets }))
}
