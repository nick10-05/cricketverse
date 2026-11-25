import type { ShotDirection } from '../batting/types'

export type FieldingZone =
  | 'wicket'
  | 'slip'
  | 'gully'
  | 'point'
  | 'cover'
  | 'mid_off'
  | 'mid_on'
  | 'mid_wicket'
  | 'square_leg'
  | 'fine_leg'
  | 'long_off'
  | 'long_on'
  | 'deep_cover'
  | 'deep_square_leg'
  | 'third_man'

export type FieldingAction =
  | 'catch'
  | 'ground_field'
  | 'throw'
  | 'run_out'
  | 'boundary_save'

export interface FielderEntry {
  playerId: string
  playerName: string
  position: FieldingZone
  catchingSkill: number
  throwingSkill: number
  reflexes: number
  stamina: number
  speed: number
}

export interface FieldingState {
  fielders: FielderEntry[]
  wicketKeeperId: string
  bowlerId: string
}

export interface CatchAttempt {
  fielder: FielderEntry
  difficulty: number
  successChance: number
  isOut: boolean
}

export interface GroundFieldResult {
  stopped: boolean
  runsSaved: number
  fielder: FielderEntry | null
}

export interface ThrowResult {
  accuracy: number
  speed: number
  hitStumps: boolean
}

export interface RunOutAttempt {
  throwResult: ThrowResult
  batterRunning: number
  out: boolean
}

export interface BoundarySaveResult {
  saved: boolean
  runsConceded: number
  fielder: FielderEntry | null
}

export const ZONE_TO_DIRECTION: Partial<Record<FieldingZone, ShotDirection[]>> = {
  wicket: ['straight'],
  slip: ['third_man'],
  gully: ['point'],
  point: ['point'],
  cover: ['cover'],
  mid_off: ['cover', 'straight'],
  mid_on: ['straight', 'mid_wicket'],
  mid_wicket: ['mid_wicket'],
  square_leg: ['square_leg'],
  fine_leg: ['fine_leg'],
  long_off: ['long_off', 'cover'],
  long_on: ['long_on', 'mid_wicket'],
  deep_cover: ['cover', 'long_off'],
  deep_square_leg: ['square_leg', 'mid_wicket'],
  third_man: ['third_man', 'point'],
}

export const ZONE_LABELS: Record<FieldingZone, string> = {
  wicket: 'Wicket Keeper',
  slip: 'Slips',
  gully: 'Gully',
  point: 'Point',
  cover: 'Cover',
  mid_off: 'Mid Off',
  mid_on: 'Mid On',
  mid_wicket: 'Mid Wicket',
  square_leg: 'Square Leg',
  fine_leg: 'Fine Leg',
  long_off: 'Long Off',
  long_on: 'Long On',
  deep_cover: 'Deep Cover',
  deep_square_leg: 'Deep Square Leg',
  third_man: 'Third Man',
}

export function defaultFieldingState(
  teamPlayers: { id: string; name: string; skills: { catching: number; accuracy: number; stamina: number } }[],
  bowlerId: string,
): FieldingState {
  const nonBowlerFields = teamPlayers.filter((p) => p.id !== bowlerId)
  const wk = nonBowlerFields[0]
  const rest = nonBowlerFields.slice(1, 11)

  const zoneOrder: FieldingZone[] = [
    'slip', 'gully', 'point', 'cover', 'mid_off',
    'mid_on', 'mid_wicket', 'square_leg', 'fine_leg', 'third_man',
  ]

  const fielders: FielderEntry[] = [
    {
      playerId: wk?.id ?? '',
      playerName: wk?.name ?? '',
      position: 'wicket',
      catchingSkill: (wk?.skills.catching ?? 70) / 100,
      throwingSkill: (wk?.skills.accuracy ?? 50) / 100,
      reflexes: (wk?.skills.catching ?? 70) / 100,
      stamina: (wk?.skills.stamina ?? 70) / 100,
      speed: 0.5,
    },
    ...rest.slice(0, 10).map((p, i) => ({
      playerId: p.id,
      playerName: p.name,
      position: zoneOrder[i] ?? 'third_man',
      catchingSkill: p.skills.catching / 100,
      throwingSkill: p.skills.accuracy / 100,
      reflexes: (p.skills.catching * 0.7 + p.skills.accuracy * 0.3) / 100,
      stamina: p.skills.stamina / 100,
      speed: 0.4 + (p.skills.stamina / 100) * 0.4,
    })),
  ]

  return { fielders, wicketKeeperId: wk?.id ?? '', bowlerId }
}

export function getFielderInZone(state: FieldingState, zone: FieldingZone): FielderEntry | null {
  return state.fielders.find((f) => f.position === zone) ?? null
}

export function getFieldersNearShot(
  state: FieldingState,
  direction: ShotDirection,
): { primary: FielderEntry | null; backups: FielderEntry[] } {
  const matched: { zone: FieldingZone; dist: number }[] = []

  for (const [zone, dirs] of Object.entries(ZONE_TO_DIRECTION)) {
    if (dirs?.includes(direction)) {
      matched.push({ zone: zone as FieldingZone, dist: 0 })
    }
  }

  const primary = matched.length > 0 ? getFielderInZone(state, matched[0].zone) : null
  const backups = state.fielders.filter(
    (f) => matched.some((m) => m.zone !== f.position) && f.position !== 'wicket',
  )

  return { primary, backups }
}
