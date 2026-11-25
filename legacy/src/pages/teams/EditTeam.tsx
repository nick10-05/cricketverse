import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getTournament } from '@/lib/tournaments'
import {
  getMyTeam,
  updateTeam,
  deleteTeam,
  uploadTeamLogo,
  removeTeamLogo,
} from '@/lib/teams'
import { TeamForm } from '@/components/team/TeamForm'
import type { Tournament, Team, UpdateTeamInput } from '@/types/tournament'

export function EditTeam() {
  const { id: tournamentId } = useParams<{ id: string }>()
  const { user } = useAuth()
  if (!user) return null
  const navigate = useNavigate()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tournamentId) return

    const load = async () => {
      setLoading(true)
      const t = await getTournament(tournamentId)
      setTournament(t)
      if (t) {
        const myTeamData = await getMyTeam(tournamentId, user.uid)
        setTeam(myTeamData)
      }
      setLoading(false)
    }
    load()
  }, [tournamentId, user.uid])

  const handleSubmit = async (input: UpdateTeamInput) => {
    if (!tournamentId || !team) return
    setSaving(true)
    try {
      await updateTeam(tournamentId, team.id, user.uid, input)
      const updated = await getMyTeam(tournamentId, user.uid)
      if (updated) setTeam(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    if (!tournamentId || !team) return
    setSaving(true)
    try {
      const url = await uploadTeamLogo(tournamentId, team.id, file)
      await updateTeam(tournamentId, team.id, user.uid, { logoURL: url })
      const updated = await getMyTeam(tournamentId, user.uid)
      if (updated) setTeam(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoRemove = async () => {
    if (!tournamentId || !team || !team.logoURL) return
    setSaving(true)
    try {
      await removeTeamLogo(tournamentId, team.id, team.logoURL)
      const updated = await getMyTeam(tournamentId, user.uid)
      if (updated) setTeam(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tournamentId || !team) return
    setSaving(true)
    try {
      await deleteTeam(tournamentId, team.id, user.uid)
      navigate(`/tournaments/${tournamentId}`)
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

  if (!tournament) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
        <p className="text-gray-400">Tournament not found</p>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
        <p className="text-gray-400">You don't have a team in this tournament</p>
        <Link
          to={`/tournaments/${tournamentId}`}
          className="mt-4 inline-block text-sm text-green-400 hover:underline"
        >
          Back to tournament
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Link
          to={`/tournaments/${tournamentId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to {tournament.name}
        </Link>
        <h1 className="text-2xl font-bold text-white">Edit Team</h1>
        <p className="mt-1 text-sm text-gray-400">{team.name}</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <TeamForm
          team={team}
          onSubmit={handleSubmit}
          onLogoUpload={handleLogoUpload}
          onLogoRemove={handleLogoRemove}
          onDelete={tournament.status === 'open' || tournament.status === 'draft' ? handleDelete : undefined}
          loading={saving}
        />
      </div>
    </div>
  )
}
