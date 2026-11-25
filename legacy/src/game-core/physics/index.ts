export type {
  Vector3,
  BallPhysicsState,
  PhysicsConfig,
  BounceResult,
  TrajectoryPoint,
  TrajectoryResult,
} from './types'

export {
  GRAVITY, AIR_DENSITY, BALL_MASS, BALL_RADIUS,
  PITCH_LENGTH, RELEASE_HEIGHT, STUMPS_HEIGHT,
  PHYSICS_DT, MAX_TRAJECTORY_POINTS,
  vec3, vec3Add, vec3Sub, vec3Scale, vec3Length,
  vec3Normalize, vec3Dot, vec3Cross,
} from './types'

export {
  calcDragForce,
  calcSpinForce,
  calcLateSwingForce,
  resolveBounce,
  calcGroundFriction,
} from './effects'

export {
  createBallState,
  stepPhysics,
  simulateDelivery,
  sampleTrajectory,
  getPositionAtTime,
  createPhysicsConfig,
} from './engine'
