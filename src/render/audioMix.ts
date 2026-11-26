/**
 * Pure helpers for the sound engine: volume settings, variant rotation and level maths.
 * Kept free of Web Audio so they can be unit tested.
 */

export type Bus = 'ambience' | 'crowd' | 'sfx'
export type Volumes = Record<Bus, number>

export const BUSES: Bus[] = ['ambience', 'crowd', 'sfx']
export const DEFAULT_VOLUMES: Volumes = { ambience: 0.6, crowd: 0.7, sfx: 0.8 }
const KEY = 'cvx-volumes'

/** Base loudness of each bus at 100 % on its slider, balanced so nothing drowns the bat. */
export const BUS_TRIM: Volumes = { ambience: 0.55, crowd: 0.5, sfx: 0.85 }

export function clamp01(v: number) {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
}

export function loadVolumes(store: Pick<Storage, 'getItem'> | null): Volumes {
  const v = { ...DEFAULT_VOLUMES }
  try {
    const raw = store?.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Record<string, unknown>>
      for (const b of BUSES) if (typeof p[b] === 'number') v[b] = clamp01(p[b] as number)
    }
  } catch {
    /* corrupt or blocked storage: use defaults */
  }
  return v
}

export function saveVolumes(store: Pick<Storage, 'setItem'> | null, v: Volumes) {
  try {
    store?.setItem(KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

/** Picks variant indexes at random without playing the same one twice in a row. */
export function makePicker(rng: () => number = Math.random) {
  const last = new Map<string, number>()
  return (key: string, n: number) => {
    if (n <= 1) return 0
    const prev = last.get(key)
    let i = Math.floor(rng() * (prev === undefined ? n : n - 1))
    if (prev !== undefined && i >= prev) i++
    last.set(key, i)
    return i
  }
}

/** Random value in base ± spread (used for pitch and gain variation). */
export function jitter(base: number, spread: number, rng: () => number = Math.random) {
  return base + (rng() * 2 - 1) * spread
}

/**
 * The game asks for crowd "levels" from 0.12 (quiet murmur) to about 0.45 (ball in the air,
 * boundary). This maps them to a gentle gain on the ambience bed.
 */
export function ambienceGain(level: number) {
  const l = Math.min(0.6, Math.max(0, level))
  return 0.35 + l * 1.3
}
