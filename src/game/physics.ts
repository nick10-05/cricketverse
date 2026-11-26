import type { BallOutcome, Delivery, DeliveryType, FieldSetting, PathPoint, ShotInput, ShotType, TimingGrade } from './types'

/*
 * World coordinates (metres):
 *   z axis runs down the pitch. Striker's stumps at z = 0, bowler's stumps at z = -20.12.
 *   x axis is lateral: positive = off side (right of screen from behind the batter), negative = leg side.
 *   y axis is height.
 */

export const G = 9.81
export const PITCH_LEN = 20.12
export const CREASE_Z = -1.22
export const CONTACT_Z = -0.95
export const RELEASE_Z = -19.2
export const RELEASE_Y = 2.15
export const FIELD_CENTER = { x: 0, z: -PITCH_LEN / 2 }
export const BOUNDARY_R = 62
export const STUMP_HALF_W = 0.115
export const STUMP_H = 0.71

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export const DELIVERY_INFO: Record<DeliveryType, { label: string; speed: number; desc: string; difficulty: number }> = {
  fast: { label: 'Fast', speed: 39, desc: 'Raw pace', difficulty: 0.95 },
  swing: { label: 'Swing', speed: 35, desc: 'Curves in the air', difficulty: 0.9 },
  seam: { label: 'Seam', speed: 36, desc: 'Jags off the pitch', difficulty: 0.88 },
  spin: { label: 'Spin', speed: 23, desc: 'Turns off the pitch', difficulty: 1.1 },
  yorker: { label: 'Yorker', speed: 37, desc: 'Full at the toes', difficulty: 0.72 },
  bouncer: { label: 'Bouncer', speed: 37, desc: 'Short & rising', difficulty: 0.85 },
  slower: { label: 'Slower', speed: 26, desc: 'Deceptive pace', difficulty: 0.92 },
}

export interface Trajectory {
  speed: number
  bounceZ: number
  bounceX: number
  tBounce: number
  tContact: number
  tStumps: number
  pos: (t: number) => { x: number; y: number; z: number }
  xAtStumps: number
  yAtStumps: number
  yAtContact: number
  xAtContact: number
}

/** Deterministic flight of a delivery from release to past the stumps. */
export function trajectory(d: Delivery): Trajectory {
  const r = rng(d.seed)
  const info = DELIVERY_INFO[d.type]
  const p = clamp(d.power, 0, 1)
  const speed = info.speed * (0.88 + 0.12 * p)
  let length = d.length
  if (d.type === 'yorker') length = Math.min(length, 0.06)
  if (d.type === 'bouncer') length = Math.max(length, 0.82)
  // Inaccuracy from a poor release.
  const lineErr = (r() - 0.5) * 0.7 * (1 - p)
  const lenErr = (r() - 0.5) * 0.25 * (1 - p)
  length = clamp(length + lenErr, 0, 1)
  const bounceZ = CREASE_Z - (0.35 + length * 8.6)
  const bounceX = clamp(d.line + lineErr, -1.6, 1.6)
  const releaseX = 0.35 * d.turn * (d.type === 'spin' ? 0.4 : 1)

  const tBounce = (bounceZ - RELEASE_Z) / speed
  const vy0 = (0.5 * G * tBounce * tBounce - RELEASE_Y) / tBounce
  const vyIn = vy0 - G * tBounce
  const e = d.type === 'bouncer' ? 0.78 : d.type === 'spin' ? 0.52 : d.type === 'slower' ? 0.58 : 0.6
  const vy1 = -vyIn * e
  const speed2 = speed * (d.type === 'spin' ? 0.84 : 0.9)

  const swingA = d.type === 'swing' ? d.turn * (2.2 + 1.6 * p) : 0
  const vx0 = (bounceX - releaseX - 0.5 * swingA * tBounce * tBounce) / tBounce
  let vx1 = vx0 + swingA * tBounce * 0.6
  if (d.type === 'spin') vx1 += d.turn * (1.1 + 0.9 * p)
  else if (d.type === 'seam') vx1 += d.turn * (0.9 + 0.8 * p) * (0.6 + r() * 0.6) // sharp movement off the seam
  else vx1 += (r() - 0.5) * 0.5 // natural seam movement

  const pos = (t: number) => {
    if (t <= tBounce) {
      return {
        x: releaseX + vx0 * t + 0.5 * swingA * t * t,
        y: Math.max(0, RELEASE_Y + vy0 * t - 0.5 * G * t * t),
        z: RELEASE_Z + speed * t,
      }
    }
    const u = t - tBounce
    return {
      x: bounceX + vx1 * u,
      y: Math.max(0, vy1 * u - 0.5 * G * u * u),
      z: bounceZ + speed2 * u,
    }
  }
  const tContact = tBounce + (CONTACT_Z - bounceZ) / speed2
  const tStumps = tBounce + (0 - bounceZ) / speed2
  const c = pos(tContact)
  const s = pos(tStumps)
  return {
    speed,
    bounceZ,
    bounceX,
    tBounce,
    tContact,
    tStumps,
    pos,
    xAtStumps: s.x,
    yAtStumps: s.y,
    xAtContact: c.x,
    yAtContact: c.y,
  }
}

