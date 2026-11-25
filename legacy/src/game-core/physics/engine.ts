import type { BallPhysicsState, PhysicsConfig, TrajectoryResult, TrajectoryPoint } from './types'
import {
  vec3, vec3Add, vec3Scale, vec3Length,
  GRAVITY, BALL_MASS, PHYSICS_DT,
  PITCH_LENGTH, RELEASE_HEIGHT, MAX_TRAJECTORY_POINTS,
} from './types'
import {
  calcDragForce, calcSpinForce, calcLateSwingForce,
  resolveBounce, calcGroundFriction, normalizeDelivery,
} from './effects'

export function createBallState(config: PhysicsConfig): BallPhysicsState {
  const speed = config.releaseSpeed
  const angleRad = (config.releaseAngle * Math.PI) / 180
  const lateralRad = (config.lateralAngle * Math.PI) / 180

  return {
    position: vec3(0, config.releaseHeight, 0),
    velocity: vec3(
      speed * Math.cos(angleRad) * Math.cos(lateralRad),
      speed * Math.sin(angleRad),
      speed * Math.cos(angleRad) * Math.sin(lateralRad),
    ),
    rotation: vec3(0, 0, 0),
    angularVelocity: vec3(
      config.spinRate * config.spinAxis.x * 2 * Math.PI,
      config.spinRate * config.spinAxis.y * 2 * Math.PI,
      config.spinRate * config.spinAxis.z * 2 * Math.PI,
    ),
    time: 0,
    phase: 'flight',
    bounceCount: 0,
    speed,
  }
}

export function stepPhysics(
  state: BallPhysicsState,
  config: PhysicsConfig,
  dt: number,
): BallPhysicsState {
  const subSteps = 4
  const subDt = dt / subSteps
  let current = { ...state }

  for (let i = 0; i < subSteps; i++) {
    current = stepSub(current, config, subDt)
  }

  return current
}

function stepSub(
  state: BallPhysicsState,
  config: PhysicsConfig,
  dt: number,
): BallPhysicsState {
  const mass = BALL_MASS
  const isFlight = state.phase === 'flight'

  const dragForce = isFlight ? calcDragForce(state.velocity) : vec3(0, 0, 0)
  const spinForce = isFlight ? calcSpinForce(state.velocity, state.angularVelocity) : vec3(0, 0, 0)

  const progress = state.position.x / PITCH_LENGTH
  const swingForce = isFlight ? calcLateSwingForce(state.velocity, config.swingAmount, progress) : vec3(0, 0, 0)

  const gravityForce = isFlight ? vec3(0, -mass * GRAVITY, 0) : vec3(0, 0, 0)

  const totalForce = vec3Add(vec3Add(dragForce, spinForce), vec3Add(swingForce, gravityForce))
  const acceleration = vec3Scale(totalForce, 1 / mass)

  const newVelocity = vec3Add(state.velocity, vec3Scale(acceleration, dt))
  const newPosition = vec3Add(state.position, vec3Scale(newVelocity, dt))

  let newState: BallPhysicsState = {
    ...state,
    position: newPosition,
    velocity: newVelocity,
    time: state.time + dt,
    speed: vec3Length(newVelocity),
  }

  if (isFlight && newPosition.y <= 0 && state.velocity.y < 0) {
    newState = resolveBounce(
      newState,
      config.pitchBounceFactor,
      config.pitchRoughness,
      config.spinRate,
      config.spinAxis.z,
    )
  }

  if (newState.phase === 'post_bounce') {
    newState = calcGroundFriction(newState)
  }

  return newState
}

