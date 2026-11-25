import { useNotifications } from '@/context/NotificationContext'
import { NotificationItem } from '@/components/notifications/NotificationItem'

export function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="mt-1 text-sm text-gray-400">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50">
        {notifications.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">
            No notifications yet. They will appear here when you receive friend requests, match results, and more.
          </p>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onMarkRead={markAsRead} />
          ))
        )}
      </div>
    </div>
  )
}
