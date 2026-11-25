import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getTournament, getTeams } from '@/lib/tournaments'
import {
  listenAuctionState,
  listenAuctionPlayers,
  listenBidHistory,
  listenTeamBudgets,
  updateAuctionState,
  updateAuctionPlayer,
  placeBid,
} from '@/lib/auction'
import type { Tournament, Team } from '@/types/tournament'
import type { AuctionState, AuctionPlayer, AuctionBid, TeamBudget } from '@/types/auction'
import { getBidIncrements } from '@/types/auction'

export function AuctionRoom() {
  const { id: tournamentId } = useParams<{ id: string }>()
  const { user } = useAuth()
  if (!user) return null
  const navigate = useNavigate()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [state, setState] = useState<AuctionState | null>(null)
  const [players, setPlayers] = useState<AuctionPlayer[]>([])
  const [bidHistory, setBidHistory] = useState<AuctionBid[]>([])
  const [budgets, setBudgets] = useState<TeamBudget[]>([])
  const [timer, setTimer] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [placingBid, setPlacingBid] = useState(false)

  const userTeam = teams.find((t) => t.ownerId === user.uid)
  const userBudget = budgets.find((b) => b.teamId === userTeam?.id)

  const currentPlayer = players.find((p) => p.id === state?.currentPlayerId)

  useEffect(() => {
    if (!tournamentId) return
    getTournament(tournamentId).then(setTournament)
    getTeams(tournamentId).then(setTeams)
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId) return
    const unsub1 = listenAuctionState(tournamentId, setState)
    const unsub2 = listenAuctionPlayers(tournamentId, setPlayers)
    const unsub3 = listenBidHistory(tournamentId, undefined, setBidHistory)
    const unsub4 = listenTeamBudgets(tournamentId, setBudgets)
    return () => { unsub1(); unsub2(); unsub3(); unsub4() }
  }, [tournamentId])

  const isCreator = tournament?.createdBy === user.uid
  const nextPending = players.find((p) => p.status === 'pending')

  const handleStartPlayer = async () => {
    if (!tournamentId || !nextPending) return
    const bp = nextPending.basePrice
    await updateAuctionState(tournamentId, {
      currentPlayerId: nextPending.id,
      currentBid: bp,
      currentBidderId: null,
      currentBidderTeamId: null,
      currentBidderTeamName: null,
    })
    await updateAuctionPlayer(tournamentId, nextPending.id, { status: 'active' })
  }

  const handleSellPlayer = async () => {
    if (!tournamentId || !state?.currentPlayerId) return
    const player = players.find((p) => p.id === state.currentPlayerId)
    if (!player) return

    if (state.currentBidderTeamId) {
      await updateAuctionPlayer(tournamentId, player.id, {
        status: 'sold',
        soldToTeamId: state.currentBidderTeamId,
        soldToTeamName: state.currentBidderTeamName,
        soldPrice: state.currentBid,
      })
    } else {
      await updateAuctionPlayer(tournamentId, player.id, { status: 'unsold' })
    }
    await updateAuctionState(tournamentId, { currentPlayerId: null, currentBid: 0, currentBidderId: null, currentBidderTeamId: null, currentBidderTeamName: null })
  }

  const handleEndAuction = async () => {
    if (!tournamentId) return
    await updateAuctionState(tournamentId, { status: 'completed', currentPlayerId: null })
    navigate(`/tournaments/${tournamentId}`)
  }

  // Timer
  useEffect(() => {
    if (!state || state.status !== 'active' || !state.currentPlayerId) {
      setTimer(0)
      return
    }
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleSellPlayer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [state?.currentPlayerId, state?.status])

  // Reset timer when bid changes
  const prevBidRef = useRef(state?.currentBid)
  useEffect(() => {
    if (state && state.currentBid !== prevBidRef.current) {
      prevBidRef.current = state.currentBid
      setTimer(15)
    }
  }, [state?.currentBid])

  const handleBid = async (amount: number) => {
    if (!tournamentId || !state?.currentPlayerId || !userTeam || placingBid) return
    setPlacingBid(true)
    setError(null)
    try {
      await placeBid(
        tournamentId,
        state.currentPlayerId,
        userTeam.id,
        userTeam.name,
        amount,
        state.currentBid,
        state.currentBidderTeamId,
      )
      setTimer(15)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bid failed')
    } finally {
      setPlacingBid(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <Link to={`/tournaments/${tournamentId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
        <span className="rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-1 text-xs font-medium text-gray-400">
          {state?.status === 'active' ? 'LIVE' : state?.status === 'paused' ? 'PAUSED' : state?.status === 'completed' ? 'COMPLETED' : 'SETUP'}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Panel */}
        <div className="space-y-6 lg:col-span-2">
          {/* Current Player */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center">
            {currentPlayer && state?.status === 'active' ? (
              <>
                <div className="mb-2 text-3xl font-bold text-white">{currentPlayer.name}</div>
                <div className="mb-1 text-sm text-gray-400 capitalize">{currentPlayer.role.replace('_', ' ')}</div>
                <div className="mb-4 text-lg font-mono text-yellow-400">Base: ₹{currentPlayer.basePrice}</div>
                <div className="mb-2 text-4xl font-bold text-green-400">₹{state.currentBid}</div>
                {state.currentBidderTeamName && (
                  <div className="text-sm text-gray-400">Current bidder: <span className="font-medium text-white">{state.currentBidderTeamName}</span></div>
                )}
                <div className={`mt-4 text-3xl font-bold tabular-nums ${timer <= 5 ? 'text-red-400' : 'text-white'}`}>{timer}s</div>

                {isCreator && (
                  <div className="mt-4 flex justify-center gap-3">
                    <button onClick={handleSellPlayer} className="cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-500">Sell</button>
                    <button onClick={() => updateAuctionState(tournamentId!, { status: 'paused' })} className="cursor-pointer rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">Pause</button>
                  </div>
                )}

                {!isCreator && userTeam && (
                  <div className="mt-6 space-y-2">
                    {error && <div className="text-sm text-red-400">{error}</div>}
                    <div className="flex flex-wrap justify-center gap-2">
                      {getBidIncrements(state.currentBid).map((amount) => (
                        <button key={amount} onClick={() => handleBid(amount)}
                          disabled={placingBid || (userBudget?.remaining ?? 0) < amount || userTeam.id === state.currentBidderTeamId}
                          className="cursor-pointer rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 font-mono text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed">
                          +₹{amount - state.currentBid}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : state?.status === 'active' && nextPending ? (
              <div className="py-8">
                <p className="text-gray-400">Next player ready: <span className="text-white font-medium">{nextPending.name}</span></p>
                {isCreator && (
                  <button onClick={handleStartPlayer} className="mt-4 cursor-pointer rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-500">
                    Start Player Auction
                  </button>
                )}
              </div>
            ) : state?.status === 'completed' ? (
              <div className="py-8">
                <p className="text-xl font-bold text-green-400">Auction Complete!</p>
              </div>
            ) : (
              <div className="py-8">
                <p className="text-gray-400">Waiting for auction to start...</p>
              </div>
            )}
          </div>

          {/* Auction Pool Queue */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Player Queue ({players.length})</h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {players.map((p) => {
                const isActive = p.id === state?.currentPlayerId
                return (
                  <div key={p.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      isActive ? 'border border-green-500/30 bg-green-500/5' : 'bg-gray-800/30'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">#{p.order}</span>
                      <span className={`font-medium ${isActive ? 'text-green-400' : 'text-white'}`}>{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <span className="text-xs text-gray-500">
                      {p.status === 'sold' ? `₹${p.soldPrice} → ${p.soldToTeamName}` : `₹${p.basePrice}`}
                    </span>
                  </div>
                )
              })}
            </div>
            {isCreator && state?.status === 'active' && state?.currentPlayerId && (
              <div className="mt-3 flex gap-2">
                <button onClick={handleSellPlayer} className="flex-1 cursor-pointer rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500">
                  {state.currentBidderTeamId ? 'Sell to Highest Bidder' : 'Mark Unsold'}
                </button>
              </div>
            )}
            {isCreator && state?.status === 'active' && !state?.currentPlayerId && !nextPending && (
              <button onClick={handleEndAuction} className="mt-3 w-full cursor-pointer rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500">
                End Auction
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Budgets */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Budgets</h3>
            <div className="space-y-2">
              {budgets.map((b) => {
                const isUser = b.teamId === userTeam?.id
                return (
                  <div key={b.teamId} className={`rounded-lg px-3 py-2 ${isUser ? 'bg-green-500/5 border border-green-500/20' : 'bg-gray-800/30'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isUser ? 'text-green-400' : 'text-white'}`}>{b.teamName}</span>
                      <span className="text-sm font-mono">{isUser ? <span className="text-green-400">₹{b.remaining}</span> : <span className="text-gray-400">₹{b.remaining}</span>}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-700">
                      <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${(b.spent / b.initialBudget) * 100}%` }} />
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-600">Spent: ₹{b.spent} / ₹{b.initialBudget}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bid History */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Bid History</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {bidHistory.length === 0 ? (
                <p className="text-xs text-gray-600">No bids yet</p>
              ) : (
                bidHistory.slice(0, 20).map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded bg-gray-800/20 px-2 py-1 text-xs">
                    <span className="text-gray-400">{b.teamName}</span>
                    <span className="font-mono text-yellow-400">₹{b.amount}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sold Players */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Sold Players</h3>
            <div className="space-y-1">
              {players.filter((p) => p.status === 'sold' || p.status === 'unsold').length === 0 ? (
                <p className="text-xs text-gray-600">No players sold yet</p>
              ) : (
                players.filter((p) => p.status === 'sold' || p.status === 'unsold').map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded bg-gray-800/20 px-2 py-1 text-xs">
                    <span className="text-gray-400">{p.name}</span>
                    <span className={p.status === 'sold' ? 'text-green-400' : 'text-red-400'}>
                      {p.status === 'sold' ? `₹${p.soldPrice}` : 'Unsold'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'text-gray-500 bg-gray-500/10',
    active: 'text-green-400 bg-green-500/10',
    sold: 'text-blue-400 bg-blue-500/10',
    unsold: 'text-red-400 bg-red-500/10',
  }
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[status] ?? ''}`}>{status}</span>
}
