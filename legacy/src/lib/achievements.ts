import {
  doc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  type PlayerAchievement,
  type AchievementDefinition,
  type AchievementCategory,
  type UnlockNotification,
} from '@/types/achievements'
import type { PlayerProgression } from '@/types/progression'
import { sendNotification, buildNotification } from '@/lib/notifications'

export async function initPlayerAchievements(playerId: string): Promise<void> {
  const q = query(
    collection(db, 'player_achievements'),
    where('playerId', '==', playerId),
  )
  const snap = await getDocs(q)
  if (snap.size >= ACHIEVEMENTS.length) return

  const existingIds = new Set(snap.docs.map((d) => d.data().achievementId))
  const batch = writeBatch(db)

  for (const def of ACHIEVEMENTS) {
    if (existingIds.has(def.id)) continue
    const ref = doc(collection(db, 'player_achievements'))
    batch.set(ref, {
      playerId,
      achievementId: def.id,
      unlocked: false,
      unlockedAt: null,
      progress: { current: 0, target: 0 },
    })
  }

  await batch.commit()
}

export async function getPlayerAchievements(playerId: string): Promise<PlayerAchievement[]> {
  const q = query(
    collection(db, 'player_achievements'),
    where('playerId', '==', playerId),
    orderBy('achievementId'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlayerAchievement))
}

export interface AchievementConditionInput {
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
  isFinal: boolean
  isUndefeated?: boolean
  role: string
}

function checkSingleAchievement(
  def: AchievementDefinition,
  prog: PlayerProgression,
  match: AchievementConditionInput,
): { unlock: boolean; progress: { current: number; target: number } } {
  const id = def.id

  // ── Batting ──
  if (id === 'first_runs')      return { unlock: match.runs > 0, progress: { current: match.runs > 0 ? 1 : 0, target: 1 } }
  if (id === 'double_digits')   return { unlock: match.runs >= 10, progress: { current: match.runs, target: 10 } }
  if (id === 'half_century')    return { unlock: match.runs >= 50, progress: { current: match.runs, target: 50 } }
  if (id === 'century')         return { unlock: match.runs >= 100, progress: { current: match.runs, target: 100 } }
  if (id === 'double_century')  return { unlock: match.runs >= 200, progress: { current: match.runs, target: 200 } }
  if (id === 'six_machine')     return { unlock: match.sixes >= 5, progress: { current: match.sixes, target: 5 } }
  if (id === 'boundary_fest')   return { unlock: match.fours >= 10, progress: { current: match.fours, target: 10 } }
  if (id === 'runs_500')        return { unlock: prog.totalRuns >= 500, progress: { current: prog.totalRuns, target: 500 } }
  if (id === 'runs_2000')       return { unlock: prog.totalRuns >= 2000, progress: { current: prog.totalRuns, target: 2000 } }
  if (id === 'runs_5000')       return { unlock: prog.totalRuns >= 5000, progress: { current: prog.totalRuns, target: 5000 } }
  if (id === 'runs_10000')      return { unlock: prog.totalRuns >= 10000, progress: { current: prog.totalRuns, target: 10000 } }

  // ── Bowling ──
  if (id === 'first_wicket')    return { unlock: match.wickets > 0, progress: { current: match.wickets > 0 ? 1 : 0, target: 1 } }
  if (id === 'double_strike')   return { unlock: match.wickets >= 2, progress: { current: match.wickets, target: 2 } }
  if (id === 'four_for')        return { unlock: match.wickets >= 4, progress: { current: match.wickets, target: 4 } }
  if (id === 'five_for')        return { unlock: match.wickets >= 5, progress: { current: match.wickets, target: 5 } }
  if (id === 'seven_for')       return { unlock: match.wickets >= 7, progress: { current: match.wickets, target: 7 } }
  if (id === 'economy_master') {
    const legal = match.oversBowled
    const eco = legal >= 24 ? (match.runsConceded / legal) * 6 : 999
    return { unlock: eco <= 4, progress: { current: Math.round(eco * 100) / 100, target: 4 } }
  }
  if (id === 'wickets_25')      return { unlock: prog.totalWickets >= 25, progress: { current: prog.totalWickets, target: 25 } }
  if (id === 'wickets_100')     return { unlock: prog.totalWickets >= 100, progress: { current: prog.totalWickets, target: 100 } }
  if (id === 'wickets_200')     return { unlock: prog.totalWickets >= 200, progress: { current: prog.totalWickets, target: 200 } }
  if (id === 'wickets_500')     return { unlock: prog.totalWickets >= 500, progress: { current: prog.totalWickets, target: 500 } }

  // ── Fielding ──
  if (id === 'first_catch')     return { unlock: match.catches > 0, progress: { current: match.catches > 0 ? 1 : 0, target: 1 } }
  if (id === 'catches_10')      return { unlock: prog.totalCatches >= 10, progress: { current: prog.totalCatches, target: 10 } }
  if (id === 'catches_50')      return { unlock: prog.totalCatches >= 50, progress: { current: prog.totalCatches, target: 50 } }
  if (id === 'catches_100')     return { unlock: prog.totalCatches >= 100, progress: { current: prog.totalCatches, target: 100 } }
  if (id === 'runout_5')        return { unlock: prog.totalCatches >= 5, progress: { current: prog.totalCatches, target: 5 } }
  if (id === 'stumping_5')      return { unlock: match.stumpings >= 5, progress: { current: match.stumpings, target: 5 } }

  // ── Tournament ──
  if (id === 'first_match')     return { unlock: prog.totalMatches >= 1, progress: { current: Math.min(prog.totalMatches, 1), target: 1 } }
  if (id === 'matches_25')      return { unlock: prog.totalMatches >= 25, progress: { current: prog.totalMatches, target: 25 } }
  if (id === 'matches_100')     return { unlock: prog.totalMatches >= 100, progress: { current: prog.totalMatches, target: 100 } }
  if (id === 'matches_250')     return { unlock: prog.totalMatches >= 250, progress: { current: prog.totalMatches, target: 250 } }
  if (id === 'tournament_winner') return { unlock: match.isWinner && match.isFinal, progress: { current: match.isWinner && match.isFinal ? 1 : 0, target: 1 } }
  if (id === 'undefeated')      return { unlock: match.isWinner && match.isFinal && !!match.isUndefeated, progress: { current: match.isWinner && match.isFinal && match.isUndefeated ? 1 : 0, target: 1 } }
  if (id === 'final_hero')      return { unlock: match.isManOfMatch && match.isFinal, progress: { current: match.isManOfMatch && match.isFinal ? 1 : 0, target: 1 } }
  if (id === 'perfect_start')   return { unlock: match.isWinner && prog.totalMatches === 1, progress: { current: match.isWinner && prog.totalMatches === 1 ? 1 : 0, target: 1 } }

  // ── Special ──
  if (id === 'first_mom')       return { unlock: match.isManOfMatch, progress: { current: match.isManOfMatch ? 1 : 0, target: 1 } }
  if (id === 'mom_3')           return { unlock: prog.manOfMatchCount >= 3, progress: { current: prog.manOfMatchCount, target: 3 } }
  if (id === 'mom_10')          return { unlock: prog.manOfMatchCount >= 10, progress: { current: prog.manOfMatchCount, target: 10 } }
  if (id === 'all_rounder_show') return { unlock: match.runs >= 50 && match.wickets >= 3, progress: { current: match.runs >= 50 && match.wickets >= 3 ? 1 : 0, target: 1 } }
  if (id === 'level_10')        return { unlock: prog.level >= 10, progress: { current: prog.level, target: 10 } }
  if (id === 'level_25')        return { unlock: prog.level >= 25, progress: { current: prog.level, target: 25 } }
  if (id === 'level_50')        return { unlock: prog.level >= 50, progress: { current: prog.level, target: 50 } }
  if (id === 'level_75')        return { unlock: prog.level >= 75, progress: { current: prog.level, target: 75 } }
  if (id === 'level_100')       return { unlock: prog.level >= 100, progress: { current: prog.level, target: 100 } }
  if (id === 'hat_trick')       return { unlock: false, progress: { current: 0, target: 1 } }
  if (id === 'perfect_over')    return { unlock: false, progress: { current: 0, target: 1 } }
  if (id === 'sixes_20')        return { unlock: prog.totalSixes >= 20, progress: { current: prog.totalSixes, target: 20 } }
  if (id === 'fours_50')        return { unlock: prog.totalFours >= 50, progress: { current: prog.totalFours, target: 50 } }

  return { unlock: false, progress: { current: 0, target: 0 } }
}

