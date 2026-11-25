import type { PlayerProgression } from '@/types/progression'

type Props = {
  progression: PlayerProgression
}

type StatBox = {
  label: string
  value: string | number
  color: string
}

export function PlayerStatsOverview({ progression }: Props) {
  const stats: StatBox[] = [
    { label: 'Matches', value: progression.totalMatches, color: 'text-white' },
    { label: 'Runs', value: progression.totalRuns.toLocaleString(), color: 'text-blue-400' },
    { label: 'Wickets', value: progression.totalWickets, color: 'text-orange-400' },
    { label: 'Catches', value: progression.totalCatches, color: 'text-yellow-400' },
    { label: 'Fours', value: progression.totalFours, color: 'text-indigo-400' },
    { label: 'Sixes', value: progression.totalSixes, color: 'text-purple-400' },
    { label: 'Centuries', value: progression.centuries, color: 'text-green-400' },
    { label: '5-Fors', value: progression.fiveWicketHauls, color: 'text-red-400' },
    { label: 'MoM', value: progression.manOfMatchCount, color: 'text-amber-400' },
  ]

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <h3 className="mb-4 font-semibold text-white">Career Stats</h3>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-gray-800/40 p-3 text-center">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-500">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
