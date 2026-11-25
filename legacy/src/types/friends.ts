import type { Timestamp } from 'firebase/firestore'

export interface FriendRequest {
  id: string
  from: string
  to: string
  fromName: string
  fromPhotoURL: string | null
  toName: string
  toPhotoURL: string | null
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Friendship {
  id: string
  userId1: string
  userId2: string
  friendId: string
  friendName: string
  friendPhotoURL: string | null
  createdAt: Timestamp
}

export interface UserPresence {
  userId: string
  status: 'online' | 'offline'
  lastSeen: Timestamp
}

export interface UserSearchResult {
  uid: string
  displayName: string
  photoURL: string | null
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends'
}

export interface FriendWithPresence {
  uid: string
  displayName: string
  photoURL: string | null
  online: boolean
  lastSeen: Timestamp | null
  friendSince: Timestamp
}