export interface Fielder {
  x: number
  z: number
  speed: number
  role: string
}

const BALANCED: Fielder[] = [
  { x: 0, z: 3.2, speed: 5, role: 'Keeper' },
  { x: 1.2, z: -15, speed: 6, role: 'Bowler' },
  { x: 9, z: -30, speed: 7, role: 'Mid-off' },
  { x: -9, z: -30, speed: 7, role: 'Mid-on' },
  { x: 21, z: -13, speed: 7.2, role: 'Cover' },
  { x: 23, z: 1, speed: 7.2, role: 'Point' },
  { x: -22, z: 1, speed: 7, role: 'Square leg' },
  { x: -21, z: -16, speed: 7.2, role: 'Midwicket' },
  { x: 30, z: 36, speed: 7.5, role: 'Third man' },
  { x: -20, z: -60, speed: 7.5, role: 'Long-on' },
  { x: -32, z: 32, speed: 7.5, role: 'Fine leg' },
]

/** Close-in catchers: more edges carried, but gaps in the deep. */
const ATTACKING: Fielder[] = [
  { x: 0, z: 3.2, speed: 5, role: 'Keeper' },
  { x: 1.2, z: -15, speed: 6, role: 'Bowler' },
  { x: 7, z: -24, speed: 7, role: 'Mid-off' },
  { x: -7, z: -24, speed: 7, role: 'Mid-on' },
  { x: 2.6, z: 4.2, speed: 6.5, role: 'Slip' },
  { x: 4.2, z: 3.4, speed: 6.5, role: 'Gully' },
  { x: 14, z: -6, speed: 7.2, role: 'Cover point' },
  { x: -3.4, z: -3.6, speed: 6.5, role: 'Short leg' },
  { x: -18, z: -12, speed: 7.2, role: 'Midwicket' },
  { x: 26, z: 30, speed: 7.5, role: 'Third man' },
  { x: -28, z: 26, speed: 7.5, role: 'Fine leg' },
]

/** Sweepers on the rope: boundaries are hard to find, singles are easy. */
const DEFENSIVE: Fielder[] = [
  { x: 0, z: 3.2, speed: 5, role: 'Keeper' },
  { x: 1.2, z: -15, speed: 6, role: 'Bowler' },
  { x: 16, z: -64, speed: 7.5, role: 'Long-off' },
  { x: -16, z: -64, speed: 7.5, role: 'Long-on' },
  { x: 44, z: -34, speed: 7.5, role: 'Deep cover' },
  { x: 52, z: -2, speed: 7.5, role: 'Deep point' },
  { x: -52, z: -4, speed: 7.5, role: 'Deep square' },
  { x: -44, z: -38, speed: 7.5, role: 'Deep midwicket' },
  { x: 30, z: 36, speed: 7.5, role: 'Third man' },
  { x: 11, z: -28, speed: 7.2, role: 'Mid-off' },
  { x: -32, z: 32, speed: 7.5, role: 'Fine leg' },
]

export const FIELDS: Record<FieldSetting, Fielder[]> = { attacking: ATTACKING, balanced: BALANCED, defensive: DEFENSIVE }
export const FIELDERS = BALANCED
export const fieldFor = (d: Pick<Delivery, 'field'>) => FIELDS[d.field ?? 'balanced'] ?? BALANCED

