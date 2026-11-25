export const GRAVITY = 9.81
export const AIR_DENSITY = 1.225
export const BALL_MASS = 0.163
export const BALL_RADIUS = 0.036
export const BALL_CROSS_SECTION = Math.PI * BALL_RADIUS * BALL_RADIUS
export const DRAG_COEFFICIENT = 0.47
export const LIFT_COEFFICIENT = 0.15
export const PITCH_LENGTH = 20.12
export const BOUNCER_HEIGHT = 1.4
export const RELEASE_HEIGHT = 2.5
export const STUMPS_HEIGHT = 0.72
export const CREASE_TO_WICKET = 1.22
export const MAX_TRAJECTORY_POINTS = 256
export const PHYSICS_DT = 1 / 120

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface BallPhysicsState {
  position: Vector3
  velocity: Vector3
  rotation: Vector3
  angularVelocity: Vector3
  time: number
  phase: 'flight' | 'bounce' | 'post_bounce'
  bounceCount: number
  speed: number
}

export interface PhysicsConfig {
  releaseSpeed: number
  releaseHeight: number
  releaseAngle: number
  lateralAngle: number
  swingAmount: number
  swingDelay: number
  spinRate: number
  spinAxis: Vector3
  pitchFriction: number
  pitchBounceFactor: number
  pitchRoughness: number
  airDensity: number
  ballMass: number
  seamAngle: number
}

export interface BounceResult {
  position: Vector3
  velocity: Vector3
  spinEffect: number
  bounceHeight: number
  time: number
}

export interface TrajectoryPoint {
  position: Vector3
  velocity: Vector3
  time: number
  phase: 'flight' | 'bounce' | 'post_bounce'
  speed: number
}

export interface TrajectoryResult {
  points: TrajectoryPoint[]
  totalTime: number
  maxHeight: number
  maxLateral: number
  bouncePoint: TrajectoryPoint | null
  arrivalPoint: TrajectoryPoint | null
  arrivalTime: number
  finalSpeed: number
}

export function vec3(x: number, y: number, z: number): Vector3 {
  return { x, y, z }
}

export function vec3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function vec3Sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function vec3Scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

export function vec3Length(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

export function vec3Normalize(v: Vector3): Vector3 {
  const len = vec3Length(v)
  if (len === 0) return { x: 0, y: 0, z: 0 }
  return vec3Scale(v, 1 / len)
}

export function vec3Dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function vec3Cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

export function metersToPixels(meters: number, scale: number): number {
  return meters * scale
}
