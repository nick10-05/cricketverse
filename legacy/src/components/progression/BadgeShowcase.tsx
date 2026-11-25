import { useState } from 'react'
import type { Badge } from '@/types/progression'
import { BADGE_DEFINITIONS } from '@/types/progression'
import type { BadgeType } from '@/types/progression'

type Props = {
  badges: Badge[]
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'level', label: 'Level' },
  { key: 'performance', label: 'Performance' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'special', label: 'Special' },
]

export function BadgeShowcase({ badges }: Props) {
  const [filter, setFilter] = useState('all')
  const earnedTypes = new Set(badges.map((b) => b.type))
  const allTypes = Object.entries(BADGE_DEFINITIONS) as [BadgeType, typeof BADGE_DEFINITIONS[BadgeType]][]

  const filtered = filter === 'all'
    ? allTypes
    : allTypes.filter(([, def]) => def.category === filter)

  if (badges.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-3 font-semibold text-white">Badges</h3>
        <p className="text-sm text-gray-500">Play matches to earn badges and achievements.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">Badges</h3>
        <span className="text-sm text-gray-500">{badges.length} / {allTypes.length}</span>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === cat.key
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {filtered.map(([type, def]) => {
          const earned = earnedTypes.has(type)
          return (
            <div
              key={type}
              title={`${def.name}: ${def.description}`}
              className={`flex flex-col items-center rounded-lg p-3 text-center transition-colors ${
                earned
                  ? 'bg-green-500/10'
                  : 'bg-gray-800/30 opacity-40'
              }`}
            >
              <span className="text-2xl">{def.icon}</span>
              <span className="mt-1 text-[10px] font-medium leading-tight text-white">
                {def.name}
              </span>
              {!earned && (
                <span className="mt-1 text-[9px] text-gray-600">Locked</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
