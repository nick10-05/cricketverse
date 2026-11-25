import type { Match, Team } from '@/types/tournament'

type Props = {
  matches: Match[]
  teams: Team[]
}

export function BracketView({ matches, teams: _teams }: Props) {
  if (matches.length === 0) {
    return <p className="text-sm text-gray-500">No matches generated yet.</p>
  }

  const grouped = new Map<number, Match[]>()
  for (const m of matches) {
    const existing = grouped.get(m.round) ?? []
    existing.push(m)
    grouped.set(m.round, existing)
  }

  const rounds = [...grouped.entries()].sort((a, b) => a[0] - b[0])

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-8" style={{ minWidth: rounds.length * 220 }}>
        {rounds.map(([round, roundMatches]) => (
          <div key={round} className="flex flex-col justify-around gap-4">
            <div className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
              Round {round}
            </div>
            {roundMatches.map((match) => (
              <div
                key={match.id}
                className="w-48 rounded-lg border border-gray-700 bg-gray-800/50 p-3"
              >
                <MatchSlot
                  label={match.teamAName || 'TBD'}
                  score={match.teamAScore}
                  isWinner={match.winnerId === match.teamAId}
                />
                <div className="my-1.5 border-t border-gray-700" />
                <MatchSlot
                  label={match.teamBName || 'TBD'}
                  score={match.teamBScore}
                  isWinner={match.winnerId === match.teamBId}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchSlot({
  label,
  score,
  isWinner,
}: {
  label: string
  score: { runs: number; wickets: number } | null
  isWinner: boolean
}) {
  return (
    <div className={`flex items-center justify-between ${isWinner ? 'text-green-400' : 'text-gray-300'}`}>
      <span className="truncate text-sm font-medium">{label}</span>
      {score && (
        <span className="ml-2 shrink-0 text-xs font-mono tabular-nums">
          {score.runs}/{score.wickets}
        </span>
      )}
    </div>
  )
}
