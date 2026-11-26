import { describe, expect, it } from 'vitest'
import { ambienceGain, DEFAULT_VOLUMES, jitter, loadVolumes, makePicker, saveVolumes } from './audioMix'

function memStore() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

describe('audio mix helpers', () => {
  it('saves and loads volumes, clamping bad values', () => {
    const s = memStore()
    expect(loadVolumes(s)).toEqual(DEFAULT_VOLUMES)
    saveVolumes(s, { ambience: 0.2, crowd: 1, sfx: 0.5 })
    expect(loadVolumes(s)).toEqual({ ambience: 0.2, crowd: 1, sfx: 0.5 })
    s.setItem('cvx-volumes', JSON.stringify({ ambience: 3, crowd: -1, sfx: 'loud' }))
    expect(loadVolumes(s)).toEqual({ ambience: 1, crowd: 0, sfx: DEFAULT_VOLUMES.sfx })
    s.setItem('cvx-volumes', '{not json')
    expect(loadVolumes(s)).toEqual(DEFAULT_VOLUMES)
    expect(loadVolumes(null)).toEqual(DEFAULT_VOLUMES)
  })

  it('never picks the same variant twice in a row', () => {
    const pick = makePicker()
    let prev = -1
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) {
      const v = pick('wood', 4)
      expect(v).not.toBe(prev)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(4)
      seen.add(v)
      prev = v
    }
    expect(seen.size).toBe(4)
    expect(pick('one', 1)).toBe(0)
  })

  it('keeps jitter within its spread and ambience gain gentle', () => {
    for (let i = 0; i < 200; i++) {
      const v = jitter(1, 0.05)
      expect(v).toBeGreaterThanOrEqual(0.95)
      expect(v).toBeLessThanOrEqual(1.05)
    }
    expect(ambienceGain(0.12)).toBeLessThan(ambienceGain(0.44))
    expect(ambienceGain(5)).toBeLessThanOrEqual(1.2)
    expect(ambienceGain(-1)).toBeGreaterThan(0)
  })
})
