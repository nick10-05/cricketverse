import { Link } from 'react-router-dom'
import type { Tournament } from '@/types/tournament'

type Props = {
  tournament: Tournament
  onCancel?: (id: string) => void
  cancelling?: boolean
}

const statusColors: Record<string, string> = {
  open: 'text-green-400 bg-green-500/10',
  in_progress: 'text-blue-400 bg-blue-500/10',
  completed: 'text-gray-400 bg-gray-500/10',
  cancelled: 'text-red-400 bg-red-500/10',
  draft: 'text-yellow-400 bg-yellow-500/10',
}

const formatLabels: Record<string, string> = {
  league: 'League',
  knockout: 'Knockout',
  league_knockout: 'League + KO',
}

export function TournamentCard({ tournament, onCancel, cancelling }: Props) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 transition-colors hover:border-gray-700">
      <Link to={`/tournaments/${tournament.id}`} className="block">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="font-semibold text-white">{tournament.name}</h3>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                statusColors[tournament.status] ?? 'text-gray-400'
              }`}
            >
              {tournament.status === 'in_progress' ? 'In Progress' : tournament.status}
            </span>
            {tournament.status !== 'cancelled' && tournament.status !== 'completed' && onCancel && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(tournament.id) }}
                disabled={cancelling}
                className="cursor-pointer rounded-md border border-red-700 px-2 py-0.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                title="Cancel tournament"
              >
                {cancelling ? '...' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
            {formatLabels[tournament.format] ?? tournament.format}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
            {tournament.overs} Overs
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
            {tournament.teamCount}/{tournament.maxTeams} Teams
          </span>
          {tournament.status === 'open' && (
            <span className="inline-flex items-center gap-1 font-mono text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {tournament.roomCode}
            </span>
          )}
        </div>
      </Link>

      <div className="flex gap-2">
        <Link
          to={`/tournaments/${tournament.id}`}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-600"
        >
          View
        </Link>
        {tournament.status === 'open' && onCancel && (
          <button
            onClick={() => onCancel(tournament.id)}
            disabled={cancelling}
            className="cursor-pointer rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            {cancelling ? '...' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}
