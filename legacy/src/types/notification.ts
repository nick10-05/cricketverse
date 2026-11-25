import type { Timestamp } from 'firebase/firestore'

export type NotificationType =
  | 'tournament_invite'
  | 'match_starting'
  | 'match_result'
  | 'friend_request'
  | 'friend_accepted'
  | 'achievement_unlocked'
  | 'auction_starting'
  | 'tournament_completed'
  | 'player_sold'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  link?: string
  senderId?: string
  senderName?: string
  senderPhotoURL?: string
  metadata?: Record<string, string>
  createdAt: Timestamp
}

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
  senderId?: string
  senderName?: string
  senderPhotoURL?: string
  metadata?: Record<string, string>
}
