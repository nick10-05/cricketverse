import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { joinTournament } from '@/lib/tournaments'
import { JoinTournamentForm } from '@/components/tournament/JoinTournamentForm'

export function JoinTournament() {
  const { user } = useAuth()
  if (!user) return null
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleJoin = async (roomCode: string, teamName: string) => {
    setLoading(true)
    try {
      const tournamentId = await joinTournament(roomCode, teamName, user.uid, user.displayName ?? 'Unknown')
      navigate(`/tournaments/${tournamentId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Join Tournament</h1>
        <p className="mt-1 text-sm text-gray-400">
          Enter the room code shared by the tournament host
        </p>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <JoinTournamentForm onSubmit={handleJoin} loading={loading} />
      </div>
    </div>
  )
}
