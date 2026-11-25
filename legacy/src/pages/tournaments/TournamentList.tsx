import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getUserTournaments, cancelTournament } from '@/lib/tournaments'
import { TournamentCard } from '@/components/tournament/TournamentCard'
import type { Tournament } from '@/types/tournament'

export function TournamentList() {
  const { user } = useAuth()
  if (!user) return null
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getUserTournaments(user.uid).then((data) => {
      if (!cancelled) {
        setTournaments(data.filter((t) => t.status !== 'cancelled'))
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [user.uid])

  const handleCancel = async (id: string) => {
    setCancelling(id)
    try {
      await cancelTournament(id, user.uid)
      setTournaments((prev) => prev.filter((t) => t.id !== id))
    } catch {
      // ignore
    } finally {
      setCancelling(null)
    }
  }

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
          <h1 className="text-2xl font-bold text-white">My Tournaments</h1>
          <p className="mt-1 text-sm text-gray-400">
            {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/tournaments/new"
          className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
        >
          + New
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 0 1-2.77.896m0 0a6 6 0 0 1-3.128-.94" />
          </svg>
          <p className="text-gray-400">No tournaments yet</p>
          <p className="mt-1 text-sm text-gray-600">
            Create or join a tournament to get started
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              to="/tournaments/new"
              className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
            >
              Create Tournament
            </Link>
            <Link
              to="/tournaments/join"
              className="cursor-pointer rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800"
            >
              Join with Code
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} onCancel={t.status !== 'cancelled' && t.status !== 'completed' ? handleCancel : undefined} cancelling={cancelling === t.id} />
          ))}
        </div>
      )}
    </div>
  )
}