export function timingWindows(d: Delivery) {
  const k = DELIVERY_INFO[d.type].difficulty * (1.12 - 0.22 * clamp(d.power, 0, 1))
  return { perfect: 32 * k, good: 75 * k, ok: 140 * k }
}

export function gradeTiming(d: Delivery, shot: ShotInput): TimingGrade {
  if (!shot.swung) return 'none'
  const w = timingWindows(d)
  const a = Math.abs(shot.timing)
  if (a <= w.perfect) return 'perfect'
  if (a <= w.good) return 'good'
  if (a <= w.ok) return shot.timing < 0 ? 'early' : 'late'
  return 'miss'
}

const DRAG = 0.0105
const distFromCenter = (x: number, z: number) => Math.hypot(x - FIELD_CENTER.x, z - FIELD_CENTER.z)

/** Resolve one ball, deterministically, from the delivery and the batter's input. */
export function resolveBall(d: Delivery, shot: ShotInput): BallOutcome {
  const tr = trajectory(d)
  const r = rng(d.seed ^ 0x9e3779b9)
  const grade = gradeTiming(d, shot)
  const onStumps = Math.abs(tr.xAtStumps) < STUMP_HALF_W + 0.04 && tr.yAtStumps < STUMP_H + 0.04
  const isWide = Math.abs(tr.xAtStumps) > 1.05 || tr.yAtContact > 2.1
  const fielders = fieldFor(d)
  // Front-foot no-ball: a badly rushed release oversteps the crease.
  const rx = rng(d.seed ^ 0x51ed27)
  const noBall = d.power < 0.22 && rx() < 0.55
  const out = resolveLegal(d, shot, tr, r, rx, grade, onStumps, isWide, fielders)
  if (!noBall || out.extra === 'wide') return out
  // Only a run out stands on a no-ball; the batter keeps any runs plus the penalty run.
  const keep = out.wicket === 'run out' ? out.wicket : null
  const runs = (out.extra ? 0 : out.runs) + 1
  return { ...out, extra: 'noball', wicket: keep, runs, label: keep ? 'RUN OUT · NO BALL' : out.runs && !out.extra ? `NO BALL · ${out.label}` : 'NO BALL · FREE HIT' }
}

