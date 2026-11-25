import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Player } from '@/types/player'
import { ROLE_LABELS } from '@/types/player'
import {
  getPlayerProgression,
  getPlayerMatchHistory,
  getPlayerBadges,
  calculateLevel,
} from '@/lib/progression'
import type { PlayerProgression, PlayerMatchRecord, Badge, LevelInfo } from '@/types/progression'
import { LevelProgressBar } from '@/components/progression/LevelProgressBar'
import { PlayerStatsOverview } from '@/components/progression/PlayerStatsOverview'
import { BadgeShowcase } from '@/components/progression/BadgeShowcase'
import { MatchHistoryCard } from '@/components/progression/MatchHistoryCard'

export function PlayerProgressionPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const id = rawId ?? ''
  const [player, setPlayer] = useState<Player | null>(null)
  const [progression, setProgression] = useState<PlayerProgression | null>(null)
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [history, setHistory] = useState<PlayerMatchRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      const [playerSnap, prog, badgesData, historyData] = await Promise.all([
        getDoc(doc(db, 'players', id)),
        getPlayerProgression(id),
        getPlayerBadges(id),
        getPlayerMatchHistory(id),
      ])

      if (cancelled) return

      const p = playerSnap.exists() ? ({ id: playerSnap.id, ...playerSnap.data() } as Player) : null
      setPlayer(p)
      setProgression(prog)
      if (prog) setLevelInfo(calculateLevel(prog.xp))
      setBadges(badgesData)
      setHistory(historyData)
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
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/players"
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
              {progression && (
                <span className="text-sm text-gray-500">
                  {progression.totalMatches} matches played
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/players/${id}/achievements`}
            className="cursor-pointer rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
          >
            Achievements
          </Link>
          <Link
            to={`/players/${id}/edit`}
            className="cursor-pointer rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            Edit Player
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {levelInfo && (
          <LevelProgressBar levelInfo={levelInfo} />
        )}

        {!progression && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-10 text-center">
            <p className="text-gray-400">No progression data yet.</p>
            <p className="mt-1 text-sm text-gray-600">Play matches with this player to start earning XP.</p>
          </div>
        )}

        {progression && (
          <>
            <PlayerStatsOverview progression={progression} />
            <BadgeShowcase badges={badges} />
            <MatchHistoryCard records={history} />
          </>
        )}
      </div>
    </div>
  )
}
