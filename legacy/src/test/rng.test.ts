import { describe, it, expect } from 'vitest'
import { SeededRNG } from '@/lib/match-engine'

describe('SeededRNG', () => {
  it('produces deterministic sequences', () => {
    const rng1 = new SeededRNG(42)
    const rng2 = new SeededRNG(42)
    for (let i = 0; i < 10; i++) {
      expect(rng1.next()).toBe(rng2.next())
    }
  })

  it('produces different sequences for different seeds', () => {
    const rng1 = new SeededRNG(42)
    const rng2 = new SeededRNG(99)
    const seq1 = Array.from({ length: 5 }, () => rng1.next())
    const seq2 = Array.from({ length: 5 }, () => rng2.next())
    expect(seq1).not.toEqual(seq2)
  })

  it('int returns values in range', () => {
    const rng = new SeededRNG(1)
    for (let i = 0; i < 100; i++) {
      const val = rng.int(1, 6)
      expect(val).toBeGreaterThanOrEqual(1)
      expect(val).toBeLessThanOrEqual(6)
    }
  })

  it('chance returns true/false', () => {
    const rng = new SeededRNG(1)
    let trueCount = 0
    for (let i = 0; i < 1000; i++) {
      if (rng.chance(0.5)) trueCount++
    }
    // ~500 out of 1000
    expect(trueCount).toBeGreaterThan(300)
    expect(trueCount).toBeLessThan(700)
  })

  it('weightedIndex picks from weights', () => {
    const rng = new SeededRNG(1)
    const weights = [10, 80, 10]
    let counts = [0, 0, 0]
    for (let i = 0; i < 1000; i++) {
      const idx = rng.weightedIndex(weights)
      counts[idx]++
    }
    expect(counts[1]).toBeGreaterThan(counts[0])
    expect(counts[1]).toBeGreaterThan(counts[2])
  })
})
