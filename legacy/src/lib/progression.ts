import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  PlayerProgression,
  PlayerMatchRecord,
  Badge,
  BadgeType,
  LevelInfo,
} from '@/types/progression'
import { BADGE_DEFINITIONS } from '@/types/progression'
import type { PlayerBattingStats, PlayerBowlingStats } from '@/lib/match-engine'
import type { PlayerSkills } from '@/types/player'

/* ─── XP & Leveling Formulas ────────────────────────── */

export function xpRequiredForLevel(level: number): number {
  if (level >= 100) return Infinity
  return Math.floor(50 * Math.pow(level, 1.3))
}

export function calculateLevel(totalXp: number): LevelInfo {
  let level = 1
  let accumulated = 0
  while (level < 100) {
    const needed = xpRequiredForLevel(level)
    if (accumulated + needed > totalXp) break
    accumulated += needed
    level++
  }
  const currentXp = totalXp - accumulated
  const xpForNext = xpRequiredForLevel(level)
  return { level, currentXp, xpForNext, totalXp, progress: currentXp / xpForNext }
}

/* ─── XP Calculation ───────────────────────────────── */

export function calculateMatchXP(params: {
  battingStats: PlayerBattingStats
  catches?: number
  bowlingStats?: PlayerBowlingStats
  isManOfMatch: boolean
  isWinner: boolean
  role: string
}): number {
  const { battingStats, bowlingStats, catches, isManOfMatch, isWinner, role } = params

  let xp = 10

  xp += battingStats.runs * 2
  xp += battingStats.fours * 5
  xp += battingStats.sixes * 10

  if (battingStats.ballsFaced > 0) {
    const sr = (battingStats.runs / battingStats.ballsFaced) * 100
    if (sr >= 200) xp += 50
    else if (sr >= 150) xp += 30
    else if (sr >= 120) xp += 15
    else if (sr >= 90) xp += 5
  }

  if (bowlingStats) {
    xp += bowlingStats.wickets * 25
    xp += bowlingStats.dotBalls * 1

    if (bowlingStats.legalBalls > 0) {
      const eco = (bowlingStats.runsConceded / bowlingStats.legalBalls) * 6
      if (eco <= 4) xp += 40
      else if (eco <= 6) xp += 20
      else if (eco <= 8) xp += 10
      else if (eco <= 10) xp += 5
    }
  }

  xp += (catches ?? 0) * 15

  if (isManOfMatch) xp += 100
  if (isWinner) xp += 25

  const roleMultiplier: Record<string, number> = {
    batsman: 1.0,
    bowler: 1.0,
    all_rounder: 1.2,
    wicket_keeper: 1.1,
  }
  xp = Math.round(xp * (roleMultiplier[role] ?? 1.0))

  return Math.max(1, xp)
}

/* ─── Skill Improvement ─────────────────────────────── */

export function calculateSkillImprovements(
  currentSkills: PlayerSkills,
  xpEarned: number,
  performance: {
    runs: number
    wickets: number
    catches: number
    isManOfMatch: boolean
  },
): Partial<PlayerSkills> {
  const improvements: Partial<PlayerSkills> = {}
  const baseGain = Math.min(3, Math.max(0, Math.floor(xpEarned / 80)))

  if (performance.runs >= 50) {
    const gain = Math.min(baseGain + 1, 100 - currentSkills.power)
    if (gain > 0) improvements.power = Math.min(99, currentSkills.power + gain)
    const timingGain = Math.min(baseGain, 100 - currentSkills.timing)
    if (timingGain > 0) improvements.timing = Math.min(99, currentSkills.timing + timingGain)
    const techGain = Math.min(baseGain, 100 - currentSkills.technique)
    if (techGain > 0) improvements.technique = Math.min(99, currentSkills.technique + techGain)
  }

  if (performance.wickets >= 2) {
    const gain = Math.min(baseGain + 1, 100 - currentSkills.accuracy)
    if (gain > 0) improvements.accuracy = Math.min(99, currentSkills.accuracy + gain)

    const primaryGain = Math.min(baseGain, 100 - Math.max(currentSkills.pace, currentSkills.spin))
    if (currentSkills.pace > currentSkills.spin) {
      if (primaryGain > 0) improvements.pace = Math.min(99, currentSkills.pace + primaryGain)
    } else {
      if (primaryGain > 0) improvements.spin = Math.min(99, currentSkills.spin + primaryGain)
    }
  }

  if (performance.catches >= 2) {
    const catchGain = Math.min(baseGain, 100 - currentSkills.catching)
    if (catchGain > 0) improvements.catching = Math.min(99, currentSkills.catching + catchGain)
  }

  if (performance.isManOfMatch) {
    const stamGain = Math.min(1, 100 - currentSkills.stamina)
    if (stamGain > 0) improvements.stamina = Math.min(99, currentSkills.stamina + stamGain)
  }

  return improvements
}