function resolveLegal(
  d: Delivery,
  shot: ShotInput,
  tr: Trajectory,
  r: () => number,
  rx: () => number,
  grade: TimingGrade,
  onStumps: boolean,
  isWide: boolean,
  fielders: Fielder[],
): BallOutcome {

  const cls = classifyShot(d, shot)
  const base: BallOutcome = {
    runs: 0,
    extra: null,
    wicket: null,
    grade,
    label: '',
    boundary: null,
    path: [],
    fielder: -1,
    fielderPath: [],
    edged: false,
    shot: grade === 'miss' ? 'miss' : cls.shot,
    footwork: cls.footwork,
    dive: false,
    throwPath: [],
  }

  const missed = (): BallOutcome => {
    if (onStumps) {
      // Struck on the pad in front of the stumps before reaching them: leg before wicket.
      const padHigh = tr.yAtContact < 0.75 && Math.abs(tr.xAtContact) < STUMP_HALF_W + 0.1
      if (padHigh && rx() < (cls.footwork === 'front' ? 0.5 : 0.3)) return { ...base, wicket: 'lbw', label: 'LBW!' }
      return { ...base, wicket: 'bowled', label: 'BOWLED!' }
    }
    if (isWide) {
      const four = d.type !== 'spin' && Math.abs(tr.xAtStumps) > 1.6 && rx() < 0.3 ? 4 : 0
      return { ...base, extra: 'wide', runs: 1 + four, label: four ? 'WIDE · 4 BYES' : 'WIDE' }
    }
    // Charged down the pitch to a spinner and missed: the keeper whips the bails off.
    if (d.type === 'spin' && shot.swung && shot.loft && rx() < 0.4) return { ...base, wicket: 'stumped', label: 'STUMPED!' }
    // Keeper fumbles a quick one, or it deflects off the pad.
    const roll = rx()
    if (roll < (d.type === 'spin' || d.type === 'slower' ? 0.03 : 0.07)) return { ...base, extra: 'bye', runs: roll < 0.012 ? 4 : 1, label: roll < 0.012 ? '4 BYES' : 'BYE' }
    if (Math.abs(tr.xAtContact) < 0.35 && tr.yAtContact < 0.8 && roll > 0.9) return { ...base, extra: 'legbye', runs: 1, label: 'LEG BYE' }
    return { ...base, label: shot.swung ? 'BEATEN!' : 'LEFT ALONE' }
  }

  if (grade === 'none' || grade === 'miss') return missed()

  // Shot quality.
  let q = grade === 'perfect' ? 1 : grade === 'good' ? 0.8 : 0.5
  const bx = tr.xAtContact
  if (bx > 0.55 && shot.dir < -0.35) q -= 0.28 // across the line to a wide ball
  if (bx < -0.25 && shot.dir > 0.55) q -= 0.25 // hitting against the angle
  if (Math.abs(bx) > 0.95) q -= 0.25 // reaching
  if (tr.yAtContact < 0.22 && shot.loft) q -= 0.22 // digging out a yorker
  if (tr.yAtContact > 1.35 && !shot.loft) q -= 0.15 // short ball, ground shot
  q = clamp(q + (r() - 0.5) * 0.12, 0.05, 1)

  // Edges on poor timing or poor shot selection.
  const edgeChance = (grade === 'early' || grade === 'late' ? 0.2 : 0.02) + (q < 0.45 ? 0.2 : 0)
  if (r() < edgeChance) {
    if (r() < 0.32 && onStumps) return { ...base, wicket: 'bowled', edged: true, label: 'PLAYED ON!' }
    // Slips and gully (attacking field) hold more edges than the keeper alone.
    const slips = fielders.some((f) => f.role === 'Slip')
    if (r() < (slips ? 0.55 : 0.42)) {
      const path: PathPoint[] = []
      const kp = fielders[0]
      for (let i = 0; i <= 8; i++) {
        const u = i / 8
        path.push({ t: u * 0.35, x: bx + (kp.x + 0.6 - bx) * u, y: 0.8 + 0.4 * u, z: CONTACT_Z + (kp.z - CONTACT_Z) * u })
      }
      return { ...base, wicket: 'caught behind', edged: true, label: 'CAUGHT BEHIND!', path, fielder: 0 }
    }
    // Thick edge down to third man / fine leg.
    const ang = (shot.timing > 0 ? 1 : -1) * (130 + r() * 30)
    return simulateHit(fielders, { ...base, edged: true }, bx, tr.yAtContact, ang, 14 + r() * 12, 6 + r() * 6, r, 'EDGED')
  }

  const skew = clamp(shot.timing / 140, -1, 1) * 24
  let angle = clamp(shot.dir, -1, 1) * 78 + skew + (r() - 0.5) * 8
  // Cross-bat shots go square of the wicket.
  if (base.shot === 'pull' || base.shot === 'hook') angle = Math.min(angle, -50 - Math.abs(shot.dir) * 35 + skew * 0.5)
  if (base.shot === 'cut' || base.shot === 'upper cut') angle = Math.max(angle, 55 + Math.abs(shot.dir) * 35 + skew * 0.5)
  if (base.shot === 'slog') angle = Math.min(angle, -35 - r() * 30)
  const ballPace = tr.speed
  const exitV = shot.loft ? 13 + 22 * q + 0.1 * ballPace + r() * 3 : 15 + 19 * q + 0.18 * ballPace
  const skied = shot.loft && r() < 0.35 - 0.3 * q
  let launch = shot.loft ? (skied ? 52 + r() * 18 : 26 + (1 - q) * 22 + r() * 8) : -5 + (1 - q) * 5 + r() * 3
  if (base.shot === 'upper cut') launch += 8
  return simulateHit(fielders, { ...base }, bx, tr.yAtContact, angle, exitV, launch, r, '')
}

