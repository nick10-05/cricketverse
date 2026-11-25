import { useState, useCallback } from 'react'
import { createSession, joinSession } from '../../game-core/networking/match-session'
import { TeamCoordinator } from '../../game-core/networking/team-coordinator'
import type { GameSession, NetworkPlayer } from '../../game-core/networking'

interface GameLobby2v2Props {
  currentPlayer: { id: string; name: string }
  onSessionCreated: (session: GameSession, role: string) => void
  onJoined: (session: GameSession, role: string) => void
}

export function GameLobby2v2({ currentPlayer, onSessionCreated, onJoined }: GameLobby2v2Props) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<'teamA' | 'teamB'>('teamA')
  const [teammateName, setTeammateName] = useState('')

  const handleCreate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const host: NetworkPlayer = {
        id: currentPlayer.id,
        name: currentPlayer.name,
        role: 'host',
        connected: true,
        ping: 0,
        teamId: selectedTeam,
      }

      const teamA: { playerIds: string[]; name: string } = selectedTeam === 'teamA'
        ? { playerIds: [currentPlayer.id], name: 'Team A' }
        : { playerIds: [], name: 'Team A' }

      const teamB: { playerIds: string[]; name: string } = selectedTeam === 'teamB'
        ? { playerIds: [currentPlayer.id], name: 'Team B' }
        : { playerIds: [], name: 'Team B' }

      const session = await createSession(host, '2v2', teamA, teamB)

      const coordinator = new TeamCoordinator('2v2', session.teamRoles ?? undefined)
      const role = coordinator.getTeamRole(currentPlayer.id, selectedTeam) ?? ''

      setCreatedCode(session.roomCode)
      onSessionCreated(session, role)
    } catch (err) {
      setError('Failed to create session')
    } finally {
      setLoading(false)
    }
  }, [currentPlayer, selectedTeam, onSessionCreated])

  const handleJoin = useCallback(async () => {
    if (roomCode.length < 4) return
    setLoading(true)
    setError(null)

    try {
      const player: NetworkPlayer = {
        id: currentPlayer.id,
        name: currentPlayer.name,
        role: 'guest',
        connected: true,
        ping: 0,
        teamId: selectedTeam,
      }

      const session = await joinSession(roomCode.toUpperCase(), player)
      if (!session) {
        setError('Room not found or full')
        return
      }

      const coordinator = new TeamCoordinator('2v2', session.teamRoles ?? undefined)
      const role = coordinator.getTeamRole(currentPlayer.id, selectedTeam) ?? ''

      onJoined(session, role)
    } catch (err) {
      setError('Failed to join session')
    } finally {
      setLoading(false)
    }
  }, [roomCode, selectedTeam, currentPlayer, onJoined])

  if (!mode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h1 className="text-3xl font-bold text-white">2v2 Quick Play</h1>
        <p className="text-gray-400 text-center max-w-md">
          Pair up with a teammate and challenge another duo.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => setMode('create')}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg transition-colors"
          >
            Create Team
          </button>
          <button
            onClick={() => setMode('join')}
            className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl text-lg transition-colors"
          >
            Join Match
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h2 className="text-2xl font-bold text-white">
        {mode === 'create' ? 'Create Your Team' : 'Join Match'}
      </h2>

      <div className="flex gap-4">
        <button
          onClick={() => setSelectedTeam('teamA')}
          className={`px-6 py-4 rounded-xl font-bold text-lg transition-colors ${
            selectedTeam === 'teamA'
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Team A
        </button>
        <button
          onClick={() => setSelectedTeam('teamB')}
          className={`px-6 py-4 rounded-xl font-bold text-lg transition-colors ${
            selectedTeam === 'teamB'
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Team B
        </button>
      </div>

      {mode === 'create' && (
        <input
          type="text"
          value={teammateName}
          onChange={(e) => setTeammateName(e.target.value)}
          placeholder="Teammate display name"
          maxLength={20}
          className="px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:border-emerald-500 outline-none w-64 text-center"
        />
      )}

      {mode === 'join' && (
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="Enter 6-letter code"
          maxLength={6}
          className="px-6 py-4 bg-gray-800 text-white text-2xl text-center tracking-[0.2em] font-bold rounded-xl border border-gray-700 focus:border-emerald-500 outline-none uppercase w-64"
        />
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="flex gap-3">
        <button
          onClick={mode === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white font-bold rounded-xl text-lg transition-colors"
        >
          {loading ? 'Processing...' : mode === 'create' ? 'Create Room' : 'Join'}
        </button>
      </div>

      {createdCode && (
        <div className="text-center space-y-2">
          <p className="text-gray-400">Room Code</p>
          <p className="text-4xl font-bold tracking-[0.3em] text-emerald-400">{createdCode}</p>
          <p className="text-gray-500 text-sm">Share this code with both players</p>
        </div>
      )}

      <button onClick={() => setMode(null)} className="text-gray-500 hover:text-gray-300 text-sm">
        Back
      </button>
    </div>
  )
}
