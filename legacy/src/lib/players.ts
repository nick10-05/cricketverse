import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { 
  Player, 
  CreatePlayerInput, 
  PlayerRole,
  SkillName,
} from '@/types/player'

const VALID_ROLES: PlayerRole[] = ['batsman', 'bowler', 'all_rounder', 'wicket_keeper']

const ALL_SKILLS: SkillName[] = [
  'power', 'timing', 'technique', 'pace', 'swing',
  'spin', 'accuracy', 'catching', 'stamina',
]

function validatePlayerInput(input: CreatePlayerInput): void {
  if (!input.name.trim()) throw new Error('Player name is required')
  if (input.name.length > 60) throw new Error('Name must be 60 characters or less')

  if (!VALID_ROLES.includes(input.role)) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`)
  }

  for (const skill of ALL_SKILLS) {
    const val = input.skills[skill]
    if (val == null || !Number.isInteger(val) || val < 1 || val > 100) {
      throw new Error(`${skill} must be an integer between 1 and 100`)
    }
  }
}

export async function createPlayer(
  input: CreatePlayerInput,
  userId: string,
): Promise<string> {
  validatePlayerInput(input)

  const docRef = await addDoc(collection(db, 'players'), {
    name: input.name.trim(),
    role: input.role,
    skills: input.skills,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

export async function getPlayer(playerId: string): Promise<Player | null> {
  const snap = await getDoc(doc(db, 'players', playerId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Player
}

export async function getUserPlayers(userId: string): Promise<Player[]> {
  const q = query(
    collection(db, 'players'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player))
}

export async function updatePlayer(
  playerId: string,
  input: CreatePlayerInput,
  userId: string,
): Promise<void> {
  const existing = await getPlayer(playerId)
  if (!existing) throw new Error('Player not found')
  if (existing.createdBy !== userId) throw new Error('Only the creator can edit this player')

  validatePlayerInput(input)

  await updateDoc(doc(db, 'players', playerId), {
    name: input.name.trim(),
    role: input.role,
    skills: input.skills,
    updatedAt: serverTimestamp(),
  })
}

export async function deletePlayer(
  playerId: string,
  userId: string,
): Promise<void> {
  const existing = await getPlayer(playerId)
  if (!existing) throw new Error('Player not found')
  if (existing.createdBy !== userId) throw new Error('Only the creator can delete this player')

  await deleteDoc(doc(db, 'players', playerId))
}
