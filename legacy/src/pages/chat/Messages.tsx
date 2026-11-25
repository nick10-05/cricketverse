import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { listenPrivateChats } from '@/lib/chat'
import type { ChatConversation } from '@/types/chat'

export function Messages() {
  const { user } = useAuth()
  if (!user) return null
  const [conversations, setConversations] = useState<ChatConversation[]>([])

  useEffect(() => {
    const unsub = listenPrivateChats(user.uid, setConversations)
    return unsub
  }, [user.uid])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Messages</h1>

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
          <p className="text-gray-400">No conversations yet</p>
          <p className="mt-1 text-sm text-gray-600">
            Start a chat from a friend's profile
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.chatId}
              to={`/messages/${conv.userId}`}
              className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4 transition-colors hover:border-gray-700"
            >
              <div className="relative shrink-0">
                {conv.photoURL ? (
                  <img src={conv.photoURL} alt={conv.displayName} className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-700" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 text-lg font-medium text-gray-300">
                    {conv.displayName.charAt(0)}
                  </div>
                )}
                {conv.unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
                    {conv.unread}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{conv.displayName}</span>
                  {conv.lastMessageAt && (
                    <span className="text-xs text-gray-600">
                      {conv.lastMessageAt?.toDate?.().toLocaleDateString() ?? ''}
                    </span>
                  )}
                </div>
                <p className={`truncate text-sm ${conv.unread > 0 ? 'font-medium text-gray-200' : 'text-gray-500'}`}>
                  {conv.lastMessage || 'No messages yet'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
