export type WeatherType = 'sunny' | 'cloudy' | 'humid'

export interface WeatherDefinition {
  battingMod: number
  bowlingMod: number
  swingMod: number
  spinMod: number
  atmosphere: string
  description: string
}

export interface CombinedCondition {
  batting: number
  bowling: number
  paceSupport: number
  spinSupport: number
  pitchType: string
  weatherType: WeatherType
  pitchLabel: string
  weatherLabel: string
  pitchDescription: string
  weatherDescription: string
  atmosphere: string
}

export interface PitchDefinition {
  label: string
  description: string
  batting: number
  bowling: number
  paceSupport: number
  spinSupport: number
}