/* ─── Badge Detection ───────────────────────────────── */

export function checkNewBadges(
  progression: PlayerProgression,
  matchData?: { runs: number; wickets: number; isManOfMatch: boolean },
): BadgeType[] {
  const earned = new Set<BadgeType>()

  const levelBadges: Record<number, BadgeType> = { 10: 'level_10', 25: 'level_25', 50: 'level_50', 75: 'level_75', 100: 'level_100' }
  const lb = levelBadges[progression.level]
  if (lb) earned.add(lb)

  if (matchData) {
    if (matchData.runs >= 100) earned.add('centurion')
    if (matchData.wickets >= 5) earned.add('five_for')
    if (matchData.runs >= 50 && matchData.wickets >= 3) earned.add('all_rounder_show')
  }

  if (progression.totalRuns >= 1000) earned.add('runs_1000')
  if (progression.totalRuns >= 5000) earned.add('runs_5000')
  if (progression.totalRuns >= 10000) earned.add('runs_10000')
  if (progression.totalWickets >= 50) earned.add('wickets_50')
  if (progression.totalWickets >= 100) earned.add('wickets_100')
  if (progression.totalWickets >= 200) earned.add('wickets_200')
  if (progression.manOfMatchCount >= 10) earned.add('mom_10')

  return [...earned]
}

/* ─── Firestore CRUD ───────────────────────────────── */

export async function getPlayerProgression(playerId: string): Promise<PlayerProgression | null> {
  const snap = await getDoc(doc(db, 'player_progression', playerId))
  return snap.exists() ? ({ playerId: snap.id, ...snap.data() } as PlayerProgression) : null
}

