import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getTournament, getTeams } from '@/lib/tournaments'
import { enableAuction, getAuctionSettings } from '@/lib/auction'
import { getUserPlayers } from '@/lib/players'
import {
  addPlayerToAuction,
  listenAuctionPlayers,
  removePlayerFromAuction,
  updateAuctionState,
} from '@/lib/auction'
import type { Tournament } from '@/types/tournament'
import type { Player } from '@/types/player'
import type { Team } from '@/types/tournament'
import type { AuctionSettings, AuctionPlayer } from '@/types/auction'
import { DEFAULT_AUCTION_SETTINGS } from '@/types/auction'
import { ALL_SKILLS } from '@/types/player'

export function AuctionSetup() {
  const { id: tournamentId } = useParams<{ id: string }>()
  const { user } = useAuth()
  if (!user) return null
  const navigate = useNavigate()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [_teams, setTeams] = useState<Team[]>([])
  const [settings, setSettings] = useState<AuctionSettings>(DEFAULT_AUCTION_SETTINGS)
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [auctionPlayers, setAuctionPlayers] = useState<AuctionPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'settings' | 'players'>('settings')

  useEffect(() => {
    if (!tournamentId) return
    const load = async () => {
      setLoading(true)
      const [t, tm, av] = await Promise.all([
        getTournament(tournamentId),
        getTeams(tournamentId),
        getUserPlayers(user.uid),
      ])
      setTournament(t)
      setTeams(tm)
      setAvailablePlayers(av)

      const existing = await getAuctionSettings(tournamentId)
      if (existing) setSettings({ ...DEFAULT_AUCTION_SETTINGS, ...existing })
      setLoading(false)
    }
    load()
  }, [tournamentId, user.uid])

  useEffect(() => {
    if (!tournamentId) return
    const unsub = listenAuctionPlayers(tournamentId, setAuctionPlayers)
    return unsub
  }, [tournamentId])

  const isCreator = tournament?.createdBy === user.uid
  if (!isCreator) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
        <p className="text-gray-400">Only the tournament creator can manage the auction</p>
        <Link to={`/tournaments/${tournamentId}`} className="mt-4 inline-block text-sm text-green-400 hover:underline">Back</Link>
      </div>
    )
  }

  const handleSaveSettings = async () => {
    if (!tournamentId) return
    setSaving(true)
    try {
      await enableAuction(tournamentId, settings)
    } finally {
      setSaving(false)
    }
  }

  const handleAddPlayer = async (player: Player) => {
    if (!tournamentId) return
    const overall = Math.round(ALL_SKILLS.reduce((s, k) => s + player.skills[k], 0) / ALL_SKILLS.length)
    const basePrice = Math.max(50, Math.round(overall * 3))
    await addPlayerToAuction(tournamentId, {
      playerId: player.id,
      name: player.name,
      role: player.role,
      skills: player.skills,
      overall,
      basePrice,
      order: auctionPlayers.length + 1,
    })
  }

  const handleRemovePlayer = async (playerDocId: string) => {
    if (!tournamentId) return
    await removePlayerFromAuction(tournamentId, playerDocId)
  }

  const handleStartAuction = async () => {
    if (!tournamentId || auctionPlayers.length < 2) return
    await enableAuction(tournamentId, settings)
    await updateAuctionState(tournamentId, {
      status: 'active',
      currentPlayerId: null,
      currentBid: 0,
      currentBidderId: null,
      currentBidderTeamId: null,
      currentBidderTeamName: null,
      round: 1,
    })
    navigate(`/tournaments/${tournamentId}/auction/room`)
  }

  const roleColours: Record<string, string> = {
    batsman: 'text-orange-400 bg-orange-500/10',
    bowler: 'text-blue-400 bg-blue-500/10',
    all_rounder: 'text-purple-400 bg-purple-500/10',
    wicket_keeper: 'text-yellow-400 bg-yellow-500/10',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/tournaments/${tournamentId}`} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to tournament
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-white">Auction Setup</h1>
      <p className="mb-6 text-sm text-gray-400">Configure the player auction for {tournament?.name}</p>

      <div className="mb-6 flex gap-1 rounded-lg bg-gray-900 p-1">
        {(['settings', 'players'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 cursor-pointer rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white' }`}>
            {t === 'settings' ? 'Settings' : `Players (${auctionPlayers.length})`}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div className="space-y-5 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Base Budget per Team</label>
            <input type="number" value={settings.baseBudget}
              onChange={(e) => setSettings({ ...settings, baseBudget: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Minimum Bid Increment</label>
            <input type="number" value={settings.minIncrement}
              onChange={(e) => setSettings({ ...settings, minIncrement: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Bid Timer (seconds)</label>
            <input type="number" value={settings.bidTimerSeconds}
              onChange={(e) => setSettings({ ...settings, bidTimerSeconds: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white outline-none focus:border-green-500" />
          </div>

          <button onClick={handleSaveSettings} disabled={saving}
            className="cursor-pointer rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          {auctionPlayers.length >= 2 && settings.enabled && (
            <button onClick={handleStartAuction}
              className="w-full cursor-pointer rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-500">
              Start Auction →
            </button>
          )}
        </div>
      )}

      {tab === 'players' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-300">My Players</h2>
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-gray-500">Create players first from the Players section</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {availablePlayers.map((p) => {
                  const added = auctionPlayers.some((ap) => ap.playerId === p.id)
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-white">{p.name}</span>
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${roleColours[p.role] ?? 'text-gray-400'}`}>
                          {p.role.replace('_', ' ')}
                        </span>
                      </div>
                      <button onClick={() => added ? null : handleAddPlayer(p)}
                        disabled={added}
                        className={`cursor-pointer rounded px-2 py-1 text-xs font-medium ${
                          added ? 'bg-gray-700 text-gray-500' : 'bg-green-600 text-white hover:bg-green-500' }`}>
                        {added ? 'Added' : 'Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-300">Auction Pool ({auctionPlayers.length})</h2>
            {auctionPlayers.length === 0 ? (
              <p className="text-sm text-gray-500">No players added to the auction pool yet</p>
            ) : (
              <div className="space-y-2">
                {auctionPlayers.map((ap) => (
                  <div key={ap.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">#{ap.order}</span>
                      <span className="text-sm font-medium text-white">{ap.name}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${roleColours[ap.role] ?? ''}`}>{ap.role.replace('_', ' ')}</span>
                      <span className="text-xs text-gray-400">{ap.overall} OVR</span>
                      <span className="text-xs font-mono text-yellow-400">₹{ap.basePrice}</span>
                    </div>
                    <button onClick={() => handleRemovePlayer(ap.id)}
                      className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