export async function checkAndUnlockAchievements(
  playerId: string,
  progression: PlayerProgression,
  matchInput: AchievementConditionInput,
): Promise<UnlockNotification[]> {
  const achievements = await getPlayerAchievements(playerId)
  const unlocked: UnlockNotification[] = []

  const lockedMap = new Map(
    achievements.filter((a) => !a.unlocked).map((a) => [a.achievementId, a]),
  )

  const batch = writeBatch(db)

  for (const def of ACHIEVEMENTS) {
    const playerAch = lockedMap.get(def.id)
    if (!playerAch) continue

    const result = checkSingleAchievement(def, progression, matchInput)
    const ref = doc(db, 'player_achievements', playerAch.id)

    if (result.unlock) {
      batch.update(ref, {
        unlocked: true,
        unlockedAt: serverTimestamp(),
        progress: { current: result.progress.target, target: result.progress.target },
      })
      unlocked.push({
        playerId,
        achievementId: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        rarity: def.rarity,
        xpReward: def.xpReward,
      })

      const notif = buildNotification('achievement_unlocked', {
        playerId,
        achievementName: def.name,
        xpReward: String(def.xpReward),
      })
      await sendNotification({
        userId: playerId,
        type: 'achievement_unlocked',
        title: notif.title,
        body: notif.body,
        link: notif.link,
        metadata: { achievementId: def.id, xpReward: String(def.xpReward) },
      })
    } else if (result.progress.target > 0) {
      batch.update(ref, {
        progress: { current: result.progress.current, target: result.progress.target },
      })
    }
  }

  await batch.commit()

  return unlocked
}

export async function getUnlockedCount(playerId: string): Promise<number> {
  const q = query(
    collection(db, 'player_achievements'),
    where('playerId', '==', playerId),
    where('unlocked', '==', true),
  )
  const snap = await getDocs(q)
  return snap.size
}

export async function getAchievementsByCategory(playerId: string): Promise<Record<AchievementCategory, { total: number; unlocked: number }>> {
  const all = await getPlayerAchievements(playerId)
  const cats: Record<string, PlayerAchievement[]> = {}
  for (const a of all) {
    const def = ACHIEVEMENT_MAP.get(a.achievementId)
    if (!def) continue
    if (!cats[def.category]) cats[def.category] = []
    cats[def.category].push(a)
  }
  const result = {} as Record<AchievementCategory, { total: number; unlocked: number }>
  for (const [cat, items] of Object.entries(cats)) {
    result[cat as AchievementCategory] = {
      total: items.length,
      unlocked: items.filter((i) => i.unlocked).length,
    }
  }
  return result
}
