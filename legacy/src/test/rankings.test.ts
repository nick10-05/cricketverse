import { describe, it, expect } from 'vitest'
import { calcBattingRating, calcBowlingRating, calcPlayerRating } from '@/lib/rankings'

describe('calcBattingRating', () => {
  it('returns 0 for zero runs/matches', () => {
    expect(calcBattingRating(0, 0, 0, 0, 0)).toBe(0)
  })

  it('increases with runs and centuries', () => {
    const low = calcBattingRating(100, 10, 0, 5, 1)
    const high = calcBattingRating(500, 10, 1, 20, 5)
    expect(high).toBeGreaterThan(low)
  })

  it('caps at 500', () => {
    const rating = calcBattingRating(10000, 100, 20, 200, 50)
    expect(rating).toBeLessThanOrEqual(500)
  })
})

describe('calcBowlingRating', () => {
  it('returns 0 for zero wickets/matches', () => {
    expect(calcBowlingRating(0, 0, 0)).toBe(0)
  })

  it('increases with wickets and five-fors', () => {
    const low = calcBowlingRating(5, 10, 0)
    const high = calcBowlingRating(50, 10, 2)
    expect(high).toBeGreaterThan(low)
  })

  it('caps at 500', () => {
    const rating = calcBowlingRating(500, 100, 20)
    expect(rating).toBeLessThanOrEqual(500)
  })
})

describe('calcPlayerRating', () => {
  it('returns 0 when all inputs are 0', () => {
    const r = calcPlayerRating('batsman', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    expect(r.overall).toBe(0)
  })

  it('weights batting more for batsmen', () => {
    const batsman = calcPlayerRating('batsman', 500, 100, 50, 10, 2, 2, 20, 5, 5, 1)
    const bowler = calcPlayerRating('bowler', 500, 100, 50, 10, 2, 2, 20, 5, 5, 1)
    expect(batsman.overall).not.toBe(bowler.overall)
  })

  it('gives all_rounder balanced weighting', () => {
    const r = calcPlayerRating('all_rounder', 500, 500, 500, 10, 2, 2, 20, 5, 5, 1)
    expect(r.overall).toBeGreaterThan(0)
    expect(r.overall).toBeLessThanOrEqual(1000)
  })

  it('caps overall at 1000', () => {
    const r = calcPlayerRating('batsman', 50000, 5000, 5000, 500, 100, 100, 500, 200, 100, 100)
    expect(r.overall).toBeLessThanOrEqual(1000)
  })
})
