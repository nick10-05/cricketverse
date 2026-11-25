import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getUserPlayers } from '@/lib/players'
import { PlayerCard } from '@/components/player/PlayerCard'
import type { Player } from '@/types/player'

export function PlayerList() {
  const { user } = useAuth()
  if (!user) return null
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getUserPlayers(user.uid).then((data) => {
      if (!cancelled) {
        setPlayers(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [user.uid])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Players</h1>
          <p className="mt-1 text-sm text-gray-400">
            {players.length} player{players.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/players/new"
          className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
        >
          + New Player
        </Link>
      </div>

      {players.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <p className="text-gray-400">No players yet</p>
          <p className="mt-1 text-sm text-gray-600">
            Create custom players with skill ratings
          </p>
          <Link
            to="/players/new"
            className="mt-4 inline-block cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
          >
            Create Player
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <PlayerCard key={p.id} player={p} />
          ))}
        </div>
      )}
    </div>
  )
}
