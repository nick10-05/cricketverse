import { useState, useEffect } from 'react'
import { StatCard, BarChart, PieChart } from '@/components/analytics/charts'
import {
  getGlobalStats, getBattingLeaderboard, getBowlingLeaderboard,
  getTeamStats, getTournamentStats, getFormatDistribution,
  getStatusDistribution, getTopScorers, getTopWicketTakers,
} from '@/lib/analytics'
import type { GlobalStats, BattingRecord, BowlingRecord, TeamStats, TournamentStats, ChartDataPoint } from '@/types/analytics'

type Tab = 'overview' | 'batting' | 'bowling' | 'teams' | 'tournaments'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'batting', label: 'Batting' },
  { key: 'bowling', label: 'Bowling' },
  { key: 'teams', label: 'Teams' },
  { key: 'tournaments', label: 'Tournaments' },
]

export function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [batting, setBatting] = useState<BattingRecord[]>([])
  const [bowling, setBowling] = useState<BowlingRecord[]>([])
  const [teams, setTeams] = useState<TeamStats[]>([])
  const [tournaments, setTournaments] = useState<TournamentStats[]>([])
  const [formatDist, setFormatDist] = useState<ChartDataPoint[]>([])
  const [statusDist, setStatusDist] = useState<ChartDataPoint[]>([])
  const [topScorers, setTopScorers] = useState<ChartDataPoint[]>([])
  const [topWickets, setTopWickets] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getGlobalStats(), getBattingLeaderboard(10), getBowlingLeaderboard(10),
      getTeamStats(10), getTournamentStats(10),
      getFormatDistribution(), getStatusDistribution(),
      getTopScorers(10), getTopWicketTakers(10),
    ]).then(([gs, b, bw, t, tr, fd, sd, ts, tw]) => {
      setGlobalStats(gs); setBatting(b); setBowling(bw)
      setTeams(t); setTournaments(tr); setFormatDist(fd); setStatusDist(sd)
      setTopScorers(ts); setTopWickets(tw)
    }).finally(() => setLoading(false))
  }, [])

  const SPINNER = (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-gray-400">Stats, trends, and leaderboards across the platform.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-900 p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? SPINNER : (
        <>
          {/* ─── Overview ─── */}
          {tab === 'overview' && globalStats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total Runs" value={globalStats.totalRuns.toLocaleString()} icon="🏏" />
                <StatCard label="Total Wickets" value={globalStats.totalWickets} icon="🎯" />
                <StatCard label="Matches Played" value={globalStats.totalMatches} icon="📊" />
                <StatCard label="Tournaments" value={globalStats.totalTournaments} icon="🏆" />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Players" value={globalStats.totalPlayers} subtitle="registered" />
                <StatCard label="Fours" value={globalStats.totalFours} subtitle="total" />
                <StatCard label="Sixes" value={globalStats.totalSixes} subtitle="total" />
                <StatCard label="Centuries" value={globalStats.totalCenturies} subtitle={`${globalStats.totalFiveWickets} five-fors`} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <BarChart data={topScorers} title="Top Scorers" height={220} />
                <BarChart data={topWickets} title="Top Wicket Takers" height={220} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <PieChart data={formatDist} title="Tournament Formats" donut />
                <PieChart data={statusDist} title="Tournament Status" donut />
              </div>
            </div>
          )}

          {/* ─── Batting ─── */}
          {tab === 'batting' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-4 py-3 text-gray-400">#</th>
                  <th className="px-4 py-3 text-gray-400">Player</th>
                  <th className="px-4 py-3 text-gray-400">Matches</th>
                  <th className="px-4 py-3 text-gray-400">Runs</th>
                  <th className="px-4 py-3 text-gray-400">Avg</th>
                  <th className="px-4 py-3 text-gray-400">4s</th>
                  <th className="px-4 py-3 text-gray-400">6s</th>
                  <th className="px-4 py-3 text-gray-400">100s</th>
                </tr></thead>
                <tbody>
                  {batting.map((b, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-white">{b.name}</td>
                      <td className="px-4 py-3 text-gray-400">{b.matches}</td>
                      <td className="px-4 py-3 font-medium text-emerald-400">{b.runs}</td>
                      <td className="px-4 py-3 text-gray-400">{b.average}</td>
                      <td className="px-4 py-3 text-gray-400">{b.fours}</td>
                      <td className="px-4 py-3 text-gray-400">{b.sixes}</td>
                      <td className="px-4 py-3 text-gray-400">{b.centuries}</td>
                    </tr>
                  ))}
                  {batting.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No batting data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Bowling ─── */}
          {tab === 'bowling' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-4 py-3 text-gray-400">#</th>
                  <th className="px-4 py-3 text-gray-400">Player</th>
                  <th className="px-4 py-3 text-gray-400">Matches</th>
                  <th className="px-4 py-3 text-gray-400">Wickets</th>
                  <th className="px-4 py-3 text-gray-400">Avg</th>
                  <th className="px-4 py-3 text-gray-400">5-fors</th>
                </tr></thead>
                <tbody>
                  {bowling.map((b, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-white">{b.name}</td>
                      <td className="px-4 py-3 text-gray-400">{b.matches}</td>
                      <td className="px-4 py-3 font-medium text-blue-400">{b.wickets}</td>
                      <td className="px-4 py-3 text-gray-400">{b.average}</td>
                      <td className="px-4 py-3 text-gray-400">{b.fiveWickets}</td>
                    </tr>
                  ))}
                  {bowling.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No bowling data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Teams ─── */}
          {tab === 'teams' && (
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-4 py-3 text-gray-400">#</th>
                  <th className="px-4 py-3 text-gray-400">Team</th>
                  <th className="px-4 py-3 text-gray-400">Tournament</th>
                  <th className="px-4 py-3 text-gray-400">P</th>
                  <th className="px-4 py-3 text-gray-400">W</th>
                  <th className="px-4 py-3 text-gray-400">L</th>
                  <th className="px-4 py-3 text-gray-400">Win%</th>
                  <th className="px-4 py-3 text-gray-400">NRR</th>
                </tr></thead>
                <tbody>
                  {teams.map((t, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-white">{t.teamName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{t.tournamentName}</td>
                      <td className="px-4 py-3 text-gray-400">{t.matchesPlayed}</td>
                      <td className="px-4 py-3 text-emerald-400">{t.won}</td>
                      <td className="px-4 py-3 text-red-400">{t.lost}</td>
                      <td className="px-4 py-3 font-medium text-white">{t.winPercent}%</td>
                      <td className={`px-4 py-3 ${t.nrr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{t.nrr.toFixed(2)}</td>
                    </tr>
                  ))}
                  {teams.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No team data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Tournaments ─── */}
          {tab === 'tournaments' && (
            <div className="space-y-6">
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-gray-800 bg-gray-900/50">
                    <th className="px-4 py-3 text-gray-400">Name</th>
                    <th className="px-4 py-3 text-gray-400">Format</th>
                    <th className="px-4 py-3 text-gray-400">Matches</th>
                    <th className="px-4 py-3 text-gray-400">Completed</th>
                    <th className="px-4 py-3 text-gray-400">Completion</th>
                  </tr></thead>
                  <tbody>
                    {tournaments.map((t, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{t.format}</td>
                        <td className="px-4 py-3 text-gray-400">{t.totalMatches}</td>
                        <td className="px-4 py-3 text-gray-400">{t.completedMatches}</td>
                        <td className="px-4 py-3">
                          {t.totalMatches > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-700">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(t.completedMatches / t.totalMatches) * 100}%` }} />
                              </div>
                              <span className="text-xs text-gray-400">{Math.round((t.completedMatches / t.totalMatches) * 100)}%</span>
                            </div>
                          ) : <span className="text-xs text-gray-600">—</span>}
                        </td>
                      </tr>
                    ))}
                    {tournaments.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No tournament data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
