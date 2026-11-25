import type { ChatMessage } from '@/types/chat'
import { useAuth } from '@/context/AuthContext'

type Props = {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: Props) {
  const { user } = useAuth()
  if (!user) return null
  const isMine = message.senderId === user.uid
  const hasRead = message.readBy.length > 1
  const time = message.createdAt?.toDate?.()
    ? message.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isMine
            ? 'rounded-br-sm bg-green-600 text-white'
            : 'rounded-bl-sm bg-gray-800 text-gray-200'
        }`}
      >
        {!isMine && (
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-xs font-medium text-green-400">{message.senderName}</span>
          </div>
        )}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
        <div className={`mt-1 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-white/50">{time}</span>
          {isMine && (
            <span className={`text-[10px] ${hasRead ? 'text-blue-300' : 'text-white/40'}`}>
              {hasRead ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
