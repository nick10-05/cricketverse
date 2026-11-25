import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PlayerRankingEntry, TeamRankingEntry, TournamentRankingEntry } from '@/types/ranking'
import type { PlayerProgression } from '@/types/progression'
import type { Team, Tournament } from '@/types/tournament'

/* ─── Player Rating Calculation ────────────────────── */

const ROLE_WEIGHTS: Record<string, { batting: number; bowling: number; fielding: number; experience: number }> = {
  batsman:       { batting: 0.55, bowling: 0.10, fielding: 0.10, experience: 0.25 },
  bowler:        { batting: 0.10, bowling: 0.55, fielding: 0.10, experience: 0.25 },
  all_rounder:   { batting: 0.30, bowling: 0.30, fielding: 0.15, experience: 0.25 },
  wicket_keeper: { batting: 0.30, bowling: 0.05, fielding: 0.40, experience: 0.25 },
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function calcBattingRating(runs: number, matches: number, centuries: number, fours: number, sixes: number): number {
  if (matches === 0) return 0
  const avg = runs / matches
  const runsScore = clamp(avg * 2.5, 0, 200)
  const centuryScore = centuries * 20
  const fourScore = fours * 0.3
  const sixScore = sixes * 0.5
  const volumeBonus = runs >= 1000 ? 50 : runs >= 500 ? 25 : runs >= 100 ? 10 : 0
  return clamp(runsScore + centuryScore + fourScore + sixScore + volumeBonus, 0, 500)
}

export function calcBowlingRating(wickets: number, matches: number, fiveWickets: number): number {
  if (matches === 0) return 0
  const wpm = wickets / matches
  const wicketScore = clamp(wpm * 30, 0, 200)
  const fiveWicketScore = fiveWickets * 25
  const volumeBonus = wickets >= 100 ? 50 : wickets >= 50 ? 25 : wickets >= 10 ? 10 : 0
  return clamp(wicketScore + fiveWicketScore + volumeBonus, 0, 500)
}

export function calcFieldingRating(catches: number, matches: number): number {
  if (matches === 0) return 0
  const cpm = catches / matches
  return clamp(cpm * 20 + catches * 2, 0, 100)
}

export function calcExperienceBonus(level: number, momCount: number): number {
  return clamp(level * 0.5 + momCount * 3, 0, 100)
}

export function calcPlayerRating(
  role: string,
  runs: number,
  wickets: number,
  catches: number,
  matches: number,
  centuries: number,
  fiveWickets: number,
  fours: number,
  sixes: number,
  level: number,
  momCount: number,
): { overall: number; batting: number; bowling: number; fielding: number } {
  const batting = calcBattingRating(runs, matches, centuries, fours, sixes)
  const bowling = calcBowlingRating(wickets, matches, fiveWickets)
  const fielding = calcFieldingRating(catches, matches)
  const expBonus = calcExperienceBonus(level, momCount)

  const w = ROLE_WEIGHTS[role] ?? ROLE_WEIGHTS.batsman
  const overall = clamp(
    batting * w.batting + bowling * w.bowling + fielding * w.fielding + expBonus * w.experience,
    0,
    1000,
  )

  return { overall: Math.round(overall), batting: Math.round(batting), bowling: Math.round(bowling), fielding: Math.round(fielding) }
}

export function playerFromProgression(
  p: PlayerProgression,
  role?: string,
  name?: string,
): PlayerRankingEntry {
  const rating = calcPlayerRating(
    role ?? 'batsman',
    p.totalRuns,
    p.totalWickets,
    p.totalCatches,
    p.totalMatches,
    p.centuries,
    p.fiveWicketHauls,
    p.totalFours,
    p.totalSixes,
    p.level,
    p.manOfMatchCount,
  )

  return {
    playerId: p.playerId,
    name: name ?? 'Unknown',
    role: role ?? 'batsman',
    rating: rating.overall,
    battingRating: rating.batting,
    bowlingRating: rating.bowling,
    fieldingRating: rating.fielding,
    level: p.level,
    totalXp: p.xp,
    totalMatches: p.totalMatches,
    totalRuns: p.totalRuns,
    totalWickets: p.totalWickets,
    totalCatches: p.totalCatches,
    manOfMatchCount: p.manOfMatchCount,
    centuries: p.centuries,
    fiveWicketHauls: p.fiveWicketHauls,
  }
}

/* ─── Team Rating Calculation ──────────────────────── */

export function calcTeamRating(
  wins: number,
  ties: number,
  matches: number,
  nrr: number,
  tournamentWins: number,
): number {
  if (matches === 0) return 0
  const winPct = (wins + ties * 0.5) / matches
  const winScore = winPct * 400
  const nrrScore = clamp(nrr * 20, -100, 100)
  const matchVolume = clamp(matches * 3, 0, 100)
  const tourneyWinScore = tournamentWins * 50
  return clamp(winScore + nrrScore + matchVolume + tourneyWinScore, 0, 1000)
}

export function teamFromTeamData(
  teamId: string,
  teamName: string,
  matchesPlayed: number,
  matchesWon: number,
  matchesLost: number,
  matchesTied: number,
  nrr: number,
  tournamentWins: number,
  tournamentId: string,
  tournamentName: string,
): TeamRankingEntry {
  return {
    teamId,
    teamName,
    tournamentId,
    tournamentName,
    rating: calcTeamRating(matchesWon, matchesTied, matchesPlayed, nrr, tournamentWins),
    matchesPlayed,
    matchesWon,
    matchesLost,
    nrr,
    winPercent: matchesPlayed > 0 ? Math.round(((matchesWon + matchesTied * 0.5) / matchesPlayed) * 100) : 0,
    tournamentWins,
  }
}

/* ─── Tournament Rating Calculation ────────────────── */

export function calcTournamentRating(
  teamCount: number,
  totalMatches: number,
  completedMatches: number,
  overs: number,
  avgTeamRating: number,
): number {
  const sizeScore = clamp(teamCount * 10, 0, 200)
  const completionPct = totalMatches > 0 ? completedMatches / totalMatches : 0
  const completionScore = completionPct * 150
  const oversScore = overs >= 20 ? 50 : overs >= 10 ? 30 : overs >= 5 ? 15 : 5
  const strengthScore = clamp(avgTeamRating * 0.5, 0, 200)
  return clamp(sizeScore + completionScore + oversScore + strengthScore, 0, 1000)
}

/* ─── Firestore Service Functions ──────────────────── */

export async function getPlayerRankings(max = 50): Promise<PlayerRankingEntry[]> {
  const snap = await getDocs(query(collection(db, 'player_progression'), orderBy('xp', 'desc'), limit(max)))
  const entries: PlayerRankingEntry[] = []
  for (const doc of snap.docs) {
    const data = doc.data() as PlayerProgression
    const playerSnap = await getDocs(query(collection(db, 'players'), limit(1)))
    const playerData = playerSnap.docs.find((d) => d.id === doc.id)?.data() as { name?: string; role?: string } | undefined
    const entry = playerFromProgression(data, playerData?.role, playerData?.name)
    entries.push(entry)
  }
  return entries
}

export async function getTeamRankings(max = 50): Promise<TeamRankingEntry[]> {
  const tournamentSnap = await getDocs(collection(db, 'tournaments'))
  const teams: TeamRankingEntry[] = []
  for (const tDoc of tournamentSnap.docs) {
    const tournament = tDoc.data() as Tournament
    const teamSnap = await getDocs(collection(db, 'tournaments', tDoc.id, 'teams'))
    for (const teamDoc of teamSnap.docs) {
      const team = teamDoc.data() as Team
      const wins = team.id === tournament.winnerTeamId ? 1 : 0
      teams.push(teamFromTeamData(
        teamDoc.id, team.name, team.matchesPlayed, team.matchesWon,
        team.matchesLost, team.matchesTied, team.nrr, wins,
        tDoc.id, tournament.name,
      ))
    }
  }
  return teams.sort((a, b) => b.rating - a.rating).slice(0, max)
}

export async function getTournamentRankings(max = 50): Promise<TournamentRankingEntry[]> {
  const snap = await getDocs(collection(db, 'tournaments'))
  const entries: TournamentRankingEntry[] = []
  for (const doc of snap.docs) {
    const t = doc.data() as Tournament
    const matchSnap = await getDocs(collection(db, 'tournaments', doc.id, 'matches'))
    const matches = matchSnap.docs.map((m) => m.data() as { status?: string })
    const totalMatches = matches.length
    const completedMatches = matches.filter((m) => m.status === 'completed').length
    entries.push({
      tournamentId: doc.id,
      name: t.name,
      format: t.format,
      rating: calcTournamentRating(t.teamCount, totalMatches, completedMatches, t.overs, 0),
      teamCount: t.teamCount,
      totalMatches,
      completedMatches,
      avgTeamRating: 0,
      overs: t.overs,
    })
  }
  return entries.sort((a, b) => b.rating - a.rating).slice(0, max)
}
