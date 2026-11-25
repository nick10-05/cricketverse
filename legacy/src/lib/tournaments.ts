import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  runTransaction,
  increment,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  Tournament,
  CreateTournamentInput,
  Team,
  Match,
  TournamentFormat,
  ScoreEntry,
} from '@/types/tournament'

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    const q = query(collection(db, 'tournaments'), where('roomCode', '==', code))
    const snap = await getDocs(q)
    if (snap.empty) return code
  }
  throw new Error('Could not generate unique room code')
}

function computeTotalRounds(format: TournamentFormat, maxTeams: number): number {
  if (format === 'league') return maxTeams - 1
  if (format === 'knockout') return Math.ceil(Math.log2(maxTeams))
  return maxTeams - 1 + Math.ceil(Math.log2(4))
}

export async function createTournament(
  input: CreateTournamentInput,
  userId: string,
  userName: string,
): Promise<string> {
  const name = input.name.trim()
  if (!name) throw new Error('Tournament name is required')
  if (name.length > 100) throw new Error('Name must be 100 characters or less')
  if (![4, 8, 16, 32].includes(input.maxTeams)) {
    throw new Error('Max teams must be 4, 8, 16, or 32')
  }
  if (input.format === 'league_knockout' && input.knockoutQualifiers != null) {
    if (input.knockoutQualifiers < 2 || input.knockoutQualifiers > input.maxTeams / 2) {
      throw new Error('Knockout qualifiers must be between 2 and half of max teams')
    }
  }

  const roomCode = await generateUniqueRoomCode()
  const totalRounds = computeTotalRounds(input.format, input.maxTeams)

  const docRef = await addDoc(collection(db, 'tournaments'), {
    name,
    roomCode,
    format: input.format,
    overs: input.overs,
    maxTeams: input.maxTeams,
    status: 'open',
    createdBy: userId,
    creatorName: userName,
    winnerTeamId: null,
    currentRound: 0,
    teamCount: 0,
    knockoutQualifiers: input.knockoutQualifiers ?? null,
    totalRounds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

export async function joinTournament(
  roomCode: string,
  teamName: string,
  userId: string,
  userName: string,
): Promise<string> {
  if (!teamName.trim()) throw new Error('Team name is required')
  if (teamName.length > 50) throw new Error('Team name must be 50 characters or less')

  const q = query(collection(db, 'tournaments'), where('roomCode', '==', roomCode))
  const snap = await getDocs(q)

  if (snap.empty) throw new Error('Tournament not found. Check your room code.')
  if (snap.size > 1) throw new Error('Multiple tournaments found with this code')

  const tournamentDoc = snap.docs[0]
  const tournamentData = tournamentDoc.data() as DocumentData
  const tournamentId = tournamentDoc.id

  if (tournamentData.status !== 'open') {
    throw new Error('Tournament is no longer accepting players')
  }

  const teamsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'teams'))
  if (teamsSnap.size >= tournamentData.maxTeams) {
    throw new Error('Tournament is full')
  }

  const existingTeam = teamsSnap.docs.find(
    (d) => d.data().ownerId === userId || d.data().name.toLowerCase() === teamName.toLowerCase(),
  )
  if (existingTeam) {
    const reason = existingTeam.data().ownerId === userId
      ? 'You already have a team in this tournament'
      : 'A team with this name already exists in this tournament'
    throw new Error(reason)
  }

  await runTransaction(db, async (transaction) => {
    const tRef = doc(db, 'tournaments', tournamentId)
    const tSnap = await transaction.get(tRef)
    if (!tSnap.exists()) throw new Error('Tournament deleted')
    const tData = tSnap.data()
    if (tData.teamCount >= tData.maxTeams) throw new Error('Tournament is full')

    const teamRef = doc(collection(db, 'tournaments', tournamentId, 'teams'))
    transaction.set(teamRef, {
      name: teamName.trim(),
      ownerId: userId,
      ownerName: userName,
      totalPoints: 0,
      nrr: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchesTied: 0,
      createdAt: serverTimestamp(),
    })
    transaction.update(tRef, { teamCount: increment(1), updatedAt: serverTimestamp() })
  })

  return tournamentId
}

export async function startTournament(tournamentId: string, userId: string): Promise<void> {
  const tRef = doc(db, 'tournaments', tournamentId)
  const tSnap = await getDoc(tRef)
  if (!tSnap.exists()) throw new Error('Tournament not found')
  const tData = tSnap.data() as DocumentData

  if (tData.createdBy !== userId) {
    throw new Error('Only the tournament creator can start the tournament')
  }
  if (tData.status !== 'open') throw new Error('Tournament is not in open status')

  if (tData.teamCount < 2) {
    throw new Error('Need at least 2 teams to start a tournament')
  }

  if (tData.format === 'knockout') {
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(tData.teamCount)))
    if (tData.teamCount < nextPow2 / 2) {
      throw new Error('Need at least half the bracket size to start')
    }
  }

  await updateDoc(tRef, {
    status: 'in_progress',
    currentRound: 1,
    updatedAt: serverTimestamp(),
  })
}

export async function cancelTournament(tournamentId: string, userId: string): Promise<void> {
  const tRef = doc(db, 'tournaments', tournamentId)
  const tSnap = await getDoc(tRef)
  if (!tSnap.exists()) throw new Error('Tournament not found')
  const tData = tSnap.data() as DocumentData
  if (tData.createdBy !== userId) throw new Error('Only the creator can cancel this tournament')
  await updateDoc(tRef, { status: 'cancelled', updatedAt: serverTimestamp() })
}

export async function getTournament(tournamentId: string): Promise<Tournament | null> {
  const snap = await getDoc(doc(db, 'tournaments', tournamentId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Tournament
}

export async function getUserTournaments(userId: string): Promise<Tournament[]> {
  const q1 = query(
    collection(db, 'tournaments'),
    where('createdBy', '==', userId),
  )
  const ownedSnap = await getDocs(q1)
  const owned = ownedSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament))

  const tournamentSnap = await getDocs(collection(db, 'tournaments'))
  const joined: Tournament[] = []
  for (const tDoc of tournamentSnap.docs) {
    const teamSnap = await getDocs(collection(db, 'tournaments', tDoc.id, 'teams'))
    const isJoined = teamSnap.docs.some((d) => d.data().ownerId === userId)
    if (isJoined) {
      joined.push({ id: tDoc.id, ...tDoc.data() } as Tournament)
    }
  }

  const seen = new Set<string>()
  return [...owned, ...joined]
    .filter((t) => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0
      const bTime = b.createdAt?.toMillis?.() ?? 0
      return bTime - aTime
    })
}

export async function getTeams(tournamentId: string): Promise<Team[]> {
  const snap = await getDocs(
    collection(db, 'tournaments', tournamentId, 'teams'),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team))
}

export async function getMatches(tournamentId: string): Promise<Match[]> {
  const snap = await getDocs(
    collection(db, 'tournaments', tournamentId, 'matches'),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match))
}

export async function getPointsTable(tournamentId: string): Promise<ScoreEntry[]> {
  const teams = await getTeams(tournamentId)
  return teams
    .map((t) => ({
      teamId: t.id,
      teamName: t.name,
      played: t.matchesPlayed,
      won: t.matchesWon,
      lost: t.matchesLost,
      tied: t.matchesTied,
      points: t.totalPoints,
      nrr: t.nrr,
    }))
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr)
}
