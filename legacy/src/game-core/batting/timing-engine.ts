import type { TimingResult, BallApproach, BattingGesture } from './types'

const PERFECT_WINDOW_MS = 100
const GOOD_WINDOW_MS = 250
const MARGINAL_WINDOW_MS = 400

export function calcBallTravelTime(ball: BallApproach): number {
  const baseTime = 800
  const speedFactor = 1 - ball.speed * 0.4
  const lengthFactor: Record<string, number> = {
    yorker: 0.7,
    full: 0.85,
    good: 1.0,
    short: 1.2,
    bouncer: 1.3,
  }
  return Math.round(baseTime * speedFactor * (lengthFactor[ball.length] ?? 1))
}

export function evaluateTiming(
  gesture: BattingGesture,
  ballReleaseTime: number,
  ballApproach: BallApproach,
): TimingResult {
  const travelTime = calcBallTravelTime(ballApproach)
  const ballHittableStart = ballReleaseTime + travelTime * 0.3
  const ballHittableEnd = ballReleaseTime + travelTime * 0.7
  const perfectCenter = ballReleaseTime + travelTime * 0.5

  const swipeTime = (gesture.startTime + gesture.endTime) / 2
  const offset = Math.abs(swipeTime - perfectCenter)

  if (swipeTime < ballHittableStart) {
    return { quality: 'early', score: Math.max(0, 1 - offset / perfectCenter), feedback: 'Way too early!' }
  }
  if (swipeTime > ballHittableEnd) {
    return { quality: 'late', score: Math.max(0, 1 - offset / (travelTime * 0.3)), feedback: 'Too late!' }
  }
  if (offset <= PERFECT_WINDOW_MS) {
    return { quality: 'perfect', score: 1, feedback: 'Perfect timing!' }
  }
  if (offset <= GOOD_WINDOW_MS) {
    const score = 1 - (offset - PERFECT_WINDOW_MS) / (GOOD_WINDOW_MS - PERFECT_WINDOW_MS) * 0.3
    return { quality: 'perfect', score, feedback: 'Good timing' }
  }
  if (offset <= MARGINAL_WINDOW_MS) {
    const score = 0.7 - (offset - GOOD_WINDOW_MS) / (MARGINAL_WINDOW_MS - GOOD_WINDOW_MS) * 0.4
    return { quality: 'late', score: Math.max(0.3, score), feedback: 'Mistimed' }
  }
  return { quality: 'missed', score: 0.1, feedback: 'Missed it!' }
}

export function evaluateTimingSimple(
  gestureTimestamp: number,
  ballTimestamp: number,
  timingWindow: number,
): TimingResult {
  const diff = gestureTimestamp - ballTimestamp
  const absDiff = Math.abs(diff)

  if (absDiff <= PERFECT_WINDOW_MS) {
    const score = 1 - absDiff / PERFECT_WINDOW_MS * 0.1
    return { quality: 'perfect', score, feedback: 'Perfect timing!' }
  }
  if (absDiff <= GOOD_WINDOW_MS) {
    const score = 1 - (absDiff - PERFECT_WINDOW_MS) / (GOOD_WINDOW_MS - PERFECT_WINDOW_MS) * 0.3
    return { quality: 'perfect', score, feedback: 'Good timing' }
  }
  if (absDiff <= timingWindow) {
    const score = 0.7 - (absDiff - GOOD_WINDOW_MS) / (timingWindow - GOOD_WINDOW_MS) * 0.4
    return { quality: diff < 0 ? 'early' : 'late', score: Math.max(0.2, score), feedback: 'Mistimed' }
  }
  return { quality: 'missed', score: 0, feedback: 'Missed!' }
}
