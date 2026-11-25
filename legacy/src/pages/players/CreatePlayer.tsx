import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { createPlayer } from '@/lib/players'
import { PlayerForm } from '@/components/player/PlayerForm'
import type { CreatePlayerInput } from '@/types/player'

export function CreatePlayer() {
  const { user } = useAuth()
  if (!user) return null
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleCreate = async (input: CreatePlayerInput) => {
    setLoading(true)
    try {
      const id = await createPlayer(input, user.uid)
      navigate(`/players/${id}/edit`)
    } catch (err) {
      throw err
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create Player</h1>
        <p className="mt-1 text-sm text-gray-400">
          Define a custom player with skill ratings
        </p>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <PlayerForm onSubmit={handleCreate} loading={loading} />
      </div>
    </div>
  )
}