/** Which shot the batter plays, from the ball's length/line and the chosen direction. */
export function classifyShot(d: Delivery, shot: ShotInput): { shot: ShotType; footwork: 'front' | 'back' } {
  const tr = trajectory(d)
  const short = tr.bounceZ < CREASE_Z - (0.35 + 0.6 * 8.6) || tr.yAtContact > 1.05
  const footwork = short ? 'back' : 'front'
  if (!shot.swung) return { shot: 'leave', footwork }
  const dir = clamp(shot.dir + clamp(shot.timing / 140, -1, 1) * 0.3, -1, 1)
  if (short) {
    if (dir > 0.35) return { shot: shot.loft ? 'upper cut' : 'cut', footwork }
    return { shot: shot.loft ? 'hook' : 'pull', footwork }
  }
  if (tr.yAtContact < 0.22 && !shot.loft) return { shot: dir < -0.3 ? 'flick' : 'block', footwork }
  if (dir < -0.5) return { shot: shot.loft ? 'slog' : 'flick', footwork }
  if (dir < -0.15) return { shot: shot.loft ? 'lofted drive' : 'on drive', footwork }
  if (dir <= 0.2) return { shot: shot.loft ? 'lofted drive' : 'straight drive', footwork }
  return { shot: shot.loft ? 'lofted drive' : 'cover drive', footwork }
}

function simulateHit(
  FIELDERS: Fielder[],
  out: BallOutcome,
  x0: number,
  y0: number,
  angleDeg: number,
  speed: number,
  launchDeg: number,
  r: () => number,
  tag: string,
): BallOutcome {
  const a = (angleDeg * Math.PI) / 180
  const l = (launchDeg * Math.PI) / 180
  let vx = Math.sin(a) * Math.cos(l) * speed
  let vz = -Math.cos(a) * Math.cos(l) * speed
  let vy = Math.sin(l) * speed
  let x = x0
  let y = Math.max(0.3, y0)
  let z = CONTACT_Z
  let t = 0
  let bounced = false
  const dt = 0.02
  const path: PathPoint[] = [{ t, x, y, z }]
  let lastSample = 0

  const reached = FIELDERS.map(() => false)
  for (let step = 0; step < 900; step++) {
    // integrate
    const v = Math.hypot(vx, vy, vz)
    const drag = y > 0.05 ? DRAG : DRAG * 0.25
    vx -= drag * v * vx * dt
    vz -= drag * v * vz * dt
    vy -= (G + drag * v * vy) * dt
    x += vx * dt
    y += vy * dt
    z += vz * dt
    t += dt
    if (y <= 0) {
      y = 0
      if (Math.abs(vy) > 2.2) {
        const steep = Math.abs(vy) / Math.max(1, Math.hypot(vx, vz))
        vy = -vy * 0.38
        vx *= 0.9 - 0.25 * Math.min(1, steep)
        vz *= 0.9 - 0.25 * Math.min(1, steep)
      } else {
        vy = 0
      }
      bounced = true
    }
    if (y === 0 && vy === 0) {
      // rolling friction
      const hv = Math.hypot(vx, vz)
      const nv = Math.max(0, hv - 4.2 * dt)
      if (hv > 0) {
        vx *= nv / hv
        vz *= nv / hv
      }
    }
    if (t - lastSample >= 0.05) {
      path.push({ t, x, y, z })
      lastSample = t
    }

    // Boundary
    if (distFromCenter(x, z) >= BOUNDARY_R) {
      path.push({ t, x, y, z })
      const six = !bounced
      return {
        ...out,
        runs: six ? 6 : 4,
        boundary: six ? 6 : 4,
        label: six ? 'SIX!' : 'FOUR!',
        path,
      }
    }

    // Fielders
    for (let i = 1; i < FIELDERS.length; i++) {
      const f = FIELDERS[i]
      const run = Math.max(0, t - 0.32) * f.speed
      const d = Math.hypot(x - f.x, z - f.z)
      const airborne = !bounced && y > 0.15
      if (airborne) {
        if (!reached[i] && y < 3.0 && y > 0.45 && d <= run + 1.9) {
          const margin = run + 1.9 - d
          // Boundary riders take fewer clean catches (judging the ball on the rope is hard).
          const deep = distFromCenter(f.x, f.z) > 42 ? 0.5 : 1
          // ...and a long running catch is harder than one that comes straight to hand.
          const chase = d > 8 ? clamp(1.1 - d / 32, 0.25, 1) : 1
          const p = (margin > 2.5 ? 0.8 : margin > 1 ? 0.5 : 0.28) * deep * chase
          if (r() < p) {
            path.push({ t, x, y, z })
            return {
              ...out,
              wicket: 'caught',
              label: margin < 1 ? 'STUNNING CATCH!' : 'CAUGHT!',
              path,
              fielder: i,
              fielderPath: fielderRun(f, x, z, t),
              dive: margin < 1,
            }
          }
          reached[i] = true // dropped / missed chance
        }
      } else if (y < 1.2 && d <= run + 1.3 * clamp(16 / Math.max(1, Math.hypot(vx, vz)), 0.35, 1) && !reached[i]) {
        path.push({ t, x, y, z })
        return withRuns(FIELDERS, out, path, i, x, z, t, tag, r, d > run + 0.35)
      }
    }

    const hv = Math.hypot(vx, vz)
    if (hv < 0.3 && y === 0) {
      // Ball stopped: nearest fielder walks to it.
      let best = 1
      let bestT = Infinity
      for (let i = 1; i < FIELDERS.length; i++) {
        const f = FIELDERS[i]
        const tt = 0.32 + Math.hypot(x - f.x, z - f.z) / f.speed
        if (tt < bestT) {
          bestT = tt
          best = i
        }
      }
      path.push({ t: Math.max(t, bestT), x, y, z })
      return withRuns(FIELDERS, out, path, best, x, z, Math.max(t, bestT), tag, r, false)
    }
  }
  return withRuns(FIELDERS, out, path, 1, x, z, t, tag, r, false)
}

