import { useState, useEffect } from 'react'
import type { PlayerRankingEntry, TeamRankingEntry, TournamentRankingEntry } from '@/types/ranking'
import { getPlayerRankings, getTeamRankings, getTournamentRankings } from '@/lib/rankings'
import { RankingTable } from '@/components/rankings/RankingTable'
import { RankingBadge } from '@/components/rankings/RankingBadge'
import { RatingBar } from '@/components/rankings/RatingBar'
import { ROLE_LABELS } from '@/types/player'

type Tab = 'players' | 'teams' | 'tournaments'

const TABS: { key: Tab; label: string }[] = [
  { key: 'players', label: 'Players' },
  { key: 'teams', label: 'Teams' },
  { key: 'tournaments', label: 'Tournaments' },
]

const PLAYER_COLUMNS = [
  { key: 'rank', label: '#', render: (_: PlayerRankingEntry, i: number) => <RankingBadge rank={i + 1} />, className: 'w-12' },
  { key: 'name', label: 'Player', render: (p: PlayerRankingEntry) => (
    <div>
      <span className="font-medium text-white">{p.name}</span>
      <span className="ml-2 text-xs text-gray-500">{ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}</span>
    </div>
  )},
  { key: 'rating', label: 'Rating', render: (p: PlayerRankingEntry) => <RatingBar value={p.rating} color="emerald" /> },
  { key: 'xp', label: 'XP', render: (p: PlayerRankingEntry) => (
    <span className="text-sm text-gray-400">{p.totalXp.toLocaleString()}</span>
  )},
  { key: 'level', label: 'Lv', render: (p: PlayerRankingEntry) => (
    <span className="text-sm text-gray-400">{p.level}</span>
  )},
  { key: 'runs', label: 'Runs', render: (p: PlayerRankingEntry) => (
    <span className="text-sm text-gray-400">{p.totalRuns}</span>
  )},
  { key: 'wickets', label: 'Wkts', render: (p: PlayerRankingEntry) => (
    <span className="text-sm text-gray-400">{p.totalWickets}</span>
  )},
  { key: 'mom', label: 'MoM', render: (p: PlayerRankingEntry) => (
    <span className="text-sm text-gray-400">{p.manOfMatchCount}</span>
  )},
]

const TEAM_COLUMNS = [
  { key: 'rank', label: '#', render: (_: TeamRankingEntry, i: number) => <RankingBadge rank={i + 1} />, className: 'w-12' },
  { key: 'name', label: 'Team', render: (t: TeamRankingEntry) => (
    <div>
      <span className="font-medium text-white">{t.teamName}</span>
      <span className="ml-2 text-xs text-gray-500">{t.tournamentName}</span>
    </div>
  )},
  { key: 'rating', label: 'Rating', render: (t: TeamRankingEntry) => <RatingBar value={t.rating} color="blue" /> },
  { key: 'wins', label: 'W', render: (t: TeamRankingEntry) => <span className="text-sm text-gray-400">{t.matchesWon}</span> },
  { key: 'winPct', label: 'Win%', render: (t: TeamRankingEntry) => (
    <span className="text-sm text-gray-400">{t.winPercent}%</span>
  )},
  { key: 'nrr', label: 'NRR', render: (t: TeamRankingEntry) => (
    <span className={`text-sm ${t.nrr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{t.nrr.toFixed(2)}</span>
  )},
  { key: 'tourneyWins', label: 'Titles', render: (t: TeamRankingEntry) => (
    <span className="text-sm text-gray-400">{t.tournamentWins}</span>
  )},
]

const TOURNAMENT_COLUMNS = [
  { key: 'rank', label: '#', render: (_: TournamentRankingEntry, i: number) => <RankingBadge rank={i + 1} />, className: 'w-12' },
  { key: 'name', label: 'Tournament', render: (t: TournamentRankingEntry) => (
    <div>
      <span className="font-medium text-white">{t.name}</span>
      <span className="ml-2 text-xs text-gray-500">{t.format.replace('_', ' + ').toUpperCase()}</span>
    </div>
  )},
  { key: 'rating', label: 'Rating', render: (t: TournamentRankingEntry) => <RatingBar value={t.rating} color="purple" /> },
  { key: 'teams', label: 'Teams', render: (t: TournamentRankingEntry) => <span className="text-sm text-gray-400">{t.teamCount}</span> },
  { key: 'matches', label: 'Matches', render: (t: TournamentRankingEntry) => (
    <span className="text-sm text-gray-400">{t.completedMatches}/{t.totalMatches}</span>
  )},
  { key: 'overs', label: 'Overs', render: (t: TournamentRankingEntry) => <span className="text-sm text-gray-400">{t.overs}</span> },
]

export function RankingsPage() {
  const [tab, setTab] = useState<Tab>('players')
  const [players, setPlayers] = useState<PlayerRankingEntry[]>([])
  const [teams, setTeams] = useState<TeamRankingEntry[]>([])
  const [tournaments, setTournaments] = useState<TournamentRankingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const load = async () => {
      try {
        const [p, t, tr] = await Promise.all([
          getPlayerRankings(100),
          getTeamRankings(100),
          getTournamentRankings(100),
        ])
        setPlayers(p)
        setTeams(t)
        setTournaments(tr)
      } catch {
        // Offline or no data — show empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Global Rankings</h1>
        <p className="mt-1 text-sm text-gray-400">Leaderboards for players, teams, and tournaments across the platform.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-900 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {tab === 'players' && (
            <div className="space-y-4">
              {/* Sub-tabs: Overall / Batting / Bowling / Fielding */}
              <RankingTable columns={PLAYER_COLUMNS} data={players} emptyMessage="No player data yet. Play matches to earn ranking!" />
            </div>
          )}
          {tab === 'teams' && (
            <RankingTable columns={TEAM_COLUMNS} data={teams} emptyMessage="No team data yet. Create tournaments and play matches!" />
          )}
          {tab === 'tournaments' && (
            <RankingTable columns={TOURNAMENT_COLUMNS} data={tournaments} emptyMessage="No tournaments yet. Host a tournament to get ranked!" />
          )}
        </>
      )}
    </div>
  )
}
