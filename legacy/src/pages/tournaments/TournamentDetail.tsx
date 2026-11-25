import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  getTournament,
  getTeams,
  getMatches,
  getPointsTable,
  startTournament,
  cancelTournament,
} from '@/lib/tournaments'
import { generateFixtures } from '@/lib/fixtures'
import { BracketView } from '@/components/tournament/BracketView'
import { PointsTable } from '@/components/tournament/PointsTable'
import type { Tournament, Team, Match, ScoreEntry } from '@/types/tournament'

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  if (!user) return null
  const navigate = useNavigate()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [pointsTable, setPointsTable] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'bracket' | 'points'>('overview')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [t, tm, m] = await Promise.all([
      getTournament(id),
      getTeams(id),
      getMatches(id),
    ])
    setTournament(t)
    setTeams(tm)
    setMatches(m)

    if (t && (t.format === 'league' || t.format === 'league_knockout')) {
      const pt = await getPointsTable(id)
      setPointsTable(pt)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const isCreator = tournament?.createdBy === user.uid
  const userTeam = teams.find((t) => t.ownerId === user.uid)
  const canStart = isCreator && tournament?.status === 'open' && teams.length >= 2 && !actionLoading

  const handleStart = async () => {
    if (!tournament) return
    setActionLoading('start')
    setError(null)
    try {
      await startTournament(tournament.id, user.uid)
      await generateFixtures(tournament.id, tournament.format, teams, tournament.knockoutQualifiers)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tournament')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!tournament) return
    setActionLoading('cancel')
    setError(null)
    try {
      await cancelTournament(tournament.id, user.uid)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel tournament')
    } finally {
      setActionLoading(null)
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
        <button
          onClick={() => navigate('/tournaments')}
          className="mt-4 cursor-pointer text-sm text-green-400 hover:underline"
        >
          Back to tournaments
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
            <span className="capitalize">{tournament.format === 'league_knockout' ? 'League + Knockout' : tournament.format}</span>
            <span>{tournament.overs} Overs</span>
            <span>{teams.length}/{tournament.maxTeams} Teams</span>
            {tournament.status === 'open' && (
              <span className="font-mono text-green-400">Room: {tournament.roomCode}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/tournaments/${id}/chat`}
            className="cursor-pointer rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            Chat
          </Link>
          {canStart && (
            <button
              onClick={handleStart}
              disabled={actionLoading !== null}
              className="cursor-pointer rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
            >
              {actionLoading === 'start' ? 'Starting...' : 'Start Tournament'}
            </button>
          )}
          {isCreator && tournament.status === 'open' && (
            <button
              onClick={handleCancel}
              disabled={actionLoading !== null}
              className="cursor-pointer rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Tournament'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {tournament.status === 'open' && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="text-sm text-green-400">
            Room code:{' '}
            <span className="font-mono font-bold tracking-wider">{tournament.roomCode}</span>
            {' — '}Share this code for others to join
          </p>
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-gray-900 p-1">
        {(['overview', ...(tournament.format !== 'knockout' ? ['points'] : []), 'bracket'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as 'overview' | 'bracket' | 'points')}
            className={`flex-1 cursor-pointer rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t === 'points' ? 'Points Table' : t === 'bracket' ? 'Bracket' : 'Overview'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab
          tournament={tournament}
          teams={teams}
          matches={matches}
          isCreator={isCreator}
          userTeam={userTeam}
        />
      )}

      {tab === 'points' && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Points Table</h2>
          <PointsTable entries={pointsTable} />
        </div>
      )}

      {tab === 'bracket' && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Bracket</h2>
          <BracketView matches={matches} teams={teams} />
        </div>
      )}
    </div>
  )
}

function OverviewTab({
  tournament,
  teams,
  matches,
  isCreator: _isCreator,
  userTeam,
}: {
  tournament: Tournament
  teams: Team[]
  matches: Match[]
  isCreator: boolean
  userTeam: Team | undefined
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Teams ({teams.length})</h2>
        {teams.length === 0 ? (
          <p className="text-sm text-gray-500">No teams have joined yet.</p>
        ) : (
          <ul className="space-y-2">
            {teams.map((t) => {
              const isUserTeam = t.ownerId === userTeam?.ownerId
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                    isUserTeam
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-gray-800 bg-gray-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{t.name}</span>
                    {isUserTeam && (
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
                        YOU
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{t.ownerName}</span>
                </li>
              )
            })}
          </ul>
        )}

        {!userTeam && tournament.status === 'open' && (
          <a
            href="/tournaments/join"
            className="mt-4 inline-block text-sm text-green-400 hover:underline"
          >
            + Join this tournament
          </a>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Matches ({matches.length})
        </h2>
                  {matches.length === 0 ? (
          <div className="text-sm text-gray-500">
            {tournament.status === 'open'
              ? 'Matches will be generated when the tournament starts.'
              : 'No matches found.'}
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <Link
                key={m.id}
                to={`/tournaments/${tournament.id}/matches/${m.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-2.5 transition-colors hover:border-gray-700"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className={m.winnerId === m.teamAId ? 'font-medium text-green-400' : 'text-gray-300'}>
                    {m.teamAName}
                  </span>
                  {m.teamAScore && (
                    <span className="font-mono text-xs text-gray-400">
                      {m.teamAScore.runs}/{m.teamAScore.wickets}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">vs</span>
                  {m.status === 'scheduled' && (
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                      PLAY
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {m.teamBScore && (
                    <span className="font-mono text-xs text-gray-400">
                      {m.teamBScore.runs}/{m.teamBScore.wickets}
                    </span>
                  )}
                  <span className={m.winnerId === m.teamBId ? 'font-medium text-green-400' : 'text-gray-300'}>
                    {m.teamBName}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
