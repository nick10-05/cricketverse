import { useEffect, useState } from 'react'
import { RARITY_CONFIG, type AchievementRarity } from '@/types/achievements'
import { useAchievement } from '@/context/AchievementContext'

export function AchievementToast() {
  const { queue, dismiss } = useAchievement()

  if (queue.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2">
      {queue.map((item) => (
        <ToastItem
          key={item.id}
          id={item.id}
          icon={item.icon}
          name={item.name}
          description={item.description}
          rarity={item.rarity}
          xpReward={item.xpReward}
          onDismiss={dismiss}
        />
      ))}
    </div>
  )
}

type ToastItemProps = {
  id: number
  icon: string
  name: string
  description: string
  rarity: AchievementRarity
  xpReward: number
  onDismiss: (id: number) => void
}

function ToastItem({ id, icon, name, description, rarity, xpReward, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false)
  const config = RARITY_CONFIG[rarity]

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div
      onClick={() => onDismiss(id)}
      className={`pointer-events-auto w-full max-w-sm cursor-pointer rounded-xl border bg-gray-900 px-4 py-3 shadow-2xl backdrop-blur-sm transition-all duration-500 ${
        config.border
      } ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl ${config.bg}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-white">{name}</span>
            <span className={`shrink-0 text-[10px] font-medium uppercase ${config.text}`}>
              {config.label}
            </span>
          </div>
          <p className="truncate text-xs text-gray-400">{description}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold text-green-400">+{xpReward}</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-600">XP</div>
        </div>
      </div>
    </div>
  )
}
