import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  limit,
  updateDoc,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ChatMessage, ChatType, PrivateChat, ChatConversation } from '@/types/chat'

/* ─── Send Message ──────────────────────────────── */

export async function sendMessage(
  chatType: ChatType,
  chatId: string,
  sender: { uid: string; displayName: string; photoURL: string | null },
  text: string,
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  // Determine path
  let messagesPath: string
  if (chatType === 'tournament') {
    messagesPath = `tournaments/${chatId}/chat/messages`
  } else if (chatType === 'team') {
    messagesPath = `teams/${chatId}/chat/messages`
  } else {
    messagesPath = `private_chats/${chatId}/messages`
  }

  const messagesCol = collection(db, messagesPath)
  const msgRef = doc(messagesCol)

  const batch = writeBatch(db)
  batch.set(msgRef, {
    id: msgRef.id,
    chatType,
    chatId,
    senderId: sender.uid,
    senderName: sender.displayName,
    senderPhotoURL: sender.photoURL ?? null,
    text: trimmed,
    createdAt: serverTimestamp(),
    readBy: [sender.uid],
  })

  // Update lastMessage on private chat metadata
  if (chatType === 'private') {
    const chatRef = doc(db, 'private_chats', chatId)
    batch.update(chatRef, {
      lastMessage: {
        text: trimmed,
        senderId: sender.uid,
        senderName: sender.displayName,
        createdAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

/* ─── Real-time Message Listener ────────────────── */

export function listenMessages(
  chatType: ChatType,
  chatId: string,
  max = 100,
  cb: (messages: ChatMessage[]) => void,
): () => void {
  let messagesPath: string
  if (chatType === 'tournament') {
    messagesPath = `tournaments/${chatId}/chat/messages`
  } else if (chatType === 'team') {
    messagesPath = `teams/${chatId}/chat/messages`
  } else {
    messagesPath = `private_chats/${chatId}/messages`
  }

  const q = query(
    collection(db, messagesPath),
    orderBy('createdAt', 'asc'),
    limit(max),
  )

  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage))
    cb(msgs)
  })
}

/* ─── Mark as Read ───────────────────────────────── */

export async function markAsRead(chatType: ChatType, chatId: string, messageId: string, uid: string): Promise<void> {
  let path: string
  if (chatType === 'tournament') {
    path = `tournaments/${chatId}/chat/messages/${messageId}`
  } else if (chatType === 'team') {
    path = `teams/${chatId}/chat/messages/${messageId}`
  } else {
    path = `private_chats/${chatId}/messages/${messageId}`
  }
  await updateDoc(doc(db, path), {
    readBy: arrayUnion(uid),
  })
}

/* ─── Private Chat ──────────────────────────────── */

export async function getOrCreatePrivateChat(uid1: string, uid2: string): Promise<string> {
  const [sorted1, sorted2] = [uid1, uid2].sort()
  const chatId = `${sorted1}_${sorted2}`
  const ref = doc(db, 'private_chats', chatId)
  const snap = await getDoc(ref)
  if (snap.exists()) return chatId

  await setDoc(ref, {
    participants: [sorted1, sorted2],
    lastMessage: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return chatId
}

export function listenPrivateChats(
  uid: string,
  cb: (conversations: ChatConversation[]) => void,
): () => void {
  const q = query(
    collection(db, 'private_chats'),
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
  )

  return onSnapshot(q, async (snap) => {
    const promises = snap.docs.map(async (d) => {
      const data = d.data() as PrivateChat
      const otherUid = data.participants.find((p) => p !== uid)!
      const otherSnap = await getDoc(doc(db, 'users', otherUid))
      const otherData = otherSnap.exists()
        ? (otherSnap.data() as { displayName?: string; photoURL?: string | null })
        : null

      // Count unread
      const msgsQ = query(
        collection(db, `private_chats/${d.id}/messages`),
        where('readBy', 'not-in', [uid]),
      )
      const msgsSnap = await getDocs(msgsQ)

      return {
        chatId: d.id,
        userId: otherUid,
        displayName: otherData?.displayName ?? 'Unknown',
        photoURL: otherData?.photoURL ?? null,
        lastMessage: data.lastMessage?.text ?? '',
        lastMessageAt: data.lastMessage?.createdAt ?? null,
        unread: msgsSnap.size,
      } as ChatConversation
    })

    const convs = await Promise.all(promises)
    cb(convs)
  })
}
