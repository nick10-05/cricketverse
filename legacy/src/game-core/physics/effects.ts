import type { BallPhysicsState, Vector3, PhysicsConfig } from './types'
import {
  vec3, vec3Scale, vec3Length,
  AIR_DENSITY, BALL_CROSS_SECTION, DRAG_COEFFICIENT,
  LIFT_COEFFICIENT, BALL_RADIUS,
} from './types'

export function calcDragForce(velocity: Vector3): Vector3 {
  const speed = vec3Length(velocity)
  if (speed < 0.01) return vec3(0, 0, 0)
  const dragMag = 0.5 * AIR_DENSITY * BALL_CROSS_SECTION * DRAG_COEFFICIENT * speed * speed
  const dir = vec3Scale(velocity, -1 / speed)
  return vec3Scale(dir, dragMag)
}

export function calcSpinForce(
  velocity: Vector3,
  angularVelocity: Vector3,
): Vector3 {
  const speed = vec3Length(velocity)
  if (speed < 0.01) return vec3(0, 0, 0)
  const spinMag = vec3Length(angularVelocity)
  if (spinMag < 0.01) return vec3(0, 0, 0)

  const velNorm = vec3Scale(velocity, 1 / speed)
  const cross = {
    x: angularVelocity.y * velNorm.z - angularVelocity.z * velNorm.y,
    y: angularVelocity.z * velNorm.x - angularVelocity.x * velNorm.z,
    z: angularVelocity.x * velNorm.y - angularVelocity.y * velNorm.x,
  }

  const liftMag = 0.5 * AIR_DENSITY * BALL_CROSS_SECTION * LIFT_COEFFICIENT * speed * speed * spinMag * BALL_RADIUS
  return vec3Scale(cross, liftMag)
}

export function calcLateSwingForce(
  velocity: Vector3,
  swingAmount: number,
  progress: number,
): Vector3 {
  if (swingAmount === 0) return vec3(0, 0, 0)

  const swingProgress = Math.max(0, (progress - 0.5) / 0.35)
  if (swingProgress <= 0) return vec3(0, 0, 0)

  const swingIntensity = Math.min(1, swingProgress * 2) * swingAmount
  const speed = vec3Length(velocity)
  const swingMag = speed * swingIntensity * 2.5

  return vec3(0, 0, swingMag)
}

export function resolveBounce(
  state: BallPhysicsState,
  pitchBounceFactor: number,
  pitchRoughness: number,
  spinRate: number,
  spinAxisZ: number,
): BallPhysicsState {
  const vy = state.velocity.y

  const bounceFactor = pitchBounceFactor * (0.85 + Math.random() * pitchRoughness * 0.15)
  const friction = 0.3 + pitchRoughness * 0.4

  const newVx = state.velocity.x * (1 - friction * 0.1)
  const newVy = -vy * bounceFactor
  const newVz = state.velocity.z + spinAxisZ * spinRate * 0.08 * (1 + pitchRoughness * 0.3)

  const spinDecay = 0.6 + Math.random() * pitchRoughness * 0.2
  const newAngVel = vec3Scale(state.angularVelocity, spinDecay)

  return {
    position: { ...state.position },
    velocity: vec3(newVx, Math.max(newVy, 0.5), newVz),
    rotation: state.rotation,
    angularVelocity: newAngVel,
    time: state.time,
    phase: 'post_bounce',
    bounceCount: state.bounceCount + 1,
    speed: vec3Length(vec3(newVx, Math.max(newVy, 0.5), newVz)),
  }
}

export function calcGroundFriction(state: BallPhysicsState): BallPhysicsState {
  if (state.position.y > 0.01 || state.phase !== 'post_bounce') return state

  const groundFriction = 0.85
  const newVx = state.velocity.x * groundFriction
  const newVz = state.velocity.z * groundFriction

  return {
    ...state,
    velocity: vec3(newVx, state.velocity.y, newVz),
  }
}

export function isBallPastStumps(state: BallPhysicsState): boolean {
  return state.position.x >= 19.0
}

export function normalizeDelivery(config: PhysicsConfig): PhysicsConfig {
  return {
    ...config,
    releaseSpeed: Math.max(20, Math.min(45, config.releaseSpeed)),
    releaseHeight: Math.max(1.5, Math.min(3.0, config.releaseHeight)),
    releaseAngle: Math.max(-10, Math.min(0, config.releaseAngle)),
    pitchBounceFactor: Math.max(0.1, Math.min(0.6, config.pitchBounceFactor)),
  }
}
