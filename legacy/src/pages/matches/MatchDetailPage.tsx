import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { playMatch } from '@/lib/match-service'
import type { Match } from '@/types/tournament'
import type { MatchResult } from '@/lib/match-engine/types'

export function MatchDetailPage() {
  const { tournamentId, matchId } = useParams<{ tournamentId: string; matchId: string }>()

  const [match, setMatch] = useState<Match | null>(null)
  const [result, setResult] = useState<MatchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'scorecard' | 'commentary'>('scorecard')

  useEffect(() => {
    if (!tournamentId || !matchId) return
    const unsub = onSnapshot(doc(db, 'tournaments', tournamentId, 'matches', matchId), (snap) => {
      if (snap.exists()) {
        setMatch({ id: snap.id, ...snap.data() } as Match)
      }
      setLoading(false)
    })
    return unsub
  }, [tournamentId, matchId])

  useEffect(() => {
    if (!tournamentId || !matchId || !match) return
    if (match.status !== 'completed') return

    const load = async () => {
      const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'matches', matchId, 'result'))
      if (!snap.empty) {
        setResult(snap.docs[0].data() as MatchResult)
      }
    }
    load()
  }, [tournamentId, matchId, match])

  const handlePlay = async () => {
    if (!tournamentId || !match) return
    setPlaying(true)
    setError(null)
    try {
      const res = await playMatch(tournamentId, match, Date.now())
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to simulate match')
    } finally {
      setPlaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
        <p className="text-gray-400">Match not found</p>
        <button onClick={() => window.history.back()} className="mt-4 cursor-pointer text-sm text-green-400 hover:underline">
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="text-sm text-gray-400 hover:text-white"
          >
            &larr; Back to tournament
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            {match.teamAName} vs {match.teamBName}
          </h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            match.status === 'completed' ? 'bg-green-500/10 text-green-400'
            : match.status === 'live' ? 'bg-red-500/10 text-red-400'
            : 'bg-gray-500/10 text-gray-400'
          }`}>
            {match.status}
          </span>
        </div>

        {result && (
          <div className="mb-6 text-center">
            {result.winner ? (
              <p className="text-lg font-semibold text-green-400">
                {result.winner} won by {result.winMargin}
              </p>
            ) : (
              <p className="text-lg font-semibold text-yellow-400">{result.winMargin}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <p className="text-sm text-gray-400">{match.teamAName}</p>
            {match.teamAScore ? (
              <p className="text-3xl font-bold text-white">
                {match.teamAScore.runs}/{match.teamAScore.wickets}
                <span className="text-lg text-gray-500"> ({match.teamAScore.overs})</span>
              </p>
            ) : (
              <p className="text-gray-500">--/--</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">{match.teamBName}</p>
            {match.teamBScore ? (
              <p className="text-3xl font-bold text-white">
                {match.teamBScore.runs}/{match.teamBScore.wickets}
                <span className="text-lg text-gray-500"> ({match.teamBScore.overs})</span>
              </p>
            ) : (
              <p className="text-gray-500">--/--</p>
            )}
          </div>
        </div>

        {match.status === 'scheduled' && (
          <div className="mt-6 text-center">
            <button
              onClick={handlePlay}
              disabled={playing}
              className="cursor-pointer rounded-lg bg-green-600 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
            >
              {playing ? 'Playing...' : 'Play Match'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="flex gap-1 rounded-lg bg-gray-900 p-1">
            {(['scorecard', 'commentary'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 cursor-pointer rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  tab === t ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'scorecard' && <Scorecard result={result} />}
          {tab === 'commentary' && <Commentary result={result} />}
        </>
      )}
    </div>
  )
}

function Scorecard({ result }: { result: MatchResult }) {
  return (
    <div className="space-y-6">
      <InningsBox title={`${result.team1Name} Innings`} innings={result.innings1} />
      <InningsBox title={`${result.team2Name} Innings`} innings={result.innings2} />
    </div>
  )
}

function InningsBox({ title, innings }: { title: string; innings: MatchResult['innings1'] }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-sm text-gray-400">
          {innings.total}/{innings.wickets} ({innings.overs} ov, RR: {innings.runRate})
        </span>
      </div>

      <h3 className="mb-2 text-sm font-medium text-gray-400">Batting</h3>
      <div className="mb-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="py-2 pr-4">Batter</th>
              <th className="py-2 pr-4">Runs</th>
              <th className="py-2 pr-4">BF</th>
              <th className="py-2 pr-4">4s</th>
              <th className="py-2 pr-4">6s</th>
              <th className="py-2">SR</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {innings.battingStats.map((s) => (
              <tr key={s.playerId} className="border-b border-gray-800/50">
                <td className="py-2 pr-4">
                  {s.playerName}
                  {s.isOut && s.dismissal && (
                    <span className="ml-2 text-xs text-gray-500">({s.dismissal})</span>
                  )}
                  {!s.isOut && <span className="ml-2 text-xs text-green-500">not out</span>}
                </td>
                <td className="py-2 pr-4 font-medium text-white">{s.runs}</td>
                <td className="py-2 pr-4">{s.ballsFaced}</td>
                <td className="py-2 pr-4 text-blue-400">{s.fours}</td>
                <td className="py-2 pr-4 text-purple-400">{s.sixes}</td>
                <td className="py-2">{s.strikeRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 text-sm font-medium text-gray-400">Bowling</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="py-2 pr-4">Bowler</th>
              <th className="py-2 pr-4">O</th>
              <th className="py-2 pr-4">R</th>
              <th className="py-2 pr-4">W</th>
              <th className="py-2 pr-4">Econ</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {innings.bowlingStats.map((s) => (
              <tr key={s.playerId} className="border-b border-gray-800/50">
                <td className="py-2 pr-4">{s.playerName}</td>
                <td className="py-2 pr-4">{s.overs}</td>
                <td className="py-2 pr-4">{s.runsConceded}</td>
                <td className="py-2 pr-4 font-medium text-white">{s.wickets}</td>
                <td className="py-2">{s.economy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Commentary({ result }: { result: MatchResult }) {
  const allEvents = [
    ...result.innings1.ballEvents.map((e) => ({ ...e, inning: 1, team: result.team1Name })),
    ...result.innings2.ballEvents.map((e) => ({ ...e, inning: 2, team: result.team2Name })),
  ]

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Ball-by-Ball Commentary</h2>
      <div className="max-h-[600px] space-y-1 overflow-y-auto">
        {allEvents.map((e, i) => (
          <div key={i} className={`rounded-lg px-3 py-1.5 text-sm ${
            e.outcome.isWicket ? 'bg-red-500/10 text-red-300'
            : e.outcome.type === 'four' || e.outcome.type === 'six' ? 'bg-green-500/10 text-green-300'
            : e.outcome.isExtra ? 'bg-yellow-500/10 text-yellow-300'
            : 'text-gray-400'
          }`}>
            <span className="mr-2 font-mono text-xs text-gray-600">
              {e.inning === 1 ? '1st' : '2nd'} innings
            </span>
            <span className="mr-2 font-mono text-xs text-gray-500">
              {e.over}.{e.ballInOver}
            </span>
            {e.commentary}
          </div>
        ))}
      </div>
    </div>
  )
}
