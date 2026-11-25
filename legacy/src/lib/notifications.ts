import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AppNotification, CreateNotificationInput, NotificationType } from '@/types/notification'

/* ─── Send ─────────────────────────────────────────── */

export async function sendNotification(input: CreateNotificationInput): Promise<string> {
  const ref = await addDoc(collection(db, 'users', input.userId, 'notifications'), {
    ...input,
    read: false,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/* ─── Read / Mark ──────────────────────────────────── */

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), { read: true })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'users', userId, 'notifications'),
      where('read', '==', false),
    ),
  )
  const updates = snap.docs.map((d) => updateDoc(d.ref, { read: true }))
  await Promise.all(updates)
}

/* ─── Fetch History ────────────────────────────────── */

export async function getNotificationHistory(
  userId: string,
  max = 50,
): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))
}

/* ─── Real-time Listener ───────────────────────────── */

export function listenNotifications(
  userId: string,
  max: number,
  onData: (notifications: AppNotification[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(max),
  )
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))
      onData(list)
    },
    onError,
  )
}

/* ─── Notification Builder Helpers ─────────────────── */

export function buildNotification(
  type: NotificationType,
  params: Record<string, string>,
): { title: string; body: string; link?: string } {
  switch (type) {
    case 'tournament_invite':
      return {
        title: 'Tournament Invitation',
        body: `You've been invited to join "${params.tournamentName}"!`,
        link: `/tournaments/${params.tournamentId}`,
      }
    case 'match_starting':
      return {
        title: 'Match Starting Soon',
        body: `${params.teamA} vs ${params.teamB} is about to start!`,
        link: `/tournaments/${params.tournamentId}`,
      }
    case 'match_result':
      return {
        title: 'Match Result',
        body: `${params.winner} won by ${params.margin}!`,
        link: `/tournaments/${params.tournamentId}`,
      }
    case 'friend_request':
      return {
        title: 'Friend Request',
        body: `${params.senderName} sent you a friend request.`,
        link: '/friends',
      }
    case 'friend_accepted':
      return {
        title: 'Friend Request Accepted',
        body: `${params.senderName} accepted your friend request.`,
        link: '/friends',
      }
    case 'achievement_unlocked':
      return {
        title: 'Achievement Unlocked!',
        body: `"${params.achievementName}" — ${params.xpReward} XP earned!`,
        link: `/players/${params.playerId}/achievements`,
      }
    case 'auction_starting':
      return {
        title: 'Auction Starting',
        body: `Player auction for "${params.tournamentName}" is about to begin!`,
        link: `/tournaments/${params.tournamentId}/auction/room`,
      }
    case 'tournament_completed':
      return {
        title: 'Tournament Complete',
        body: `"${params.tournamentName}" has concluded. ${params.winner} wins!`,
        link: `/tournaments/${params.tournamentId}`,
      }
    case 'player_sold':
      return {
        title: 'Player Sold',
        body: `${params.playerName} sold to ${params.teamName} for ${params.price} credits!`,
        link: `/tournaments/${params.tournamentId}/auction/room`,
      }
    default:
      return { title: 'Notification', body: '' }
  }
}
