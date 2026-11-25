import type { PitchCondition } from '@/lib/match-engine'
import type { WeatherType, WeatherDefinition, CombinedCondition, PitchDefinition } from './types'

export const WEATHER: Record<string, WeatherDefinition> = {
  sunny: {
    battingMod: 1.0,
    bowlingMod: 1.0,
    swingMod: 1.0,
    spinMod: 1.0,
    atmosphere: 'Clear skies, ideal conditions.',
    description: 'Sunny — neutral conditions',
  },
  cloudy: {
    battingMod: 0.9,
    bowlingMod: 1.1,
    swingMod: 1.35,
    spinMod: 1.0,
    atmosphere: 'Overcast. The ball will swing for pacers.',
    description: 'Cloudy — swing assistance for pacers, batting tougher',
  },
  humid: {
    battingMod: 0.85,
    bowlingMod: 1.15,
    swingMod: 1.2,
    spinMod: 1.3,
    atmosphere: 'Thick air. Pacers get swing, spinners get grip.',
    description: 'Humid — swing & spin assistance, batting difficult',
  },
}

export const PITCH_DEFINITIONS: Record<string, PitchDefinition> = {
  batting: {
    label: 'Batting Pitch',
    description: 'True bounce, fast outfield. A paradise for batsmen.',
    batting: 0.8,
    bowling: 0.2,
    paceSupport: 0.4,
    spinSupport: 0.3,
  },
  bowling: {
    label: 'Bowling Pitch',
    description: 'Lively surface with movement for bowlers.',
    batting: 0.2,
    bowling: 0.8,
    paceSupport: 0.65,
    spinSupport: 0.5,
  },
  balanced: {
    label: 'Balanced Pitch',
    description: 'Even contest between bat and ball.',
    batting: 0.5,
    bowling: 0.5,
    paceSupport: 0.5,
    spinSupport: 0.5,
  },
  spinFriendly: {
    label: 'Spin Friendly',
    description: 'Dry surface with grip. Spinners will enjoy this.',
    batting: 0.3,
    bowling: 0.7,
    paceSupport: 0.3,
    spinSupport: 0.85,
  },
  paceFriendly: {
    label: 'Pace Friendly',
    description: 'Green-tinged with bounce and carry. Made for pacers.',
    batting: 0.3,
    bowling: 0.7,
    paceSupport: 0.85,
    spinSupport: 0.3,
  },
}

export function getWeatherAtmosphere(weather: WeatherType): string {
  return WEATHER[weather]?.atmosphere ?? ''
}

export function getWeatherModLabel(weather: WeatherType): string {
  const labels: Record<WeatherType, string> = {
    sunny: 'Sunny',
    cloudy: 'Cloudy',
    humid: 'Humid',
  }
  return labels[weather] ?? 'Sunny'
}

export function isWeatherDefault(weather: WeatherType): boolean {
  return weather === 'sunny'
}

export function combineConditions(
  pitchKey: string,
  weather: WeatherType,
): CombinedCondition {
  const pitchDef = PITCH_DEFINITIONS[pitchKey]
  const weatherDef = WEATHER[weather]

  if (!pitchDef || !weatherDef) {
    throw new Error(`Invalid pitch (${pitchKey}) or weather (${weather})`)
  }

  return {
    batting: clamp(pitchDef.batting * weatherDef.battingMod),
    bowling: clamp(pitchDef.bowling * weatherDef.bowlingMod),
    paceSupport: clamp(pitchDef.paceSupport * weatherDef.swingMod),
    spinSupport: clamp(pitchDef.spinSupport * weatherDef.spinMod),
    pitchType: pitchKey,
    weatherType: weather,
    pitchLabel: pitchDef.label,
    weatherLabel: getWeatherModLabel(weather),
    pitchDescription: pitchDef.description,
    weatherDescription: weatherDef.description,
    atmosphere: weatherDef.atmosphere,
  }
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export function toPitchCondition(combined: CombinedCondition): PitchCondition {
  return {
    batting: combined.batting,
    bowling: combined.bowling,
    paceSupport: combined.paceSupport,
    spinSupport: combined.spinSupport,
    label: `${combined.pitchLabel} / ${combined.weatherLabel}`,
  }
}
