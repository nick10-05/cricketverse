import { useState } from 'react'
import type { PlayerAchievement } from '@/types/achievements'
import type { AchievementCategory } from '@/types/achievements'
import { ACHIEVEMENTS, RARITY_CONFIG } from '@/types/achievements'

type Props = {
  achievements: PlayerAchievement[]
}

const CATEGORIES: { key: 'all' | AchievementCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'batting', label: 'Batting' },
  { key: 'bowling', label: 'Bowling' },
  { key: 'fielding', label: 'Fielding' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'special', label: 'Special' },
]

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common']
const SORT_OPTIONS = [
  { key: 'rarity', label: 'Rarity' },
  { key: 'recent', label: 'Recent' },
  { key: 'name', label: 'Name' },
]

export function TrophyCabinet({ achievements }: Props) {
  const [filterCat, setFilterCat] = useState<'all' | AchievementCategory>('all')
  const [sort, setSort] = useState('rarity')
  const [showLocked, setShowLocked] = useState(true)

  const unlockedMap = new Map(achievements.filter((a) => a.unlocked).map((a) => [a.achievementId, a]))
  const unlockedCount = unlockedMap.size

  let filtered = ACHIEVEMENTS.filter((def) => {
    if (filterCat !== 'all' && def.category !== filterCat) return false
    if (!showLocked && !unlockedMap.has(def.id)) return false
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    if (sort === 'rarity') {
      const ra = RARITY_ORDER.indexOf(a.rarity)
      const rb = RARITY_ORDER.indexOf(b.rarity)
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name)
    }
    if (sort === 'name') return a.name.localeCompare(b.name)
    const ua = unlockedMap.get(a.id)
    const ub = unlockedMap.get(b.id)
    if (ua && ub) {
      const ta = ua.unlockedAt ? (ua.unlockedAt as any)?.seconds || 0 : 0
      const tb = ub.unlockedAt ? (ub.unlockedAt as any)?.seconds || 0 : 0
      return tb - ta
    }
    if (ua) return -1
    if (ub) return 1
    return 0
  })

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Trophy Cabinet</h3>
          <p className="text-sm text-gray-500">
            {unlockedCount} / {ACHIEVEMENTS.length} unlocked
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilterCat(cat.key)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterCat === cat.key
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="cursor-pointer rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={showLocked}
              onChange={(e) => setShowLocked(e.target.checked)}
              className="cursor-pointer accent-green-500"
            />
            Locked
          </label>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((def) => {
          const pa = unlockedMap.get(def.id)
          const unlocked = !!pa
          const config = RARITY_CONFIG[def.rarity]
          const progress = pa?.progress

          return (
            <div
              key={def.id}
              className={`relative rounded-xl border p-4 transition-all ${
                unlocked
                  ? `${config.border} ${config.glow} ${config.bg}`
                  : 'border-gray-800 bg-gray-900/30 opacity-60'
              }`}
            >
              {/* Rarity tag */}
              <span className={`absolute right-2 top-2 text-[8px] font-semibold uppercase ${config.text}`}>
                {def.rarity}
              </span>

              {/* Icon */}
              <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-xl ${
                unlocked ? config.bg : 'bg-gray-800/50'
              }`}>
                {def.icon}
              </div>

              {/* Name */}
              <h4 className={`text-sm font-semibold ${unlocked ? 'text-white' : 'text-gray-500'}`}>
                {def.name}
              </h4>
              <p className="mt-0.5 text-[11px] leading-tight text-gray-500">
                {def.description}
              </p>

              {/* Progress bar (locked with progress) */}
              {!unlocked && progress && progress.target > 1 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] text-gray-600">
                    <span>{progress.current}</span>
                    <span>{progress.target}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-gray-600 transition-all duration-500"
                      style={{ width: `${Math.min(100, (progress.current / progress.target) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* XP reward */}
              {unlocked && (
                <div className="mt-2 text-[10px] font-medium text-green-500">
                  +{def.xpReward} XP
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">No achievements match filters</p>
      )}
    </div>
  )
}
