import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, addDoc, serverTimestamp, query, orderBy, limit,
  where, getDocs,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { GameSession, NetworkPlayer, DeliveryTurn, SessionStatus, SessionTeamState } from './types'
import { generateRoomCode } from './types'
import type { BowlingInput } from '../bowling/types'
import type { ShotInput, BattingGesture, TimingResult } from '../batting/types'
import type { BallOutcome, MatchState } from '../types'
import { TeamCoordinator } from './team-coordinator'

const SESSIONS = 'game_sessions'
const TURNS = 'turns'

export function sessionRef(sessionId: string) {
  return doc(db, SESSIONS, sessionId)
}

export function turnsRef(sessionId: string) {
  return collection(db, SESSIONS, sessionId, TURNS)
}

export function turnRef(sessionId: string, turnId: string) {
  return doc(db, SESSIONS, sessionId, TURNS, turnId)
}

export async function createSession(
  hostPlayer: NetworkPlayer,
  format: '1v1' | '2v2',
  teamA: { playerIds: string[]; name: string },
  teamB: { playerIds: string[]; name: string },
): Promise<GameSession> {
  const roomCode = generateRoomCode()

  let teamRoles: SessionTeamState | null = null
  if (format === '2v2') {
    const coordinator = new TeamCoordinator('2v2')
    teamRoles = coordinator.initializeRoles(teamA, teamB)
  }

  const session: GameSession = {
    id: '',
    roomCode,
    status: 'waiting',
    hostId: hostPlayer.id,
    players: [hostPlayer],
    matchState: null,
    currentTurn: 'bowl',
    turnPlayerId: null,
    deliveryCount: 0,
    format,
    teams: { teamA, teamB },
    teamRoles,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seed: Math.floor(Math.random() * 2147483647),
  }

  const ref = doc(collection(db, SESSIONS))
  session.id = ref.id
  await setDoc(ref, {
    ...session,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return session
}

export async function joinSession(
  roomCode: string,
  player: NetworkPlayer,
): Promise<GameSession | null> {
  const snap = await getDocs(query(
    collection(db, SESSIONS),
    where('roomCode', '==', roomCode),
    where('status', '==', 'waiting'),
    limit(1),
  ))

  if (snap.empty) return null

  const docSnap = snap.docs[0]
  const session = { ...docSnap.data() as GameSession, id: docSnap.id }
  if (session.players.length >= 4) return null

  const updatedPlayers = [...session.players, player]
  await updateDoc(sessionRef(session.id), {
    players: updatedPlayers,
    status: updatedPlayers.length >= 2 ? 'toss' : 'waiting',
    updatedAt: serverTimestamp(),
  })

  return { ...session, players: updatedPlayers }
}

export function subscribeSession(
  sessionId: string,
  onUpdate: (session: GameSession) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(sessionRef(sessionId), (snap) => {
    if (snap.exists()) onUpdate({ ...snap.data() as GameSession, id: snap.id })
  }, onError)
}

export function subscribeTurns(
  sessionId: string,
  onTurn: (turn: DeliveryTurn) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(turnsRef(sessionId), orderBy('deliveryNumber', 'desc'), limit(20)),
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          onTurn({ ...change.doc.data() as DeliveryTurn, id: change.doc.id })
        }
      })
    },
    onError,
  )
}

export async function submitBowlingInput(
  sessionId: string,
  turnId: string,
  input: BowlingInput,
): Promise<void> {
  await updateDoc(turnRef(sessionId, turnId), {
    bowlingInput: input,
    phase: 'batting',
    timestamp: Date.now(),
  })
}

export async function submitBattingInput(
  sessionId: string,
  turnId: string,
  input: ShotInput,
  gesture: BattingGesture,
  timing: TimingResult,
): Promise<void> {
  await updateDoc(turnRef(sessionId, turnId), {
    shotInput: input,
    gesture,
    timing,
    phase: 'resolving',
    timestamp: Date.now(),
  })
}

export async function submitDeliveryResult(
  sessionId: string,
  turnId: string,
  outcome: BallOutcome,
  stateSnapshot: string,
): Promise<void> {
  await updateDoc(turnRef(sessionId, turnId), {
    outcome,
    stateSnapshot,
    phase: 'complete',
    timestamp: Date.now(),
  })
}

export async function createDeliveryTurn(
  sessionId: string,
  turn: Omit<DeliveryTurn, 'id'>,
): Promise<string> {
  const ref = await addDoc(turnsRef(sessionId), {
    ...turn,
    timestamp: serverTimestamp(),
  })
  return ref.id
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  updates?: Partial<GameSession>,
): Promise<void> {
  await updateDoc(sessionRef(sessionId), {
    ...updates,
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function updateSessionMatchState(
  sessionId: string,
  matchState: MatchState,
): Promise<void> {
  await updateDoc(sessionRef(sessionId), {
    matchState,
    updatedAt: serverTimestamp(),
  })
}

export async function leaveSession(sessionId: string, playerId: string): Promise<void> {
  const snap = await getDoc(sessionRef(sessionId))
  if (!snap.exists()) return

  const session = snap.data() as GameSession
  const updatedPlayers = session.players.filter((p) => p.id !== playerId)

  if (updatedPlayers.length === 0) {
    await updateDoc(sessionRef(sessionId), {
      players: [],
      status: 'completed',
      updatedAt: serverTimestamp(),
    })
  } else if (playerId === session.hostId) {
    await updateDoc(sessionRef(sessionId), {
      players: updatedPlayers,
      hostId: updatedPlayers[0].id,
      status: 'paused',
      updatedAt: serverTimestamp(),
    })
  } else {
    await updateDoc(sessionRef(sessionId), {
      players: updatedPlayers,
      updatedAt: serverTimestamp(),
    })
  }
}

export async function getSession(sessionId: string): Promise<GameSession | null> {
  const snap = await getDoc(sessionRef(sessionId))
  if (!snap.exists()) return null
  return { ...snap.data() as GameSession, id: snap.id }
}

export async function getLatestTurn(sessionId: string): Promise<DeliveryTurn | null> {
  const snap = await getDocs(query(
    turnsRef(sessionId),
    orderBy('deliveryNumber', 'desc'),
    limit(1),
  ))
  if (snap.empty) return null
  return { ...snap.docs[0].data() as DeliveryTurn, id: snap.docs[0].id }
}

export async function updateTeamRoles(
  sessionId: string,
  teamRoles: SessionTeamState,
): Promise<void> {
  await updateDoc(sessionRef(sessionId), {
    teamRoles,
    updatedAt: serverTimestamp(),
  })
}
