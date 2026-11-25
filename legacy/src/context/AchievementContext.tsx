import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import type { UnlockNotification } from '@/types/achievements'

type QueueItem = UnlockNotification & { id: number }

type AchievementContextValue = {
  queue: QueueItem[]
  push: (n: UnlockNotification) => void
  dismiss: (id: number) => void
}

const AchievementContext = createContext<AchievementContextValue | null>(null)

export function AchievementProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const counter = useRef(0)

  const push = useCallback((n: UnlockNotification) => {
    const id = ++counter.current
    setQueue((prev) => [...prev, { ...n, id }])
    setTimeout(() => {
      setQueue((prev) => prev.filter((item) => item.id !== id))
    }, 4500)
  }, [])

  const dismiss = useCallback((id: number) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <AchievementContext.Provider value={{ queue, push, dismiss }}>
      {children}
    </AchievementContext.Provider>
  )
}

export function useAchievement() {
  const ctx = useContext(AchievementContext)
  if (!ctx) throw new Error('useAchievement must be used within AchievementProvider')
  return ctx
}