function fielderRun(f: Fielder, x: number, z: number, t: number): PathPoint[] {
  return [
    { t: 0, x: f.x, y: 0, z: f.z },
    { t: 0.32, x: f.x, y: 0, z: f.z },
    { t, x, y: 0, z },
  ]
}

const RUN_FIRST = 2.0
const RUN_NEXT = 2.6

function withRuns(FIELDERS: Fielder[], out: BallOutcome, path: PathPoint[], fi: number, x: number, z: number, t: number, tag: string, r: () => number, dive: boolean): BallOutcome {
  // Throw to whichever end is nearer the fielder.
  const toStriker = Math.hypot(x, z - CREASE_Z) <= Math.hypot(x, z + PITCH_LEN - 1.22)
  const end = toStriker ? { x: 0.25, z: 1.0 } : { x: 0.3, z: -PITCH_LEN - 0.6 }
  const dThrow = Math.hypot(x - end.x, z - end.z)
  const release = dive ? 0.85 : 0.45
  const flight = dThrow / 30
  const total = t + release + flight
  let runs = 0
  if (total > RUN_FIRST) runs = 1 + Math.floor((total - RUN_FIRST) / RUN_NEXT)
  runs = clamp(runs, 0, 3)

  // Throw arc for the renderer.
  const throwPath: PathPoint[] = []
  if (dThrow > 3) {
    const apex = Math.min(9, dThrow * 0.12)
    for (let i = 0; i <= 12; i++) {
      const u = i / 12
      throwPath.push({ t: t + release + flight * u, x: lerpN(x, end.x, u), y: 1.7 + (0.9 - 1.7) * u + apex * 4 * u * (1 - u), z: lerpN(z, end.z, u) })
    }
  }

  // Risky extra run: close call at the stumps.
  const spare = total - RUN_FIRST - Math.max(0, runs - 1) * RUN_NEXT
  if (runs < 3 && spare > RUN_NEXT - 0.3 && dThrow < 38 && r() < 0.28) {
    return {
      ...out,
      runs,
      wicket: 'run out',
      label: 'RUN OUT!',
      path,
      fielder: fi,
      fielderPath: fielderRun(FIELDERS[fi], x, z, t),
      dive,
      throwPath,
    }
  }
  const label = runs === 0 ? (tag ? 'EDGED · DOT' : dive ? 'WHAT A STOP!' : 'FIELDED') : `${runs} RUN${runs > 1 ? 'S' : ''}`
  return { ...out, runs, label: tag && runs ? `EDGED · ${label}` : label, path, fielder: fi, fielderPath: fielderRun(FIELDERS[fi], x, z, t), dive, throwPath }
}

const lerpN = (a: number, b: number, u: number) => a + (b - a) * u

export function randomSeed() {
  return (Math.random() * 2 ** 31) | 0
}
