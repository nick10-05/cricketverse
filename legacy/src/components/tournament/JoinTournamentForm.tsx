import { useState, type FormEvent } from 'react'

type Props = {
  onSubmit: (roomCode: string, teamName: string) => Promise<void>
  loading: boolean
}

export function JoinTournamentForm({ onSubmit, loading }: Props) {
  const [roomCode, setRoomCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canSubmit = roomCode.length === 6 && teamName.trim().length > 0 && !loading

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!canSubmit) return
    try {
      await onSubmit(roomCode.toUpperCase(), teamName.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join tournament')
    }
  }

  const handleCodeChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setRoomCode(cleaned)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-gray-300">
          Room Code
        </label>
        <input
          id="code"
          type="text"
          value={roomCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="X7K2M9"
          maxLength={6}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder-gray-600 outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label htmlFor="teamName" className="mb-1.5 block text-sm font-medium text-gray-300">
          Your Team Name
        </label>
        <input
          id="teamName"
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="e.g. Mumbai Strikers"
          maxLength={50}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white placeholder-gray-500 outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full cursor-pointer rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Joining...' : 'Join Tournament'}
      </button>
    </form>
  )
}