export function simulateDelivery(config: PhysicsConfig): TrajectoryResult {
  const normalizedConfig = normalizeDelivery(config)
  let state = createBallState(normalizedConfig)
  const points: TrajectoryPoint[] = []
  let bouncePoint: TrajectoryPoint | null = null
  let arrivalPoint: TrajectoryPoint | null = null
  let maxHeight = state.position.y
  let maxLateral = 0
  let stepCount = 0

  points.push({
    position: { ...state.position },
    velocity: { ...state.velocity },
    time: state.time,
    phase: state.phase,
    speed: state.speed,
  })

  while (state.position.x < PITCH_LENGTH && stepCount < MAX_TRAJECTORY_POINTS) {
    state = stepPhysics(state, normalizedConfig, PHYSICS_DT)
    stepCount++

    if (state.position.y > maxHeight) maxHeight = state.position.y
    if (Math.abs(state.position.z) > maxLateral) maxLateral = Math.abs(state.position.z)

    if (state.phase === 'bounce' && !bouncePoint) {
      bouncePoint = {
        position: { ...state.position },
        velocity: { ...state.velocity },
        time: state.time,
        phase: 'bounce',
        speed: state.speed,
      }
    }

    if (state.position.x < PITCH_LENGTH || Math.abs(state.position.x - PITCH_LENGTH) < 0.1) {
      points.push({
        position: { ...state.position },
        velocity: { ...state.velocity },
        time: state.time,
        phase: state.phase,
        speed: state.speed,
      })
    }
  }

  arrivalPoint = points[points.length - 1]
  const totalTime = state.time

  return {
    points,
    totalTime,
    maxHeight,
    maxLateral,
    bouncePoint,
    arrivalPoint,
    arrivalTime: totalTime,
    finalSpeed: state.speed,
  }
}

export function sampleTrajectory(
  trajectory: TrajectoryResult,
  sampleCount: number,
): TrajectoryPoint[] {
  if (trajectory.points.length === 0) return []
  if (sampleCount >= trajectory.points.length) return [...trajectory.points]

  const result: TrajectoryPoint[] = []
  const step = trajectory.points.length / sampleCount

  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.min(Math.floor(i * step), trajectory.points.length - 1)
    result.push(trajectory.points[idx])
  }

  if (result[result.length - 1] !== trajectory.points[trajectory.points.length - 1]) {
    result[result.length - 1] = trajectory.points[trajectory.points.length - 1]
  }

  return result
}

export function getPositionAtTime(
  trajectory: TrajectoryResult,
  time: number,
): TrajectoryPoint | null {
  if (trajectory.points.length === 0) return null
  if (time <= trajectory.points[0].time) return trajectory.points[0]
  if (time >= trajectory.points[trajectory.points.length - 1].time) {
    return trajectory.points[trajectory.points.length - 1]
  }

  for (let i = 1; i < trajectory.points.length; i++) {
    if (trajectory.points[i].time >= time) {
      const prev = trajectory.points[i - 1]
      const next = trajectory.points[i]
      const t = (time - prev.time) / (next.time - prev.time)
      return {
        position: {
          x: prev.position.x + (next.position.x - prev.position.x) * t,
          y: prev.position.y + (next.position.y - prev.position.y) * t,
          z: prev.position.z + (next.position.z - prev.position.z) * t,
        },
        velocity: {
          x: prev.velocity.x + (next.velocity.x - prev.velocity.x) * t,
          y: prev.velocity.y + (next.velocity.y - prev.velocity.y) * t,
          z: prev.velocity.z + (next.velocity.z - prev.velocity.z) * t,
        },
        time,
        phase: next.phase,
        speed: prev.speed + (next.speed - prev.speed) * t,
      }
    }
  }

  return trajectory.points[trajectory.points.length - 1]
}

export function createPhysicsConfig(
  speed: number,
  swingAmount: number,
  spinRate: number,
  isPace: boolean,
  pitchFactor: number,
): PhysicsConfig {
  return {
    releaseSpeed: speed,
    releaseHeight: RELEASE_HEIGHT,
    releaseAngle: isPace ? -5 : -4,
    lateralAngle: 0,
    swingAmount: isPace ? swingAmount : 0,
    swingDelay: 0.5,
    spinRate: isPace ? 0 : spinRate,
    spinAxis: vec3(0, 0, isPace ? 1 : 1),
    pitchFriction: 0.3 + (1 - pitchFactor) * 0.2,
    pitchBounceFactor: 0.2 + pitchFactor * 0.3,
    pitchRoughness: 1 - pitchFactor,
    airDensity: 1.225,
    ballMass: 0.163,
    seamAngle: 0,
  }
}
