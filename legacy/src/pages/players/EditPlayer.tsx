import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getPlayer, updatePlayer, deletePlayer } from '@/lib/players'
import { PlayerForm } from '@/components/player/PlayerForm'
import type { CreatePlayerInput, Player } from '@/types/player'

export function EditPlayer() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  if (!user) return null
  const navigate = useNavigate()

  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPlayer(id).then((p) => {
      if (p && p.createdBy !== user.uid) p = null
      setPlayer(p)
      setLoading(false)
    })
  }, [id, user.uid])

  const handleUpdate = async (input: CreatePlayerInput) => {
    if (!id) return
    setSaving(true)
    try {
      await updatePlayer(id, input, user.uid)
      const updated = await getPlayer(id)
      if (updated) setPlayer(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setSaving(true)
    try {
      await deletePlayer(id, user.uid)
      navigate('/players')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    )
  }

  if (!player) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
        <p className="text-gray-400">Player not found</p>
        <Link
          to="/players"
          className="mt-4 inline-block text-sm text-green-400 hover:underline"
        >
          Back to players
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Link
          to="/players"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to players
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Player</h1>
            <p className="mt-1 text-sm text-gray-400">{player.name}</p>
          </div>
          <Link
            to={`/players/${id}/progression`}
            className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
          >
            View Progress
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <PlayerForm
          initial={{ name: player.name, role: player.role, skills: player.skills }}
          onSubmit={handleUpdate}
          loading={saving}
        />

        <div className="mt-8 border-t border-gray-800 pt-6">
          <button
            type="button"
            onClick={handleDelete}
            className="w-full cursor-pointer rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            {deleteConfirm ? 'Confirm Delete' : 'Delete Player'}
          </button>
          {deleteConfirm && (
            <p className="mt-2 text-center text-xs text-gray-500">
              Click again to permanently delete. This cannot be undone.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