export async function initPlayerProgression(playerId: string): Promise<void> {
  const existing = await getPlayerProgression(playerId)
  if (existing) return
  await setDoc(doc(db, 'player_progression', playerId), {
    playerId,
    xp: 0,
    level: 1,
    totalMatches: 0,
    totalRuns: 0,
    totalWickets: 0,
    totalCatches: 0,
    totalSixes: 0,
    totalFours: 0,
    manOfMatchCount: 0,
    centuries: 0,
    fiveWicketHauls: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function processMatchProgression(
  playerId: string,
  matchData: {
    matchId: string
    tournamentId: string
    runs: number
    ballsFaced: number
    fours: number
    sixes: number
    wickets: number
    oversBowled: number
    runsConceded: number
    catches: number
    stumpings: number
    runOuts: number
    isManOfMatch: boolean
    isWinner: boolean
    role: string
  },
): Promise<{ xpEarned: number; newLevel: number; newBadges: BadgeType[]; skillImprovements: Partial<PlayerSkills> }> {
  return runTransaction(db, async (tx) => {
    const progRef = doc(db, 'player_progression', playerId)
    const progSnap = await tx.get(progRef)
    if (!progSnap.exists()) throw new Error('Player progression not initialized')

    const prog = progSnap.data() as PlayerProgression

    const xpEarned = calculateMatchXP({
      battingStats: {
        playerId,
        playerName: '',
        runs: matchData.runs,
        ballsFaced: matchData.ballsFaced,
        fours: matchData.fours,
        sixes: matchData.sixes,
        dotBalls: 0,
        strikeRate: matchData.ballsFaced > 0 ? (matchData.runs / matchData.ballsFaced) * 100 : 0,
        isOut: false,
        dismissal: null,
      },
      bowlingStats: matchData.wickets > 0 || matchData.oversBowled > 0 ? {
        playerId,
        playerName: '',
        overs: matchData.oversBowled / 6,
        legalBalls: matchData.oversBowled,
        runsConceded: matchData.runsConceded,
        wickets: matchData.wickets,
        economy: matchData.oversBowled > 0 ? (matchData.runsConceded / matchData.oversBowled) * 6 : 0,
        wides: 0,
        noBalls: 0,
        dotBalls: 0,
      } : undefined,
      catches: matchData.catches,
      isManOfMatch: matchData.isManOfMatch,
      isWinner: matchData.isWinner,
      role: matchData.role,
    })

    const newTotalXp = prog.xp + xpEarned
    const levelInfo = calculateLevel(newTotalXp)

    const newProg = {
      ...prog,
      xp: newTotalXp,
      level: levelInfo.level,
      totalMatches: prog.totalMatches + 1,
      totalRuns: prog.totalRuns + matchData.runs,
      totalWickets: prog.totalWickets + matchData.wickets,
      totalCatches: prog.totalCatches + matchData.catches,
      totalSixes: prog.totalSixes + matchData.sixes,
      totalFours: prog.totalFours + matchData.fours,
      manOfMatchCount: prog.manOfMatchCount + (matchData.isManOfMatch ? 1 : 0),
      centuries: prog.centuries + (matchData.runs >= 100 ? 1 : 0),
      fiveWicketHauls: prog.fiveWicketHauls + (matchData.wickets >= 5 ? 1 : 0),
      updatedAt: serverTimestamp(),
    }

    tx.update(progRef, newProg as Record<string, unknown>)

    // Save match record
    const matchRecordRef = doc(collection(db, 'player_match_history'))
    tx.set(matchRecordRef, {
      playerId,
      matchId: matchData.matchId,
      tournamentId: matchData.tournamentId,
      runs: matchData.runs,
      ballsFaced: matchData.ballsFaced,
      fours: matchData.fours,
      sixes: matchData.sixes,
      strikeRate: matchData.ballsFaced > 0 ? Math.round((matchData.runs / matchData.ballsFaced) * 100) : 0,
      wickets: matchData.wickets,
      oversBowled: matchData.oversBowled,
      runsConceded: matchData.runsConceded,
      economy: matchData.oversBowled > 0 ? Math.round((matchData.runsConceded / matchData.oversBowled) * 6 * 100) / 100 : 0,
      catches: matchData.catches,
      stumpings: matchData.stumpings,
      runOuts: matchData.runOuts,
      isManOfMatch: matchData.isManOfMatch,
      isWinner: matchData.isWinner,
      xpEarned,
      createdAt: serverTimestamp(),
    })

    const newBadges = checkNewBadges(
      { ...newProg, playerId } as PlayerProgression,
      { runs: matchData.runs, wickets: matchData.wickets, isManOfMatch: matchData.isManOfMatch },
    )

    // Award new badges
    for (const badgeType of newBadges) {
      const def = BADGE_DEFINITIONS[badgeType]
      const badgeRef = doc(collection(db, 'player_badges'))
      tx.set(badgeRef, {
        playerId,
        type: badgeType,
        category: def.category,
        name: def.name,
        description: def.description,
        icon: def.icon,
        earnedAt: serverTimestamp(),
      })
    }

    // Skill improvements (simplified — apply to skills doc or return for caller)
    const skillImprovements: Partial<PlayerSkills> = calculateSkillImprovements(
      {} as PlayerSkills,
      xpEarned,
      { runs: matchData.runs, wickets: matchData.wickets, catches: matchData.catches, isManOfMatch: matchData.isManOfMatch },
    )

    return { xpEarned, newLevel: levelInfo.level, newBadges, skillImprovements }
  })
}

export async function getPlayerMatchHistory(playerId: string, max = 20): Promise<PlayerMatchRecord[]> {
  const q = query(
    collection(db, 'player_match_history'),
    where('playerId', '==', playerId),
    orderBy('createdAt', 'desc'),
    limit(max) as any,
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlayerMatchRecord))
}

export async function getPlayerBadges(playerId: string): Promise<Badge[]> {
  const q = query(
    collection(db, 'player_badges'),
    where('playerId', '==', playerId),
    orderBy('earnedAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Badge))
}

export async function applySkillImprovements(
  playerId: string,
  improvements: Partial<PlayerSkills>,
): Promise<void> {
  if (Object.keys(improvements).length === 0) return
  const ref = doc(db, 'players', playerId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const current = snap.data().skills as PlayerSkills
  const updated = { ...current }
  for (const [key, val] of Object.entries(improvements)) {
    if (val !== undefined) updated[key as keyof PlayerSkills] = val
  }
  await setDoc(ref, { skills: updated, updatedAt: serverTimestamp() }, { merge: true })
}
