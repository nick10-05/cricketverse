import type { ScoreEntry } from '@/types/tournament'

type Props = {
  entries: ScoreEntry[]
}

export function PointsTable({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">No teams yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-500">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Team</th>
            <th className="py-2 px-2 text-center">P</th>
            <th className="py-2 px-2 text-center">W</th>
            <th className="py-2 px-2 text-center">L</th>
            <th className="py-2 px-2 text-center">T</th>
            <th className="py-2 px-2 text-center">Pts</th>
            <th className="py-2 pl-2 text-right">NRR</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr
              key={entry.teamId}
              className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
            >
              <td className="py-2.5 pr-2 font-mono text-xs text-gray-500">{i + 1}</td>
              <td className="py-2.5 pr-2 font-medium text-white">{entry.teamName}</td>
              <td className="py-2.5 px-2 text-center text-gray-400">{entry.played}</td>
              <td className="py-2.5 px-2 text-center text-green-400">{entry.won}</td>
              <td className="py-2.5 px-2 text-center text-red-400">{entry.lost}</td>
              <td className="py-2.5 px-2 text-center text-gray-400">{entry.tied}</td>
              <td className="py-2.5 px-2 text-center font-bold text-white">{entry.points}</td>
              <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-gray-400">
                {entry.nrr > 0 ? '+' : ''}{entry.nrr.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
