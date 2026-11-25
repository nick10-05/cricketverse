import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getAdminStats, getAllUsers, getAllTournaments, getOpenReports, getAllReports,
  banUser, unbanUser, setUserRole, adminCancelTournament,
  resolveReport, dismissReport, getAdminLogs, getAnalytics,
} from '@/lib/admin'
import type { AdminStats, UserProfile, Report, AdminLog, AnalyticsData } from '@/types/admin'
import type { Tournament } from '@/types/tournament'

type Tab = 'overview' | 'users' | 'tournaments' | 'reports' | 'analytics' | 'logs'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'reports', label: 'Reports' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'logs', label: 'Logs' },
]

export function AdminDashboard() {
  const { user } = useAuth()
  if (!user) return null
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [openReports, setOpenReports] = useState<Report[]>([])
  const [allReports, setAllReports] = useState<Report[]>([])
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, u, t, oR, aR, l, a] = await Promise.all([
        getAdminStats(), getAllUsers(), getAllTournaments(),
        getOpenReports(), getAllReports(), getAdminLogs(), getAnalytics(),
      ])
      setStats(s); setUsers(u); setTournaments(t)
      setOpenReports(oR); setAllReports(aR); setLogs(l); setAnalytics(a)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, [])

  const act = async (fn: () => Promise<void>, msg: string) => {
    try { await fn(); setActionMsg(msg); loadAll() }
    catch (e) { setActionMsg(`Error: ${(e as Error).message}`) }
    setTimeout(() => setActionMsg(''), 3000)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400">Manage users, tournaments, reports, and view analytics</p>
        </div>
        {actionMsg && (
          <span className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-emerald-400">{actionMsg}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-900 p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ─── Overview ─── */}
          {tab === 'overview' && stats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Users" value={stats.totalUsers} sub={`${stats.bannedUsers} banned`} />
              <StatCard label="Tournaments" value={stats.totalTournaments} sub={`${stats.activeTournaments} active`} />
              <StatCard label="Matches" value={stats.totalMatches} sub="across tournaments" />
              <StatCard label="Open Reports" value={stats.openReports} sub={stats.openReports > 0 ? 'Needs attention' : 'All clear'} />
            </div>
          )}

          {/* ─── Users ─── */}
          {tab === 'users' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-4 py-3 text-gray-400">Name</th>
                  <th className="px-4 py-3 text-gray-400">Role</th>
                  <th className="px-4 py-3 text-gray-400">Status</th>
                  <th className="px-4 py-3 text-gray-400">Actions</th>
                </tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.uid} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <span className="text-white">{u.displayName}</span>
                        <span className="ml-2 text-xs text-gray-500">{u.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${u.role === 'admin' ? 'text-purple-400' : u.role === 'moderator' ? 'text-blue-400' : 'text-gray-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.banned ? <span className="text-xs text-red-400">Banned</span> : <span className="text-xs text-emerald-400">Active</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {u.role !== 'admin' && (
                            <button onClick={() => act(() => setUserRole(u.uid, u.role === 'moderator' ? 'user' : 'moderator', user.uid),
                              `Toggled role for ${u.displayName}`)} className="text-xs text-blue-400 hover:text-blue-300">
                              Toggle mod
                            </button>
                          )}
                          {!u.banned ? (
                            <button onClick={() => act(() => banUser(u.uid, 'Admin action', user.uid),
                              `Banned ${u.displayName}`)} className="text-xs text-red-400 hover:text-red-300">
                              Ban
                            </button>
                          ) : (
                            <button onClick={() => act(() => unbanUser(u.uid, user.uid),
                              `Unbanned ${u.displayName}`)} className="text-xs text-emerald-400 hover:text-emerald-300">
                              Unban
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Tournaments ─── */}
          {tab === 'tournaments' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-4 py-3 text-gray-400">Name</th>
                  <th className="px-4 py-3 text-gray-400">Format</th>
                  <th className="px-4 py-3 text-gray-400">Teams</th>
                  <th className="px-4 py-3 text-gray-400">Status</th>
                  <th className="px-4 py-3 text-gray-400">Actions</th>
                </tr></thead>
                <tbody>
                  {tournaments.map((t) => (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-white">{t.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{t.format}</td>
                      <td className="px-4 py-3 text-gray-400">{t.teamCount}/{t.maxTeams}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3">
                        {(t.status === 'open' || t.status === 'in_progress') && (
                          <button onClick={() => act(() => adminCancelTournament(t.id, user.uid),
                            `Cancelled ${t.name}`)} className="text-xs text-red-400 hover:text-red-300">
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Reports ─── */}
          {tab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-400">{openReports.length} open</span>
                <span className="text-gray-600">|</span>
                <span>{allReports.length} total</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-gray-800 bg-gray-900/50">
                    <th className="px-4 py-3 text-gray-400">Reporter</th>
                    <th className="px-4 py-3 text-gray-400">Target</th>
                    <th className="px-4 py-3 text-gray-400">Reason</th>
                    <th className="px-4 py-3 text-gray-400">Status</th>
                    <th className="px-4 py-3 text-gray-400">Actions</th>
                  </tr></thead>
                  <tbody>
                    {allReports.map((r) => (
                      <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-3 text-white">{r.reporterName}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400">{r.targetType}</span>
                          <span className="ml-1 text-xs text-gray-500">{r.targetId.slice(0, 8)}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{r.reason}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${r.status === 'open' ? 'text-red-400' : r.status === 'resolved' ? 'text-emerald-400' : 'text-gray-500'}`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {r.status === 'open' && (
                            <div className="flex gap-2">
                              <button onClick={() => act(() => resolveReport(r.id, user.uid), 'Report resolved')}
                                className="text-xs text-emerald-400 hover:text-emerald-300">Resolve</button>
                              <button onClick={() => act(() => dismissReport(r.id, user.uid), 'Report dismissed')}
                                className="text-xs text-gray-400 hover:text-gray-300">Dismiss</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── Analytics ─── */}
          {tab === 'analytics' && analytics && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-300">Top Batsmen (Runs)</h3>
                <div className="space-y-2">
                  {analytics.topPlayers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{p.name}</span>
                      <span className="font-medium text-white">{p.runs}</span>
                    </div>
                  ))}
                  {analytics.topPlayers.length === 0 && <p className="text-sm text-gray-500">No data</p>}
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-300">Top Bowlers (Wickets)</h3>
                <div className="space-y-2">
                  {analytics.topBowlers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{p.name}</span>
                      <span className="font-medium text-white">{p.wickets}</span>
                    </div>
                  ))}
                  {analytics.topBowlers.length === 0 && <p className="text-sm text-gray-500">No data</p>}
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-300">Tournament Formats</h3>
                <div className="space-y-2">
                  {analytics.formatDistribution.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{f.format}</span>
                      <span className="font-medium text-white">{f.count}</span>
                    </div>
                  ))}
                  {analytics.formatDistribution.length === 0 && <p className="text-sm text-gray-500">No tournaments</p>}
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-300">Quick Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Total Users:</span><span className="ml-2 text-white">{stats?.totalUsers ?? '-'}</span></div>
                  <div><span className="text-gray-500">Players:</span><span className="ml-2 text-white">{stats?.totalPlayers ?? '-'}</span></div>
                  <div><span className="text-gray-500">Tournaments:</span><span className="ml-2 text-white">{stats?.totalTournaments ?? '-'}</span></div>
                  <div><span className="text-gray-500">Matches:</span><span className="ml-2 text-white">{stats?.totalMatches ?? '-'}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Logs ─── */}
          {tab === 'logs' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-4 py-3 text-gray-400">Admin</th>
                  <th className="px-4 py-3 text-gray-400">Action</th>
                  <th className="px-4 py-3 text-gray-400">Target</th>
                  <th className="px-4 py-3 text-gray-400">Details</th>
                </tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-white">{l.adminName}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{l.action}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{l.targetId.slice(0, 12)}</td>
                      <td className="px-4 py-3 text-gray-400">{l.details}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No admin actions logged yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-600">{sub}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'text-blue-400 bg-blue-500/10',
    in_progress: 'text-emerald-400 bg-emerald-500/10',
    completed: 'text-gray-400 bg-gray-500/10',
    cancelled: 'text-red-400 bg-red-500/10',
    draft: 'text-yellow-400 bg-yellow-500/10',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs ${colors[status] ?? 'text-gray-500 bg-gray-500/10'}`}>{status}</span>
}
