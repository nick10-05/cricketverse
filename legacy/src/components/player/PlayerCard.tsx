import { Link } from 'react-router-dom'
import type { Player } from '@/types/player'
import { ROLE_LABELS, ALL_SKILLS } from '@/types/player'

type Props = {
  player: Player
}

export function PlayerCard({ player }: Props) {
  const totalPoints = ALL_SKILLS.reduce((sum, s) => sum + player.skills[s], 0)
  const avg = Math.round(totalPoints / ALL_SKILLS.length)
  const topSkill = ALL_SKILLS.reduce((best, s) =>
    player.skills[s] > player.skills[best] ? s : best,
  )

  const roleColors: Record<string, string> = {
    batsman: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    bowler: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    all_rounder: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    wicket_keeper: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  }

  return (
    <Link
      to={`/players/${player.id}/edit`}
      className="block rounded-xl border border-gray-800 bg-gray-900/50 p-5 transition-colors hover:border-gray-700"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-white">{player.name}</h3>
          <span
            className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
              roleColors[player.role] ?? 'text-gray-400'
            }`}
          >
            {ROLE_LABELS[player.role]}
          </span>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{avg}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-600">Overall</div>
        </div>
      </div>

      <div className="flex items-end justify-between text-xs text-gray-500">
        <span className="capitalize">
          Best: <span className="font-medium text-gray-300">{topSkill}</span> ({player.skills[topSkill]})
        </span>
        <Link
          to={`/players/${player.id}/progression`}
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer rounded bg-green-600/20 px-2 py-0.5 font-medium text-green-400 transition-colors hover:bg-green-600/30"
        >
          Progress
        </Link>
      </div>
    </Link>
  )
}
