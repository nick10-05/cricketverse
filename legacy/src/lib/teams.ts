import {
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import {
  ref,
  uploadBytesResumable,
  deleteObject,
  getDownloadURL,
} from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import type { Team, UpdateTeamInput, TeamColors } from '@/types/tournament'

export async function getTeam(tournamentId: string, teamId: string): Promise<Team | null> {
  const snap = await getDoc(doc(db, 'tournaments', tournamentId, 'teams', teamId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Team
}

export async function getMyTeam(tournamentId: string, userId: string): Promise<Team | null> {
  const q = query(
    collection(db, 'tournaments', tournamentId, 'teams'),
    where('ownerId', '==', userId),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Team
}

export async function updateTeam(
  tournamentId: string,
  teamId: string,
  userId: string,
  input: UpdateTeamInput,
): Promise<void> {
  const team = await getTeam(tournamentId, teamId)
  if (!team) throw new Error('Team not found')
  if (team.ownerId !== userId) throw new Error('Only the team owner can edit the team')

  const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() }

  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error('Team name is required')
    if (input.name.length > 50) throw new Error('Team name must be 50 characters or less')
    updateData.name = input.name.trim()
  }

  if (input.colors !== undefined) {
    validateColors(input.colors)
    updateData.colors = input.colors
  }

  if (input.logoURL !== undefined) {
    updateData.logoURL = input.logoURL
  }

  await updateDoc(doc(db, 'tournaments', tournamentId, 'teams', teamId), updateData)
}

export async function deleteTeam(
  tournamentId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  const team = await getTeam(tournamentId, teamId)
  if (!team) throw new Error('Team not found')
  if (team.ownerId !== userId) throw new Error('Only the team owner can delete the team')

  const tournSnap = await getDoc(doc(db, 'tournaments', tournamentId))
  if (!tournSnap.exists()) throw new Error('Tournament not found')
  const tournData = tournSnap.data()

  if (tournData.status !== 'draft' && tournData.status !== 'open') {
    throw new Error('Cannot delete team after tournament has started')
  }

  if (team.logoURL) {
    try {
      const logoRef = ref(storage, `team-logos/${tournamentId}/${teamId}`)
      await deleteObject(logoRef)
    } catch {
      // ignore if file doesn't exist
    }
  }

  await deleteDoc(doc(db, 'tournaments', tournamentId, 'teams', teamId))
}

export async function uploadTeamLogo(
  tournamentId: string,
  teamId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const storageRef = ref(storage, `team-logos/${tournamentId}/${teamId}/${Date.now()}-${file.name}`)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file)
    task.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        onProgress?.(pct)
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      },
    )
  })
}

export async function removeTeamLogo(
  tournamentId: string,
  teamId: string,
  logoURL: string,
): Promise<void> {
  try {
    const logoRef = ref(storage, logoURL)
    await deleteObject(logoRef)
  } catch {
    // ignore
  }
  await updateDoc(doc(db, 'tournaments', tournamentId, 'teams', teamId), {
    logoURL: null,
    updatedAt: serverTimestamp(),
  })
}

function validateColors(colors: TeamColors): void {
  const hexRe = /^#[0-9a-fA-F]{6}$/
  if (!hexRe.test(colors.primary)) throw new Error('Primary color must be a valid hex color')
  if (!hexRe.test(colors.secondary)) throw new Error('Secondary color must be a valid hex color')
}
