import {
  collection, addDoc, query, orderBy, limit, onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TeamChatMessage, QuickChatMessage, ChatType, TacticalMessage } from './team-types'

const CHATS = 'team_chats'

export function chatRef(sessionId: string) {
  return collection(db, 'game_sessions', sessionId, CHATS)
}

export async function sendChat(
  sessionId: string,
  senderId: string,
  senderName: string,
  type: ChatType,
  message: string,
  targetTeamId: string,
): Promise<string> {
  const chat: Omit<TeamChatMessage, 'id'> = {
    senderId,
    senderName,
    type,
    message,
    timestamp: Date.now(),
    targetTeamId,
  }
  const ref = await addDoc(chatRef(sessionId), {
    ...chat,
    timestamp: serverTimestamp(),
  })
  return ref.id
}

export async function sendQuickChat(
  sessionId: string,
  senderId: string,
  senderName: string,
  message: QuickChatMessage,
  targetTeamId: string,
): Promise<string> {
  return sendChat(sessionId, senderId, senderName, 'quick', message, targetTeamId)
}

export async function sendTactical(
  sessionId: string,
  msg: TacticalMessage,
  targetTeamId: string,
): Promise<string> {
  return sendChat(sessionId, msg.senderId, '', 'tactical', msg.detail, targetTeamId)
}

export function subscribeChat(
  sessionId: string,
  onMessage: (msg: TeamChatMessage) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(chatRef(sessionId), orderBy('timestamp', 'asc'), limit(50)),
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          onMessage({ ...change.doc.data() as TeamChatMessage, id: change.doc.id })
        }
      })
    },
    onError,
  )
}

export function subscribeTeamChat(
  sessionId: string,
  teamId: string,
  onMessage: (msg: TeamChatMessage) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(chatRef(sessionId), orderBy('timestamp', 'asc'), limit(50)),
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = { ...change.doc.data() as TeamChatMessage, id: change.doc.id }
          if (msg.targetTeamId === teamId) {
            onMessage(msg)
          }
        }
      })
    },
    onError,
  )
}

export function isTacticalMessage(msg: TeamChatMessage): msg is TeamChatMessage & { type: 'tactical' } {
  return msg.type === 'tactical'
}

export function isQuickChatMessage(msg: TeamChatMessage): msg is TeamChatMessage & { type: 'quick' } {
  return msg.type === 'quick'
}
