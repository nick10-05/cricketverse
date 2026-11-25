import type { LevelInfo } from '@/types/progression'

type Props = {
  levelInfo: LevelInfo
  xpEarned?: number
}

export function LevelProgressBar({ levelInfo, xpEarned }: Props) {
  const percentage = Math.min(100, Math.round(levelInfo.progress * 100))
  const isMax = levelInfo.level >= 100

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-white">Level {levelInfo.level}</div>
          <div className="mt-1 text-sm text-gray-500">
            {isMax ? 'Maximum level reached' : `${levelInfo.currentXp.toLocaleString()} / ${levelInfo.xpForNext.toLocaleString()} XP`}
          </div>
        </div>
        {xpEarned !== undefined && xpEarned > 0 && (
          <div className="animate-pulse rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-400">
            +{xpEarned} XP
          </div>
        )}
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700"
          style={{ width: `${isMax ? 100 : percentage}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-gray-600">
        <span>Level 1</span>
        {!isMax && (
          <div className="flex gap-4">
            <span>Level {levelInfo.level}</span>
            <span>Level {Math.min(100, levelInfo.level + Math.max(1, Math.floor(percentage > 80 ? 5 : 1)))}</span>
          </div>
        )}
        <span>Level 100</span>
      </div>
    </div>
  )
}
