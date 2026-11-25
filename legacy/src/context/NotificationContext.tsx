import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { listenNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notifications'
import type { AppNotification } from '@/types/notification'

type NotificationContextValue = {
  notifications: AppNotification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  loading: boolean
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = listenNotifications(
      user.uid,
      50,
      (list) => {
        setNotifications(list)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [status, user?.uid])

  const markAsRead = useCallback(
    async (id: string) => {
      if (status !== 'authenticated' || !user) return
      await markNotificationRead(user.uid, id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    },
    [status, user?.uid],
  )

  const markAllAsReadCallback = useCallback(async () => {
    if (status !== 'authenticated' || !user) return
    await markAllNotificationsRead(user.uid)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [status, user?.uid])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead: markAllAsReadCallback, loading }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
