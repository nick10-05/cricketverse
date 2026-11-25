import { useNavigate } from 'react-router-dom'
import type { AppNotification } from '@/types/notification'

const TYPE_ICONS: Record<string, string> = {
  tournament_invite: '📋',
  match_starting: '🏏',
  match_result: '📊',
  friend_request: '👋',
  friend_accepted: '✅',
  achievement_unlocked: '🏆',
  auction_starting: '🔨',
  tournament_completed: '🏁',
  player_sold: '💰',
}

type Props = {
  notification: AppNotification
  onMarkRead: (id: string) => void
  compact?: boolean
}

export function NotificationItem({ notification: n, onMarkRead, compact }: Props) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (!n.read) onMarkRead(n.id)
    if (n.link) navigate(n.link)
  }

  const timeAgo = (ts: unknown): string => {
    if (!ts || typeof ts !== 'object' || !('toMillis' in (ts as object))) return ''
    const diff = Date.now() - (ts as { toMillis: () => number }).toMillis()
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return `${Math.floor(diff / 86400000)}d`
  }

  return (
    <button
      onClick={handleClick}
      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800/50 ${
        !n.read ? 'border-l-2 border-emerald-500 bg-emerald-500/5' : ''
      }`}
    >
      <span className="mt-0.5 text-lg">{TYPE_ICONS[n.type] ?? '🔔'}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${n.read ? 'text-gray-400' : 'font-medium text-white'}`}>{n.title}</div>
        <div className="text-xs text-gray-500">{n.body}</div>
        {!compact && n.senderName && (
          <div className="mt-1 text-xs text-gray-600">— {n.senderName}</div>
        )}
      </div>
      <span className="shrink-0 text-xs text-gray-600">{timeAgo(n.createdAt)}</span>
    </button>
  )
}
