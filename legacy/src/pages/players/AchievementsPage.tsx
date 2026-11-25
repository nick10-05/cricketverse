import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Player } from '@/types/player'
import { ROLE_LABELS } from '@/types/player'
import {
  getPlayerAchievements,
  getAchievementsByCategory,
  initPlayerAchievements,
} from '@/lib/achievements'
import { getPlayerProgression } from '@/lib/progression'
import type { PlayerAchievement } from '@/types/achievements'
import type { AchievementCategory } from '@/types/achievements'
import type { PlayerProgression } from '@/types/progression'
import { TrophyCabinet } from '@/components/achievements/TrophyCabinet'

export function AchievementsPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const id = rawId ?? ''
  const [player, setPlayer] = useState<Player | null>(null)
  const [_progression, setProgression] = useState<PlayerProgression | null>(null)
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([])
  const [categoryStats, setCategoryStats] = useState<Record<AchievementCategory, { total: number; unlocked: number }> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      await initPlayerAchievements(id)

      const [playerSnap, prog, achs, cats] = await Promise.all([
        getDoc(doc(db, 'players', id)),
        getPlayerProgression(id),
        getPlayerAchievements(id),
        getAchievementsByCategory(id),
      ])

      if (cancelled) return

      const p = playerSnap.exists() ? ({ id: playerSnap.id, ...playerSnap.data() } as Player) : null
      setPlayer(p)
      setProgression(prog)
      setAchievements(achs)
      setCategoryStats(cats)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [id])

  if (loading || !player) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    )
  }

  const roleColors: Record<string, string> = {
    batsman: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    bowler: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    all_rounder: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    wicket_keeper: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/players/${id}/progression`}
            className="cursor-pointer text-gray-500 transition-colors hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{player.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                  roleColors[player.role] ?? 'text-gray-400'
                }`}
              >
                {ROLE_LABELS[player.role]}
              </span>
              <span className="text-sm text-gray-500">Achievements</span>
            </div>
          </div>
        </div>
        <Link
          to={`/players/${id}/progression`}
          className="cursor-pointer rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
        >
          Progression
        </Link>
      </div>

      {categoryStats && (
        <div className="mb-6 grid grid-cols-5 gap-2">
          {(Object.entries(categoryStats) as [AchievementCategory, { total: number; unlocked: number }][]).map(
            ([cat, stats]) => (
              <div key={cat} className="rounded-lg bg-gray-800/40 p-2 text-center">
                <div className="text-lg font-bold text-white">{stats.unlocked}/{stats.total}</div>
                <div className="text-[9px] capitalize tracking-wider text-gray-500">{cat}</div>
              </div>
            ),
          )}
        </div>
      )}

      <TrophyCabinet achievements={achievements} />
    </div>
  )
}
