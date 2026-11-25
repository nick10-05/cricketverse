import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { listenMessages, sendMessage, markAsRead } from '@/lib/chat'
import type { ChatMessage, ChatType } from '@/types/chat'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from './ChatInput'

type Props = {
  chatType: ChatType
  chatId: string
  title: string
  subtitle?: string
}

export function ChatWindow({ chatType, chatId, title, subtitle }: Props) {
  const { user } = useAuth()
  if (!user) return null
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setMessages([])
    const unsub = listenMessages(chatType, chatId, 200, (msgs) => {
      setMessages(msgs)
      setLoading(false)

      // Mark new messages as read
      const unread = msgs.filter(
        (m) => m.senderId !== user.uid && !m.readBy.includes(user.uid),
      )
      unread.forEach((m) => markAsRead(chatType, chatId, m.id, user.uid))
    })
    return unsub
  }, [chatType, chatId, user.uid])

  const handleSend = async (text: string) => {
    await sendMessage(
      chatType,
      chatId,
      { uid: user.uid, displayName: user.displayName ?? 'Unknown', photoURL: user.photoURL },
      text,
    )
  }

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50">
      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3">
        <h3 className="font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      {/* Messages */}
      <ChatMessageList messages={messages} loading={loading} />

      {/* Input */}
      <ChatInput onSend={handleSend} />
    </div>
  )
}
