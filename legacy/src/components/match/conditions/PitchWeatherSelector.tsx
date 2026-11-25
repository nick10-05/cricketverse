import { useState } from 'react'
import { PITCH_DEFINITIONS, WEATHER, combineConditions, toPitchCondition } from '@/lib/match-conditions'
import type { WeatherType, CombinedCondition } from '@/lib/match-conditions'
import type { PitchCondition } from '@/lib/match-engine'

type Props = {
  pitchKey?: string
  weather?: WeatherType
  onChange: (pitch: PitchCondition, combined: CombinedCondition) => void
}

const pitchIcons: Record<string, string> = {
  batting: '🏏',
  bowling: '⚾',
  balanced: '⚖️',
  spinFriendly: '🔄',
  paceFriendly: '💨',
}

const weatherIcons: Record<string, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  humid: '💧',
}

export function PitchWeatherSelector({ pitchKey: initialPitch = 'balanced', weather: initialWeather = 'sunny', onChange }: Props) {
  const [pitchKey, setPitchKey] = useState(initialPitch)
  const [weather, setWeather] = useState<WeatherType>(initialWeather)

  const combined = combineConditions(pitchKey, weather)

  const selectPitch = (key: string) => {
    setPitchKey(key)
    const c = combineConditions(key, weather)
    onChange(toPitchCondition(c), c)
  }

  const selectWeather = (w: WeatherType) => {
    setWeather(w)
    const c = combineConditions(pitchKey, w)
    onChange(toPitchCondition(c), c)
  }

  return (
    <div className="space-y-6">
      {/* Pitch Selection */}
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-300">Pitch Type</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {Object.keys(PITCH_DEFINITIONS).map((key) => {
            const def = PITCH_DEFINITIONS[key]!
            return (
            <button
              key={key}
              onClick={() => selectPitch(key)}
              className={`rounded-xl border p-3 text-left transition-all ${
                pitchKey === key
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-sm shadow-emerald-500/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="mb-1 text-xl">{pitchIcons[key] ?? '🏟️'}</div>
              <div className={`text-sm font-medium ${pitchKey === key ? 'text-emerald-400' : 'text-gray-200'}`}>{def.label}</div>
              <div className="mt-1 text-xs text-gray-500">{def.description}</div>
            </button>
            )
          })}
        </div>
      </div>

      {/* Weather Selection */}
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-300">Weather</label>
        <div className="grid grid-cols-3 gap-3">
          {Object.keys(WEATHER).map((key) => {
            const wDef = WEATHER[key]!
            return (
            <button
              key={key}
              onClick={() => selectWeather(key as WeatherType)}
              className={`rounded-xl border p-3 text-left transition-all ${
                weather === key
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-sm shadow-emerald-500/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="mb-1 text-xl">{weatherIcons[key] ?? '🌤️'}</div>
              <div className={`text-sm font-medium ${weather === key ? 'text-emerald-400' : 'text-gray-200'}`}>
                {wDef.description.split(' — ')[0]}
              </div>
            </button>
            )
          })}
        </div>
      </div>

      {/* Combined Effects Display */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/30 p-4">
        <h4 className="mb-3 text-sm font-semibold text-gray-300">Match Conditions</h4>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ConditionBar label="Batting" value={combined.batting} color="emerald" />
          <ConditionBar label="Bowling" value={combined.bowling} color="blue" />
          <ConditionBar label="Pace Support" value={combined.paceSupport} color="amber" />
          <ConditionBar label="Spin Support" value={combined.spinSupport} color="purple" />
        </div>
        <p className="mt-3 text-sm italic text-gray-500">{combined.atmosphere}</p>
      </div>
    </div>
  )
}

function ConditionBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
  }
  const width = Math.round(value * 100)
  const level = width <= 25 ? 'Low' : width <= 50 ? 'Moderate' : width <= 75 ? 'High' : 'Very High'

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500">{level}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${colorMap[color] ?? 'bg-gray-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
