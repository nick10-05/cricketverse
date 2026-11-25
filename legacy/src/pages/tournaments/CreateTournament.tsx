import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { createTournament, getTournament } from '@/lib/tournaments'
import { CreateTournamentForm } from '@/components/tournament/CreateTournamentForm'
import type { CreateTournamentInput } from '@/types/tournament'

export function CreateTournament() {
  const { user } = useAuth()
  if (!user) return null
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const handleCreate = async (input: CreateTournamentInput) => {
    setLoading(true)
    try {
      const id = await createTournament(input, user.uid, user.displayName ?? 'Unknown')
      setCreatedId(id)
      const t = await getTournament(id)
      setCreatedCode(t?.roomCode ?? null)
    } finally {
      setLoading(false)
    }
  }

  if (createdId) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
            <svg className="h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">Tournament Created!</h2>
          <p className="mb-6 text-sm text-gray-400">
            Share this code with other players to join:
          </p>
          <div className="mx-auto mb-6 max-w-xs rounded-xl border border-gray-700 bg-gray-800/50 px-6 py-4">
            <div className="text-3xl font-bold tracking-[0.3em] text-green-400">
              {createdCode}
            </div>
          </div>
          <p className="mb-6 text-xs text-gray-500">
            Players enter this code to join your tournament
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigator.clipboard.writeText(createdCode ?? '')}
              className="flex-1 cursor-pointer rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Copy Code
            </button>
            <button
              onClick={() => navigate(`/tournaments/${createdId}`)}
              className="flex-1 cursor-pointer rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500"
            >
              Go to Tournament
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create Tournament</h1>
        <p className="mt-1 text-sm text-gray-400">Set up a new cricket tournament</p>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <CreateTournamentForm onSubmit={handleCreate} loading={loading} />
      </div>
    </div>
  )
}
