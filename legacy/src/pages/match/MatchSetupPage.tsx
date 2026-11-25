import { useState } from 'react'
import { PitchWeatherSelector } from '@/components/match/conditions/PitchWeatherSelector'
import type { CombinedCondition } from '@/lib/match-conditions'
import type { PitchCondition } from '@/lib/match-engine'
import { simulateMatch } from '@/lib/match-engine'
import type { TeamLineup } from '@/lib/match-engine'

const defaultTeam1: TeamLineup = {
  name: 'Team Alpha',
  players: [],
  battingOrder: [],
}

const defaultTeam2: TeamLineup = {
  name: 'Team Beta',
  players: [],
  battingOrder: [],
}

export function MatchSetupPage() {
  const [pitch, setPitch] = useState<PitchCondition | null>(null)
  const [combined, setCombined] = useState<CombinedCondition | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const handleConditionsChange = (p: PitchCondition, c: CombinedCondition) => {
    setPitch(p)
    setCombined(c)
  }

  const handleSimulate = () => {
    if (!pitch) return
    const matchResult = simulateMatch(defaultTeam1, defaultTeam2, 5, pitch, Date.now())
    setResult(JSON.stringify(matchResult, null, 2))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Match Setup</h1>
        <p className="mt-1 text-sm text-gray-400">Configure pitch and weather conditions before the match.</p>
      </div>

      <PitchWeatherSelector onChange={handleConditionsChange} />

      {combined && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
          <h3 className="text-sm font-semibold text-gray-300">Selected: {combined.pitchLabel} / {combined.weatherLabel}</h3>
          <p className="text-xs text-gray-500">{combined.pitchDescription}</p>
          <p className="mt-1 text-xs text-gray-500">{combined.weatherDescription}</p>
        </div>
      )}

      <button
        onClick={handleSimulate}
        disabled={!pitch}
        className="w-full rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        Simulate Match
      </button>

      {result && (
        <pre className="overflow-auto rounded-xl border border-gray-700 bg-gray-900 p-4 text-xs text-gray-300">
          {result}
        </pre>
      )}
    </div>
  )
}
