import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  or,
  and,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FriendRequest, UserPresence, UserSearchResult, FriendWithPresence } from '@/types/friends'
import { sendNotification, buildNotification } from '@/lib/notifications'

const USER_LOOKUP_CACHE = new Map<string, { displayName: string; photoURL: string | null }>()

/* ─── User Lookup ──────────────────────────────── */

async function lookupUser(uid: string): Promise<{ displayName: string; photoURL: string | null } | null> {
  if (USER_LOOKUP_CACHE.has(uid)) return USER_LOOKUP_CACHE.get(uid)!
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data() as { displayName?: string; photoURL?: string | null }
  const result = { displayName: data.displayName ?? 'Unknown', photoURL: data.photoURL ?? null }
  USER_LOOKUP_CACHE.set(uid, result)
  return result
}

/* ─── Search Users ─────────────────────────────── */

export async function searchUsers(queryText: string, currentUid: string): Promise<UserSearchResult[]> {
  const qLower = queryText.toLowerCase()
  const snap = await getDocs(collection(db, 'users'))

  const filtered = snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as { uid: string; displayName?: string; photoURL?: string | null }))
    .filter((u) => u.uid !== currentUid && u.displayName?.toLowerCase().includes(qLower))
    .slice(0, 20)

  const outgoingQ = query(
    collection(db, 'friend_requests'),
    where('from', '==', currentUid),
    where('status', '==', 'pending'),
  )
  const incomingQ = query(
    collection(db, 'friend_requests'),
    where('to', '==', currentUid),
    where('status', '==', 'pending'),
  )
  const friendsQ = query(
    collection(db, 'friendships'),
    or(
      where('userId1', '==', currentUid),
      where('userId2', '==', currentUid),
    ),
  )

  const [outgoingSnap, incomingSnap, friendsSnap] = await Promise.all([
    getDocs(outgoingQ),
    getDocs(incomingQ),
    getDocs(friendsQ),
  ])

  const outgoingSet = new Set(outgoingSnap.docs.map((d) => d.data().to))
  const incomingSet = new Set(incomingSnap.docs.map((d) => d.data().from))
  const friendIds = new Set<string>()
  friendsSnap.docs.forEach((d) => {
    const data = d.data()
    friendIds.add(data.userId1 === currentUid ? data.userId2 : data.userId1)
  })

  return filtered.map((u) => ({
    uid: u.uid,
    displayName: u.displayName ?? 'Unknown',
    photoURL: u.photoURL ?? null,
    friendStatus: friendIds.has(u.uid) ? 'friends'
      : outgoingSet.has(u.uid) ? 'pending_sent'
      : incomingSet.has(u.uid) ? 'pending_received'
      : 'none',
  }))
}

/* ─── Friend Requests ──────────────────────────── */

