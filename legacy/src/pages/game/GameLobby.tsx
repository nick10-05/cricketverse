import { useState, useCallback } from 'react'
import { createSession, joinSession, type GameSession } from '../../game-core/networking'
import type { NetworkPlayer } from '../../game-core/networking'

interface GameLobbyProps {
  currentPlayer: { id: string; name: string }
  onSessionCreated: (session: GameSession) => void
  onJoined: (session: GameSession) => void
}

export function GameLobby({ currentPlayer, onSessionCreated, onJoined }: GameLobbyProps) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [format, setFormat] = useState<'1v1' | '2v2'>('1v1')

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
        teamId: 'teamA',
      }

      const session = await createSession(
        host,
        format,
        { playerIds: [currentPlayer.id], name: 'Team A' },
        { playerIds: [], name: 'Team B' },
      )

      setCreatedCode(session.roomCode)
      onSessionCreated(session)
    } catch (err) {
      setError('Failed to create session')
    } finally {
      setLoading(false)
    }
  }, [currentPlayer, format, onSessionCreated])

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
        teamId: 'teamB',
      }

      const session = await joinSession(roomCode.toUpperCase(), player)
      if (!session) {
        setError('Room not found or full')
        return
      }
      onJoined(session)
    } catch (err) {
      setError('Failed to join session')
    } finally {
      setLoading(false)
    }
  }, [roomCode, currentPlayer, onJoined])

  if (!mode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h1 className="text-3xl font-bold text-white">Quick Play</h1>
        <p className="text-gray-400 text-center max-w-md">
          Create a match or join a friend's game using a room code.
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => setMode('create')}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg transition-colors"
          >
            Create Match
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

  if (mode === 'create') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-bold text-white">Create Match</h2>

        <div className="flex gap-3">
          {(['1v1', '2v2'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-6 py-3 rounded-xl font-bold transition-colors ${
                format === f ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white font-bold rounded-xl text-lg transition-colors"
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>

        {createdCode && (
          <div className="text-center space-y-2">
            <p className="text-gray-400">Room Code</p>
            <p className="text-4xl font-bold tracking-[0.3em] text-emerald-400">{createdCode}</p>
            <p className="text-gray-500 text-sm">Share this code with a friend</p>
          </div>
        )}

        <button onClick={() => setMode(null)} className="text-gray-500 hover:text-gray-300 text-sm">
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h2 className="text-2xl font-bold text-white">Join Match</h2>

      <input
        type="text"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        placeholder="Enter 6-letter code"
        maxLength={6}
        className="px-6 py-4 bg-gray-800 text-white text-2xl text-center tracking-[0.2em] font-bold rounded-xl border border-gray-700 focus:border-emerald-500 outline-none uppercase w-64"
      />

      {error && <div className="text-red-400 text-sm">{error}</div>}

      <button
        onClick={handleJoin}
        disabled={loading || roomCode.length < 4}
        className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white font-bold rounded-xl text-lg transition-colors"
      >
        {loading ? 'Joining...' : 'Join'}
      </button>

      <button onClick={() => setMode(null)} className="text-gray-500 hover:text-gray-300 text-sm">
        Back
      </button>
    </div>
  )
}
