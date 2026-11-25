import type { PlayerMatchRecord } from '@/types/progression'

type Props = {
  records: PlayerMatchRecord[]
}

export function MatchHistoryCard({ records }: Props) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-3 font-semibold text-white">Match History</h3>
        <p className="text-sm text-gray-500">No matches played yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">Match History</h3>
        <span className="text-sm text-gray-500">{records.length} matches</span>
      </div>

      <div className="space-y-2">
        {records.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-gray-800/50 bg-gray-900/30 p-3 text-sm"
          >
            <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
              {r.runs > 0 && (
                <span className="font-medium text-white">
                  {r.runs}{r.ballsFaced > 0 ? `(${r.ballsFaced})` : ''}
                  {r.fours > 0 && <span className="text-blue-400"> {r.fours}x4</span>}
                  {r.sixes > 0 && <span className="text-purple-400"> {r.sixes}x6</span>}
                </span>
              )}
              {r.wickets > 0 && (
                <span className="font-medium text-orange-400">
                  {r.wickets}-{r.runsConceded}
                  {r.oversBowled > 0 && <span className="text-gray-500"> ({r.oversBowled}b)</span>}
                </span>
              )}
              {r.catches > 0 && (
                <span className="text-yellow-400">{r.catches} ct</span>
              )}
              {r.stumpings > 0 && (
                <span className="text-yellow-400">{r.stumpings} st</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              {r.isManOfMatch && (
                <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 font-medium text-yellow-400">MOM</span>
              )}
              {r.isWinner && (
                <span className="rounded bg-green-500/20 px-1.5 py-0.5 font-medium text-green-400">W</span>
              )}
              <span className="font-medium text-green-400">+{r.xpEarned} XP</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
