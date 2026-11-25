import type { Timestamp } from 'firebase/firestore'

export type ChatType = 'tournament' | 'team' | 'private'

export interface ChatMessage {
  id: string
  chatType: ChatType
  chatId: string
  senderId: string
  senderName: string
  senderPhotoURL: string | null
  text: string
  createdAt: Timestamp
  readBy: string[]
}

export interface PrivateChat {
  id: string
  participants: string[]
  lastMessage: {
    text: string
    senderId: string
    senderName: string
    createdAt: Timestamp
  } | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ChatConversation {
  chatId: string
  userId: string
  displayName: string
  photoURL: string | null
  lastMessage: string
  lastMessageAt: Timestamp | null
  unread: number
}
