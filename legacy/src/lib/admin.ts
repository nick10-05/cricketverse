import {
  doc, collection, getDoc, getDocs, updateDoc, addDoc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AdminStats, UserProfile, Report, AdminLog, AnalyticsData } from '@/types/admin'
import type { Tournament } from '@/types/tournament'

/* ─── Role Check ───────────────────────────────────── */

export async function getUserRole(uid: string): Promise<'user' | 'moderator' | 'admin'> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return 'user'
  return (snap.data() as { role?: string }).role as 'user' | 'moderator' | 'admin' ?? 'user'
}

export async function isAdmin(uid: string): Promise<boolean> {
  const role = await getUserRole(uid)
  return role === 'admin'
}

export async function isModOrAdmin(uid: string): Promise<boolean> {
  const role = await getUserRole(uid)
  return role === 'admin' || role === 'moderator'
}

export async function setUserRole(uid: string, role: 'user' | 'moderator' | 'admin', byUid: string): Promise<void> {
  if (!(await isAdmin(byUid))) throw new Error('Only admins can change roles')
  await updateDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() })
  await logAction(byUid, 'set_role', uid, `Role set to ${role}`)
}

/* ─── Ban / Unban ──────────────────────────────────── */

export async function banUser(uid: string, reason: string, byUid: string): Promise<void> {
  if (!(await isAdmin(byUid))) throw new Error('Unauthorized')
  await updateDoc(doc(db, 'users', uid), { banned: true, banReason: reason, updatedAt: serverTimestamp() })
  await logAction(byUid, 'ban_user', uid, reason)
}

export async function unbanUser(uid: string, byUid: string): Promise<void> {
  if (!(await isAdmin(byUid))) throw new Error('Unauthorized')
  await updateDoc(doc(db, 'users', uid), { banned: false, banReason: null, updatedAt: serverTimestamp() })
  await logAction(byUid, 'unban_user', uid, 'User unbanned')
}

/* ─── Stats ────────────────────────────────────────── */

export async function getAdminStats(): Promise<AdminStats> {
  const [userSnap, tourneySnap, reportSnap, playerSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'tournaments')),
    getDocs(query(collection(db, 'reports'), where('status', '==', 'open'))),
    getDocs(collection(db, 'players')),
  ])

  const users = userSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as unknown as UserProfile))
  const tournaments = tourneySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament))

  let totalMatches = 0
  for (const t of tourneySnap.docs) {
    const matchSnap = await getDocs(collection(db, 'tournaments', t.id, 'matches'))
    totalMatches += matchSnap.size
  }

  return {
    totalUsers: users.length,
    bannedUsers: users.filter((u) => u.banned).length,
    totalTournaments: tournaments.length,
    activeTournaments: tournaments.filter((t) => t.status === 'in_progress' || t.status === 'open').length,
    totalMatches,
    totalPlayers: playerSnap.size,
    openReports: reportSnap.size,
    totalTeams: users.length, // placeholder: actual teams from tournament subcollections
  }
}

/* ─── User Management ──────────────────────────────── */

export async function getAllUsers(max = 100): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
}

/* ─── Tournament Management ────────────────────────── */

export async function getAllTournaments(max = 100): Promise<Tournament[]> {
  const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament))
}

export async function adminCancelTournament(tournamentId: string, byUid: string): Promise<void> {
  if (!(await isModOrAdmin(byUid))) throw new Error('Unauthorized')
  await updateDoc(doc(db, 'tournaments', tournamentId), { status: 'cancelled', updatedAt: serverTimestamp() })
  await logAction(byUid, 'cancel_tournament', tournamentId, 'Tournament cancelled by admin')
}

/* ─── Reports ──────────────────────────────────────── */

export async function getOpenReports(max = 50): Promise<Report[]> {
  const snap = await getDocs(
    query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(max)),
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report))
}

export async function getAllReports(max = 100): Promise<Report[]> {
  const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report))
}

export async function submitReport(
  reporterId: string,
  reporterName: string,
  targetId: string,
  targetType: Report['targetType'],
  reason: string,
  description: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'reports'), {
    reporterId, reporterName, targetId, targetType, reason, description,
    status: 'open',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function resolveReport(reportId: string, byUid: string): Promise<void> {
  if (!(await isModOrAdmin(byUid))) throw new Error('Unauthorized')
  await updateDoc(doc(db, 'reports', reportId), { status: 'resolved', resolvedBy: byUid, resolvedAt: serverTimestamp() })
  await logAction(byUid, 'resolve_report', reportId, 'Report resolved')
}

export async function dismissReport(reportId: string, byUid: string): Promise<void> {
  if (!(await isModOrAdmin(byUid))) throw new Error('Unauthorized')
  await updateDoc(doc(db, 'reports', reportId), { status: 'dismissed', resolvedBy: byUid, resolvedAt: serverTimestamp() })
  await logAction(byUid, 'dismiss_report', reportId, 'Report dismissed')
}

/* ─── Audit Log ────────────────────────────────────── */

export async function logAction(adminId: string, action: string, targetId: string, details: string): Promise<void> {
  const adminSnap = await getDoc(doc(db, 'users', adminId))
  const adminName = (adminSnap.data() as { displayName?: string })?.displayName ?? 'Unknown'
  await addDoc(collection(db, 'admin_logs'), {
    adminId, adminName, action, targetId, details, createdAt: serverTimestamp(),
  })
}

export async function getAdminLogs(max = 50): Promise<AdminLog[]> {
  const snap = await getDocs(query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc'), limit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminLog))
}

/* ─── Analytics (simplified) ───────────────────────── */

export async function getAnalytics(): Promise<AnalyticsData> {
  const playerSnap = await getDocs(query(collection(db, 'player_progression'), orderBy('totalRuns', 'desc'), limit(10)))

  const topPlayers = playerSnap.docs.map((d) => {
    const data = d.data() as { totalRuns: number; totalWickets: number }
    return { name: d.id, runs: data.totalRuns ?? 0 }
  })

  const topBowlers = playerSnap.docs
    .map((d) => {
      const data = d.data() as { totalRuns: number; totalWickets: number }
      return { name: d.id, wickets: data.totalWickets ?? 0 }
    })
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, 10)

  const tourneySnap = await getDocs(collection(db, 'tournaments'))
  const formats: Record<string, number> = {}
  tourneySnap.docs.forEach((d) => {
    const f = (d.data() as { format?: string }).format ?? 'unknown'
    formats[f] = (formats[f] ?? 0) + 1
  })

  return {
    usersByDay: [],
    tournamentsByDay: [],
    matchesByDay: [],
    topPlayers,
    topBowlers,
    formatDistribution: Object.entries(formats).map(([format, count]) => ({ format, count })),
  }
}
