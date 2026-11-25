import { useState, type FormEvent } from 'react'
import type { TournamentFormat, CreateTournamentInput } from '@/types/tournament'

type Props = {
  onSubmit: (input: CreateTournamentInput) => Promise<void>
  loading: boolean
}

const oversOptions = [5, 10, 15, 20]

const formatInfo: Record<TournamentFormat, string> = {
  league: 'Every team plays each other. Winner determined by points.',
  knockout: 'Single-elimination bracket. Lose and you are out.',
  league_knockout: 'Round-robin stage, then top teams advance to knockout.',
}

export function CreateTournamentForm({ onSubmit, loading }: Props) {
  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('league')
  const [overs, setOvers] = useState(10)
  const [maxTeams, setMaxTeams] = useState(8)
  const [qualifiers, setQualifiers] = useState(4)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && !loading

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!canSubmit) return
    try {
      await onSubmit({
        name: name.trim(),
        format,
        overs,
        maxTeams,
        knockoutQualifiers: format === 'league_knockout' ? qualifiers : undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-300">
          Tournament Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Gully Cricket Cup"
          maxLength={100}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white placeholder-gray-500 outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Format</label>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['league', 'knockout', 'league_knockout'] as TournamentFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFormat(f)
                if (f !== 'league_knockout') setQualifiers(4)
              }}
              className={`cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors ${
                format === f
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="text-sm font-medium text-white capitalize">
                {f === 'league_knockout' ? 'League + Knockout' : f}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">{formatInfo[f]}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Overs per Side</label>
        <div className="flex flex-wrap gap-2">
          {oversOptions.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOvers(o)}
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                overs === o
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
              }`}
            >
              {o} Overs
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Max Teams</label>
        <div className="flex flex-wrap gap-2">
          {[4, 8, 16, 32].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMaxTeams(n)}
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                maxTeams === n
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
              }`}
            >
              {n} Teams
            </button>
          ))}
        </div>
      </div>

      {format === 'league_knockout' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-300">
            Teams Advancing to Knockout
          </label>
          <div className="flex flex-wrap gap-2">
            {[2, 4].filter((n) => n <= maxTeams / 2).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQualifiers(n)}
                className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  qualifiers === n
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full cursor-pointer rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Tournament'}
      </button>
    </form>
  )
}
