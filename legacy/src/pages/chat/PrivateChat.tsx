import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { getOrCreatePrivateChat } from '@/lib/chat'
import { ChatWindow } from '@/components/chat/ChatWindow'

export function PrivateChat() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const [otherName, setOtherName] = useState('')
  const [chatId, setChatId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !user) return

    getDoc(doc(db, 'users', userId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as { displayName?: string }
        setOtherName(data.displayName ?? 'Unknown')
      }
    })

    getOrCreatePrivateChat(user.uid, userId).then(setChatId)
  }, [userId, user])

  if (!chatId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <Link
          to="/messages"
          className="cursor-pointer text-gray-500 transition-colors hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
      </div>

      <ChatWindow
        chatType="private"
        chatId={chatId}
        title={otherName}
        subtitle="Private conversation"
      />
    </div>
  )
}
