import { describe, it, expect } from 'vitest'
import { xpRequiredForLevel, calculateLevel, calculateMatchXP } from '@/lib/progression'

describe('xpRequiredForLevel', () => {
  it('returns Infinity for level >= 100', () => {
    expect(xpRequiredForLevel(100)).toBe(Infinity)
    expect(xpRequiredForLevel(200)).toBe(Infinity)
  })

  it('returns finite XP for low levels', () => {
    const xp = xpRequiredForLevel(1)
    expect(xp).toBeGreaterThan(0)
    expect(xp).toBeLessThan(Infinity)
  })

  it('increases with level', () => {
    const l1 = xpRequiredForLevel(1)
    const l10 = xpRequiredForLevel(10)
    expect(l10).toBeGreaterThan(l1)
  })
})

describe('calculateLevel', () => {
  it('returns level 1 for 0 XP', () => {
    const info = calculateLevel(0)
    expect(info.level).toBe(1)
    expect(info.currentXp).toBe(0)
  })

  it('levels up at threshold', () => {
    const needed = xpRequiredForLevel(1)
    const atThreshold = calculateLevel(needed)
    expect(atThreshold.level).toBeGreaterThanOrEqual(2)
  })

  it('progress is between 0 and 1', () => {
    const info = calculateLevel(150)
    expect(info.progress).toBeGreaterThanOrEqual(0)
    expect(info.progress).toBeLessThanOrEqual(1)
  })
})

describe('calculateMatchXP', () => {
  const baseBatting = {
    playerId: 'p1',
    playerName: 'Test',
    runs: 30,
    ballsFaced: 20,
    fours: 3,
    sixes: 1,
    dotBalls: 8,
    strikeRate: 150,
    isOut: true,
    dismissal: 'caught' as const,
  }

  it('gives base XP for minimal contribution', () => {
    const xp = calculateMatchXP({
      battingStats: { ...baseBatting, runs: 0, fours: 0, sixes: 0 },
      isManOfMatch: false,
      isWinner: false,
      role: 'batsman',
    })
    expect(xp).toBeGreaterThanOrEqual(1)
  })

  it('awards bonus for runs and boundaries', () => {
    const low = calculateMatchXP({ battingStats: baseBatting, isManOfMatch: false, isWinner: false, role: 'batsman' })
    const high = calculateMatchXP({
      battingStats: { ...baseBatting, runs: 80, fours: 8, sixes: 4 },
      isManOfMatch: true,
      isWinner: true,
      role: 'batsman',
    })
    expect(high).toBeGreaterThan(low)
  })

  it('gives all_rounder multiplier', () => {
    const batsman = calculateMatchXP({ battingStats: baseBatting, isManOfMatch: false, isWinner: false, role: 'batsman' })
    const ar = calculateMatchXP({ battingStats: baseBatting, isManOfMatch: false, isWinner: false, role: 'all_rounder' })
    expect(ar).toBeGreaterThan(batsman)
  })
})