export async function sendFriendRequest(fromUid: string, toUid: string): Promise<void> {
  const [fromUser, toUser] = await Promise.all([
    lookupUser(fromUid),
    lookupUser(toUid),
  ])
  if (!fromUser || !toUser) throw new Error('User not found')

  const existing = query(
    collection(db, 'friend_requests'),
    and(
      where('from', '==', fromUid),
      where('to', '==', toUid),
    ),
  )
  const snap = await getDocs(existing)
  if (!snap.empty) return

  await addDoc(collection(db, 'friend_requests'), {
    from: fromUid,
    to: toUid,
    fromName: fromUser.displayName,
    fromPhotoURL: fromUser.photoURL,
    toName: toUser.displayName,
    toPhotoURL: toUser.photoURL,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const notif = buildNotification('friend_request', { senderName: fromUser.displayName })
  await sendNotification({
    userId: toUid,
    type: 'friend_request',
    title: notif.title,
    body: notif.body,
    link: notif.link,
    senderId: fromUid,
    senderName: fromUser.displayName,
    senderPhotoURL: fromUser.photoURL ?? undefined,
  })
}

export async function acceptFriendRequest(requestId: string, fromUid: string, toUid: string): Promise<void> {
  const batch = writeBatch(db)

  const reqRef = doc(db, 'friend_requests', requestId)
  batch.update(reqRef, { status: 'accepted', updatedAt: serverTimestamp() })

  const fromUser = await lookupUser(fromUid)
  const notif = buildNotification('friend_accepted', { senderName: fromUser?.displayName ?? 'Someone' })
  await sendNotification({
    userId: toUid,
    type: 'friend_accepted',
    title: notif.title,
    body: notif.body,
    link: notif.link,
    senderId: fromUid,
    senderName: fromUser?.displayName ?? 'Unknown',
  })
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await setDoc(doc(db, 'friend_requests', requestId), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

/* ─── Remove Friend ────────────────────────────── */

export async function removeFriend(currentUid: string, friendUid: string): Promise<void> {
  const friendsQ = query(
    collection(db, 'friendships'),
    or(
      and(where('userId1', '==', currentUid), where('userId2', '==', friendUid)),
      and(where('userId1', '==', friendUid), where('userId2', '==', currentUid)),
    ),
  )
  const snap = await getDocs(friendsQ)
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(doc(db, 'friendships', d.id)))

  // Also delete the accepted request
  const reqQ = query(
    collection(db, 'friend_requests'),
    or(
      and(where('from', '==', currentUid), where('to', '==', friendUid), where('status', '==', 'accepted')),
      and(where('from', '==', friendUid), where('to', '==', currentUid), where('status', '==', 'accepted')),
    ),
  )
  const reqSnap = await getDocs(reqQ)
  reqSnap.docs.forEach((d) => batch.delete(doc(db, 'friend_requests', d.id)))

  await batch.commit()
}

/* ─── Get Friends with Presence ────────────────── */

export function listenFriends(currentUid: string, cb: (friends: FriendWithPresence[]) => void): () => void {
  const q = query(
    collection(db, 'friendships'),
    or(
      where('userId1', '==', currentUid),
      where('userId2', '==', currentUid),
    ),
  )

  return onSnapshot(q, async (snap) => {
    const friendIds: string[] = []
    const friendSinceMap = new Map<string, import('firebase/firestore').Timestamp>()

    snap.docs.forEach((d) => {
      const data = d.data()
      const friendId = data.userId1 === currentUid ? data.userId2 : data.userId1
      friendIds.push(friendId)
      friendSinceMap.set(friendId, data.createdAt)
    })

    const results = await Promise.all(
      friendIds.map(async (fid) => {
        const user = await lookupUser(fid)
        const presenceSnap = await getDoc(doc(db, 'user_presence', fid))
        const presence = presenceSnap.exists() ? presenceSnap.data() as UserPresence : null
        return {
          uid: fid,
          displayName: user?.displayName ?? 'Unknown',
          photoURL: user?.photoURL ?? null,
          online: presence?.status === 'online',
          lastSeen: presence?.lastSeen ?? null,
          friendSince: friendSinceMap.get(fid)!,
        } as FriendWithPresence
      }),
    )

    results.sort((a: FriendWithPresence, b: FriendWithPresence) => {
      if (a.online !== b.online) return a.online ? -1 : 1
      return a.displayName.localeCompare(b.displayName)
    })

    cb(results)
  })
}

/* ─── Get Friend Requests (with listener) ──────── */

export function listenFriendRequests(
  currentUid: string,
  cb: (requests: FriendRequest[]) => void,
): () => void {
  const q = query(
    collection(db, 'friend_requests'),
    or(
      and(where('from', '==', currentUid), where('status', '==', 'pending')),
      and(where('to', '==', currentUid), where('status', '==', 'pending')),
    ),
    orderBy('createdAt', 'desc'),
  )

  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest))
    cb(requests)
  })
}

/* ─── Presence Management ──────────────────────── */

const PRESENCE_HEARTBEAT_INTERVAL = 30000
let presenceInterval: ReturnType<typeof setInterval> | null = null

export function goOnline(uid: string): void {
  const ref = doc(db, 'user_presence', uid)
  setDoc(ref, { userId: uid, status: 'online', lastSeen: serverTimestamp() }, { merge: true })

  if (presenceInterval) clearInterval(presenceInterval)
  presenceInterval = setInterval(() => {
    setDoc(ref, { status: 'online', lastSeen: serverTimestamp() }, { merge: true })
  }, PRESENCE_HEARTBEAT_INTERVAL)

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => goOffline(uid))
  }
}

export function goOffline(uid: string): void {
  if (presenceInterval) {
    clearInterval(presenceInterval)
    presenceInterval = null
  }
  const ref = doc(db, 'user_presence', uid)
  setDoc(ref, { userId: uid, status: 'offline', lastSeen: serverTimestamp() }, { merge: true })
}

export function listenPresence(uid: string, cb: (presence: UserPresence | null) => void): () => void {
  return onSnapshot(doc(db, 'user_presence', uid), (snap) => {
    cb(snap.exists() ? ({ userId: uid, ...snap.data() } as UserPresence) : null)
  })
}
