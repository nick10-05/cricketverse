import type { BattingGesture, SwipeDirection } from './types'
import { SWIPE_THRESHOLD_PX, SWIPE_MAX_TIME_MS } from './types'

export function recognizeGesture(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  startTime: number,
  endTime: number,
): BattingGesture {
  const dx = endX - startX
  const dy = endY - startY
  const distance = Math.sqrt(dx * dx + dy * dy)
  const elapsed = endTime - startTime

  if (distance < SWIPE_THRESHOLD_PX || elapsed > SWIPE_MAX_TIME_MS) {
    return {
      type: 'tap',
      startX, startY, endX, endY,
      startTime, endTime,
      speed: 0,
      direction: 'none',
      distance,
    }
  }

  const speed = distance / Math.max(elapsed, 1)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  let direction: SwipeDirection

  if (angle >= -22.5 && angle < 22.5) {
    direction = 'right'
  } else if (angle >= 22.5 && angle < 67.5) {
    direction = 'down_right'
  } else if (angle >= 67.5 && angle < 112.5) {
    direction = 'down'
  } else if (angle >= 112.5 && angle < 157.5) {
    direction = 'down_left'
  } else if (angle >= 157.5 || angle < -157.5) {
    direction = 'left'
  } else if (angle >= -157.5 && angle < -112.5) {
    direction = 'up_left'
  } else if (angle >= -112.5 && angle < -67.5) {
    direction = 'up'
  } else {
    direction = 'up_right'
  }

  return {
    type: 'swipe',
    startX, startY, endX, endY,
    startTime, endTime,
    speed: Math.round(speed * 100) / 100,
    direction,
    distance: Math.round(distance),
  }
}

export function getSwipeAngle(gesture: BattingGesture): number {
  const dx = gesture.endX - gesture.startX
  const dy = gesture.endY - gesture.startY
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

export function getGesturePower(gesture: BattingGesture): number {
  if (gesture.type === 'tap') return 0.2
  const maxSpeed = 2
  const rawPower = gesture.speed / maxSpeed
  return Math.min(1, Math.max(0, rawPower))
}

export function getGesturePrecision(gesture: BattingGesture): number {
  const idealSwipeDistance = 150
  const diff = Math.abs(gesture.distance - idealSwipeDistance)
  const penalty = diff / idealSwipeDistance
  return Math.max(0, Math.min(1, 1 - penalty * 0.5))
}
