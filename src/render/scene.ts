import {
  BOUNDARY_R,
  CONTACT_Z,
  CREASE_Z,
  FIELD_CENTER,
  FIELDERS,
  PITCH_LEN,
  trajectory,
  type Trajectory,
  SWING_TIME,
} from '../game/physics'
import type { BallOutcome, Delivery, PathPoint, ShotInput, TeamId } from '../game/types'
import { Camera, lerp, lerpV, type V3 } from './camera'

export const TEAM_COLORS: Record<TeamId, { main: string; dark: string; light: string }> = {
  A: { main: '#ff6a1f', dark: '#a83c06', light: '#ffb07a' },
  B: { main: '#1aa7ff', dark: '#075a9c', light: '#8fd8ff' },
}

const RUNUP = 1.15 // seconds
const BAT_CAM = { pos: { x: 1.3, y: 3.9, z: 8.6 }, target: { x: -0.4, y: 0.4, z: -12 }, zoom: 1.6 }
const BATTER = { x: -0.42, z: -1.0 }

export interface PlayOptions {
  delivery: Delivery
  live: boolean
  shot?: ShotInput
  outcome?: BallOutcome
  /** Live mode: called once if the batter never swung. */
  onNoSwing?: () => void
  /** Called when bat meets ball. */
  onContact?: (o: BallOutcome) => void
  /** Called when the result should be announced. */
  onResult?: (o: BallOutcome) => void
  onDone?: () => void
}

interface Play {
  opts: PlayOptions
  d: Delivery
  tr: Trajectory
  start: number
  shot: ShotInput | null
  outcome: BallOutcome | null
  resultAt: number | null
  resultFired: boolean
  noSwingFired: boolean
  contactFired: boolean
  doneFired: boolean
  stumpsHit: number | null
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  size: number
  rot: number
}

interface CrowdDot {
  u: number
  v: number
  c: string
}

function interpPath(path: PathPoint[], t: number): V3 {
  if (!path.length) return { x: 0, y: 0, z: 0 }
  if (t <= path[0].t) return path[0]
  for (let i = 1; i < path.length; i++) {
    if (path[i].t >= t) {
      const a = path[i - 1]
      const b = path[i]
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) }
    }
  }
  return path[path.length - 1]
}

const pathEnd = (p: PathPoint[]) => (p.length ? p[p.length - 1].t : 0)

export class Scene {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  cam = new Camera()
  batting: TeamId = 'A'
  bowling: TeamId = 'B'
  play: Play | null = null
  /** Bowler's aiming marker (world coords) or null. */
  aim: { x: number; z: number } | null = null
  showZones = false
  private particles: Particle[] = []
  private shake = 0
  private raf = 0
  private camT = 0
  private camTarget: V3 = { x: 0, y: 0, z: -6 }
  private trail: V3[] = []
  private crowd: CrowdDot[][] = []
  private last = performance.now()
  private dpr = 1

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    this.ctx = ctx
    const colors = ['#e94b4b', '#f5c542', '#3fb6ff', '#ffffff', '#ff8a3d', '#7a5cff', '#2bd17e', '#ff5fa2', '#1a2238', '#d9d9d9']
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let s = 0; s < 56; s++) {
      const dots: CrowdDot[] = []
      for (let i = 0; i < 70; i++) dots.push({ u: rnd(), v: 0.08 + rnd() * 0.86, c: colors[Math.floor(rnd() * colors.length)] })
      this.crowd.push(dots)
    }
    this.loop()
  }

  destroy() {
    cancelAnimationFrame(this.raf)
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.render(now, dt)
  }

  // ---------------------------------------------------------------- play control

  playDelivery(opts: PlayOptions) {
    const tr = trajectory(opts.delivery)
    this.play = {
      opts,
      d: opts.delivery,
      tr,
      start: performance.now(),
      shot: opts.shot ?? null,
      outcome: opts.outcome ?? null,
      resultAt: null,
      resultFired: false,
      noSwingFired: false,
      contactFired: false,
      doneFired: false,
      stumpsHit: null,
    }
    this.aim = null
    if (opts.outcome) this.setOutcome(opts.outcome)
  }

  /** Seconds since release for the current play (negative during the run-up). */
  flightTime(now = performance.now()) {
    if (!this.play) return -99
    return (now - this.play.start) / 1000 - RUNUP
  }

  /** Live batting: register a swing now and return the full shot input. */
  swing(dir: number, loft: boolean, now = performance.now()): ShotInput | null {
    const p = this.play
    if (!p || !p.opts.live || p.shot) return null
    const t = this.flightTime(now)
    if (t < 0.05) return null // swinging during run-up is ignored
    const timing = (t + SWING_TIME - p.tr.tContact) * 1000
    p.shot = { swung: true, dir, loft, timing }
    return p.shot
  }

  /** Replace the live result with the host's (authoritative) one. */
  forceOutcome(shot: ShotInput, o: BallOutcome) {
    const p = this.play
    if (!p) return
    p.shot = shot
    p.noSwingFired = true
    this.setOutcome(o)
  }

  setOutcome(o: BallOutcome) {
    const p = this.play
    if (!p) return
    p.outcome = o
    const tr = p.tr
    if (o.path.length) p.resultAt = tr.tContact + pathEnd(o.path)
    else p.resultAt = o.wicket === 'bowled' ? tr.tStumps + 0.05 : tr.tStumps + 0.25
  }

  /** For the batting timing bar: where the live ball is relative to the contact moment. */
  timingProbe(now = performance.now()) {
    const p = this.play
    if (!p || !p.opts.live) return null
    return { t: this.flightTime(now), tContact: p.tr.tContact - SWING_TIME, d: p.d, shot: p.shot }
  }

  isBusy() {
    return !!this.play
  }

  // ---------------------------------------------------------------- effects

  burst(kind: 'four' | 'six' | 'wicket') {
    const w = this.cam.w
    const colors = kind === 'wicket' ? ['#ff3b3b', '#ffffff', '#ffb3b3'] : ['#ffd23f', '#ff6a1f', '#1aa7ff', '#ffffff', '#2bd17e', '#ff5fa2']
    const n = kind === 'six' ? 160 : kind === 'four' ? 90 : 50
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0
      this.particles.push({
        x: kind === 'wicket' ? w / 2 : fromLeft ? 0 : w,
        y: kind === 'wicket' ? this.cam.h * 0.45 : this.cam.h * (0.55 + Math.random() * 0.3),
        vx: kind === 'wicket' ? (Math.random() - 0.5) * 700 : (fromLeft ? 1 : -1) * (200 + Math.random() * 500),
        vy: kind === 'wicket' ? (Math.random() - 0.7) * 600 : -(400 + Math.random() * 600),
        life: 1.6 + Math.random() * 1.2,
        color: colors[i % colors.length],
        size: 4 + Math.random() * 6,
        rot: Math.random() * 6,
      })
    }
    if (kind === 'wicket') this.shake = 0.5
  }

  // ---------------------------------------------------------------- input helpers

  groundAt(sx: number, sy: number) {
    return this.cam.unprojectGround(sx, sy)
  }

  /** Screen position of the batter (used for tap-direction input). */
  batterScreen() {
    return this.cam.project({ x: 0, y: 0.8, z: CONTACT_Z })
  }

  // ---------------------------------------------------------------- render

  resize() {
    const r = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.round(r.width * this.dpr)
    this.canvas.height = Math.round(r.height * this.dpr)
  }

  private render(now: number, dt: number) {
    const ctx = this.ctx
    const r = this.canvas.getBoundingClientRect()
    if (Math.round(r.width * Math.min(2, window.devicePixelRatio || 1)) !== this.canvas.width) this.resize()
    const W = r.width
    const H = r.height
    if (W < 10 || H < 10) return

    const p = this.play
    const rawT = p ? this.flightTime(now) : -99
    // same brisk post-contact playback as the 3D view
    const t = p && rawT > p.tr.tContact ? p.tr.tContact + (rawT - p.tr.tContact) * 1.25 : rawT
    const state = this.computeState(p, t)

    // camera
    const wantField = state.hitT !== null && p?.outcome && p.outcome.path.length > 0 && !p.outcome.edged ? 1 : state.hitT !== null && p?.outcome?.edged ? 0.6 : 0
    this.camT += (wantField - this.camT) * Math.min(1, dt * (wantField ? 3.2 : 4))
    const ballG = { x: state.ball.x, y: 0, z: state.ball.z }
    // TV-style chase camera: sits behind the ball (toward the batter) and looks out at it.
    const desired = wantField ? { ...lerpV({ x: 0, y: 0, z: -6 }, ballG, 0.85), y: state.ball.y * 0.75 } : { x: 0, y: 0, z: -6 }
    this.camTarget = lerpV(this.camTarget, desired, Math.min(1, dt * 4))
    const bx = -this.camTarget.x
    const bz = 6 - this.camTarget.z
    const bd = Math.hypot(bx, bz) || 1
    const fieldPos = { x: this.camTarget.x + (bx / bd) * 26, y: 14 + Math.min(10, bd * 0.12) + this.camTarget.y * 0.5, z: this.camTarget.z + (bz / bd) * 26 }
    if (wantField) this.trail.push({ ...state.ball })
    else this.trail.length = 0
    if (this.trail.length > 14) this.trail.shift()
    const e = this.camT * this.camT * (3 - 2 * this.camT)
    this.cam.pos = lerpV(BAT_CAM.pos, fieldPos, e)
    this.cam.target = lerpV(BAT_CAM.target, this.camTarget, e)
    this.cam.zoom = lerp(BAT_CAM.zoom, 1.25, e)
    if (this.shake > 0) {
      this.shake -= dt
      const s = this.shake * 0.08
      this.cam.pos = { ...this.cam.pos, x: this.cam.pos.x + (Math.random() - 0.5) * s, y: this.cam.pos.y + (Math.random() - 0.5) * s }
    }
    this.cam.update(W, H)

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.drawWorld(now, state)
    this.drawParticles(dt)

    // callbacks
    if (p) this.tick(p, t, rawT)
  }

  private tick(p: Play, t: number, rawT: number) {
    if (p.opts.live && !p.shot && !p.noSwingFired && rawT > p.tr.tContact + 0.32) {
      p.noSwingFired = true
      p.shot = { swung: false, dir: 0, loft: false, timing: 0 }
      p.opts.onNoSwing?.()
    }
    if (p.outcome && p.outcome.path.length && !p.contactFired && t >= p.tr.tContact) {
      p.contactFired = true
      p.opts.onContact?.(p.outcome)
    }
    if (p.outcome && p.resultAt !== null && !p.resultFired && t >= p.resultAt) {
      p.resultFired = true
      const o = p.outcome
      if (o.wicket === 'bowled') p.stumpsHit = t
      if (o.boundary === 6) this.burst('six')
      else if (o.boundary === 4) this.burst('four')
      else if (o.wicket) this.burst('wicket')
      p.opts.onResult?.(o)
    }
    if (p.resultFired && !p.doneFired && t >= (p.resultAt ?? 0) + 1.1) {
      p.doneFired = true
      const cb = p.opts.onDone
      this.play = null
      cb?.()
    }
  }

  private computeState(p: Play | null, t: number) {
    let ball: V3 = { x: 0.5, y: 2.1, z: -20 }
    let ballVisible = false
    let hitT: number | null = null
    let bowlerZ = -21.5
    let bowlerRun = 0
    let swingPhase = -1
    const fielderPos = FIELDERS.map((f) => ({ x: f.x, z: f.z, run: 0 }))
    if (p) {
      const tr = p.tr
      if (t < 0) {
        const u = (t + RUNUP) / RUNUP
        bowlerZ = lerp(-33, -20.6, Math.min(1, u))
        bowlerRun = u * 9
      } else {
        bowlerZ = -20.6 + Math.min(t, 0.8) * 4
        bowlerRun = 9 + Math.min(t, 0.8) * 6
        ballVisible = true
        const o = p.outcome
        if (o && o.path.length && t >= tr.tContact) {
          hitT = t - tr.tContact
          ball = interpPath(o.path, hitT)
          // fielders react
          const end = pathEnd(o.path)
          FIELDERS.forEach((f, i) => {
            if (i === 0 && !o.edged) return
            if (i === o.fielder && o.fielderPath.length) {
              const fp = interpPath(o.fielderPath, Math.min(hitT!, end))
              fielderPos[i] = { x: fp.x, z: fp.z, run: hitT! < end ? hitT! * 10 : 0 }
            } else if (i > 1) {
              const dx = ball.x - f.x
              const dz = ball.z - f.z
              const d = Math.hypot(dx, dz) || 1
              const move = Math.min(Math.max(0, hitT! - 0.3) * 2.5, 5, d * 0.3)
              fielderPos[i] = { x: f.x + (dx / d) * move, z: f.z + (dz / d) * move, run: move > 0.1 && hitT! < end + 0.5 ? hitT! * 8 : 0 }
            }
          })
          if (o.wicket === 'caught' && hitT > end) {
            const fp = fielderPos[o.fielder]
            ball = { x: fp.x + 0.3, y: 1.4, z: fp.z }
          }
        } else {
          const tt = Math.min(t, tr.tStumps + 0.6)
          ball = tr.pos(tt)
          if (o?.wicket === 'bowled' && t > tr.tStumps) {
            const u = t - tr.tStumps
            const s = tr.pos(tr.tStumps)
            ball = { x: s.x + u * 0.8, y: Math.max(0, s.y + u * 1.5 - 4 * u * u), z: s.z + u * 1.5 }
          } else if (ball.z > 2.9) {
            ball = { ...ball, z: 2.9, y: Math.max(0.5, ball.y) }
          }
        }
      }
      const s = p.shot
      if (s?.swung) {
        const swingT = t - (tr.tContact + s.timing / 1000) + 0.12
        swingPhase = swingT < 0 ? -1 : Math.min(1, swingT / 0.32)
      } else if (t > tr.tContact - 0.3 && !p.opts.live) swingPhase = -1
    }
    return { ball, ballVisible, hitT, bowlerZ, bowlerRun, swingPhase, fielderPos }
  }

  // ---------------------------------------------------------------- drawing

  private poly(pts: V3[], fill: string | CanvasGradient, stroke?: string, lw = 1) {
    const sp = this.cam.polygon(pts)
    if (sp.length < 3) return
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(sp[0].x, sp[0].y)
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x, sp[i].y)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    if (stroke) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = lw
      ctx.stroke()
    }
  }

  private line(a: V3, b: V3, color: string, width: number) {
    const ca = this.cam.toCam(a)
    const cb = this.cam.toCam(b)
    if (ca.z < 0.25 && cb.z < 0.25) return
    const clip = (p: V3, q: V3) => {
      if (p.z >= 0.25) return p
      const u = (0.25 - p.z) / (q.z - p.z)
      return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, z: 0.25 }
    }
    const pa = this.cam.projCam(clip(ca, cb))
    const pb = this.cam.projCam(clip(cb, ca))
    const ctx = this.ctx
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }

  private drawWorld(now: number, st: ReturnType<Scene['computeState']>) {
    const ctx = this.ctx
    const W = this.cam.w
    const H = this.cam.h
    const cx = FIELD_CENTER.x
    const cz = FIELD_CENTER.z

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#060b1f')
    sky.addColorStop(0.45, '#14275a')
    sky.addColorStop(1, '#2b4c86')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    // Outer ground
    this.poly(
      [
        { x: -260, y: 0, z: -260 },
        { x: 260, y: 0, z: -260 },
        { x: 260, y: 0, z: 240 },
        { x: -260, y: 0, z: 240 },
      ],
      '#123d22',
    )

    // Stands (sorted far → near)
    const N = this.crowd.length
    const segs: { i: number; depth: number }[] = []
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) / N) * Math.PI * 2
      const c = this.cam.toCam({ x: cx + Math.cos(a) * 85, y: 8, z: cz + Math.sin(a) * 85 })
      segs.push({ i, depth: c.z })
    }
    segs.sort((a, b) => b.depth - a.depth)
    for (const { i, depth } of segs) {
      if (depth < -60) continue
      this.drawStand(i, N, cx, cz, now)
    }

    // Field
    const fieldPts: V3[] = []
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2
      fieldPts.push({ x: cx + Math.cos(a) * (BOUNDARY_R + 6), y: 0, z: cz + Math.sin(a) * (BOUNDARY_R + 6) })
    }
    const fieldScreen = this.cam.polygon(fieldPts)
    if (fieldScreen.length > 2) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(fieldScreen[0].x, fieldScreen[0].y)
      for (const q of fieldScreen) ctx.lineTo(q.x, q.y)
      ctx.closePath()
      ctx.fillStyle = '#2f8f3f'
      ctx.fill()
      ctx.clip()
      // mowing stripes
      for (let z = -80; z < 70; z += 7) {
        if (Math.round(z / 7) % 2 === 0) continue
        this.poly(
          [
            { x: -80, y: 0, z },
            { x: 80, y: 0, z },
            { x: 80, y: 0, z: z + 7 },
            { x: -80, y: 0, z: z + 7 },
          ],
          'rgba(255,255,255,0.055)',
        )
      }
      // vignette toward boundary
      ctx.restore()
    }

    // 30-yard circle
    ctx.setLineDash([6, 8])
    const circ: V3[] = []
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2
      circ.push({ x: cx + Math.cos(a) * 27, y: 0, z: cz + Math.sin(a) * 27 })
    }
    for (let i = 0; i < circ.length - 1; i++) this.line(circ[i], circ[i + 1], 'rgba(255,255,255,0.35)', 1.5)
    ctx.setLineDash([])

    // Boundary rope + ad boards
    for (let i = 0; i < 72; i++) {
      const a0 = (i / 72) * Math.PI * 2
      const a1 = ((i + 1) / 72) * Math.PI * 2
      const p0 = { x: cx + Math.cos(a0) * BOUNDARY_R, y: 0.05, z: cz + Math.sin(a0) * BOUNDARY_R }
      const p1 = { x: cx + Math.cos(a1) * BOUNDARY_R, y: 0.05, z: cz + Math.sin(a1) * BOUNDARY_R }
      this.line(p0, p1, i % 2 ? '#ffffff' : '#ffd23f', 3)
      const R = BOUNDARY_R + 6
      const colors = ['#ff6a1f', '#121a33', '#1aa7ff', '#121a33']
      this.poly(
        [
          { x: cx + Math.cos(a0) * R, y: 0, z: cz + Math.sin(a0) * R },
          { x: cx + Math.cos(a1) * R, y: 0, z: cz + Math.sin(a1) * R },
          { x: cx + Math.cos(a1) * R, y: 1.1, z: cz + Math.sin(a1) * R },
          { x: cx + Math.cos(a0) * R, y: 1.1, z: cz + Math.sin(a0) * R },
        ],
        colors[Math.floor(i / 3) % 4],
      )
    }

    this.drawPitch()

    // Depth-sorted objects
    const items: { depth: number; draw: () => void }[] = []
    const add = (p: V3, draw: () => void) => {
      const c = this.cam.toCam(p)
      if (c.z > 0.4) items.push({ depth: c.z, draw })
    }
    const bowlCol = TEAM_COLORS[this.bowling]
    const batCol = TEAM_COLORS[this.batting]
    const p = this.play

    add({ x: 0, y: 0, z: 0 }, () => this.drawStumps(0, p?.stumpsHit != null ? this.flightTime(now) - p.stumpsHit : -1))
    add({ x: 0, y: 0, z: -PITCH_LEN }, () => this.drawStumps(-PITCH_LEN, -1))
    add({ x: BATTER.x, y: 0, z: BATTER.z }, () => this.drawPerson(BATTER.x, BATTER.z, batCol, 'batter', st.swingPhase, 0, p?.shot?.dir ?? 0))
    add({ x: -1.3, y: 0, z: -19.4 }, () => this.drawPerson(-1.3, -19.4, batCol, 'nonstriker', 0, 0, 0))
    add({ x: -1.1, y: 0, z: -21.8 }, () => this.drawPerson(-1.1, -21.8, { main: '#f2f2f2', dark: '#1a1a1a', light: '#fff' }, 'umpire', 0, 0, 0))
    add({ x: 0.75, y: 0, z: st.bowlerZ }, () => this.drawPerson(0.75, st.bowlerZ, bowlCol, 'bowler', 0, st.bowlerRun, 0))
    st.fielderPos.forEach((f, i) => {
      if (i === 1) return // bowler drawn separately
      if (i === 0 && this.camT < 0.3) return // keeper is behind the camera
      add({ x: f.x, y: 0, z: f.z }, () => this.drawPerson(f.x, f.z, bowlCol, i === 0 ? 'keeper' : 'fielder', 0, f.run, 0))
    })
    if (st.ballVisible) add(st.ball, () => this.drawBall(st.ball))
    items.sort((a, b) => b.depth - a.depth)
    for (const it of items) it.draw()

    // Pitch markers on top
    if (p && st.ballVisible && st.hitT === null) {
      const t = this.flightTime(now)
      const a = Math.max(0, 1 - Math.max(0, t - p.tr.tBounce) / 0.4)
      if (a > 0) this.ring(p.tr.bounceX, p.tr.bounceZ, 0.32, `rgba(255,230,80,${0.85 * a})`)
    }
    if (this.aim) {
      const pulse = 0.25 + Math.sin(now / 160) * 0.06
      this.ring(this.aim.x, this.aim.z, pulse + 0.1, 'rgba(255,60,60,0.95)', true)
      this.ring(this.aim.x, this.aim.z, 0.12, 'rgba(255,255,255,0.95)', true)
    }
  }

  private drawStand(i: number, N: number, cx: number, cz: number, now: number) {
    const a0 = (i / N) * Math.PI * 2
    const a1 = ((i + 1) / N) * Math.PI * 2
    const R1 = BOUNDARY_R + 9
    const R2 = BOUNDARY_R + 40
    const pt = (a: number, r: number, y: number): V3 => ({ x: cx + Math.cos(a) * r, y, z: cz + Math.sin(a) * r })
    const q = [pt(a0, R1, 1.5), pt(a1, R1, 1.5), pt(a1, R2, 24), pt(a0, R2, 24)]
    const sp = q.map((p) => this.cam.project(p))
    this.poly(q, i % 2 ? '#1c2747' : '#222f55')
    // wall below
    this.poly([pt(a0, R1, 0), pt(a1, R1, 0), pt(a1, R1, 1.5), pt(a0, R1, 1.5)], '#0d1430')
    // roof
    this.poly([pt(a0, R2, 24), pt(a1, R2, 24), pt(a1, R2 + 4, 30), pt(a0, R2 + 4, 30)], '#0a0f22')
    if (sp.some((s) => !s)) return
    const [b0, b1, t1, t0] = sp as { x: number; y: number; s: number }[]
    const size = Math.max(1, Math.min(4, Math.abs(b1.x - b0.x) / 26))
    const ctx = this.ctx
    const wave = now / 400
    for (const d of this.crowd[i]) {
      const bx = lerp(b0.x, b1.x, d.u)
      const by = lerp(b0.y, b1.y, d.u)
      const tx = lerp(t0.x, t1.x, d.u)
      const ty = lerp(t0.y, t1.y, d.u)
      const x = lerp(bx, tx, d.v)
      const y = lerp(by, ty, d.v) - Math.max(0, Math.sin(wave + d.u * 3 + i * 0.4)) * size * 0.6
      ctx.fillStyle = d.c
      ctx.fillRect(x, y, size, size * 1.4)
    }
    // floodlights on every 14th segment
    if (i % 14 === 3) {
      const base = this.cam.project(pt(a0, R2 + 2, 0))
      const top = this.cam.project(pt(a0, R2 + 2, 48))
      if (base && top) {
        ctx.strokeStyle = '#3a4566'
        ctx.lineWidth = Math.max(1, top.s * 0.8)
        ctx.beginPath()
        ctx.moveTo(base.x, base.y)
        ctx.lineTo(top.x, top.y)
        ctx.stroke()
        const g = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, Math.max(20, top.s * 14))
        g.addColorStop(0, 'rgba(255,255,235,0.95)')
        g.addColorStop(0.15, 'rgba(255,250,210,0.5)')
        g.addColorStop(1, 'rgba(255,250,210,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(top.x, top.y, Math.max(20, top.s * 14), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  private drawPitch() {
    const hw = 1.52
    const zNear = 2.2
    const zFar = -PITCH_LEN - 2.2
    this.poly(
      [
        { x: -hw, y: 0.01, z: zNear },
        { x: hw, y: 0.01, z: zNear },
        { x: hw, y: 0.01, z: zFar },
        { x: -hw, y: 0.01, z: zFar },
      ],
      '#c9ad74',
    )
    // worn centre strip
    this.poly(
      [
        { x: -0.6, y: 0.012, z: -2.5 },
        { x: 0.6, y: 0.012, z: -2.5 },
        { x: 0.6, y: 0.012, z: -17.6 },
        { x: -0.6, y: 0.012, z: -17.6 },
      ],
      'rgba(170,135,80,0.45)',
    )
    if (this.showZones) {
      const zones = [
        { from: 0, to: 0.08, c: 'rgba(255,70,70,0.22)', label: 'Yorker' },
        { from: 0.08, to: 0.35, c: 'rgba(255,200,60,0.18)', label: 'Full' },
        { from: 0.35, to: 0.7, c: 'rgba(60,220,120,0.2)', label: 'Good' },
        { from: 0.7, to: 1, c: 'rgba(80,170,255,0.2)', label: 'Short' },
      ]
      for (const zn of zones) {
        const z0 = CREASE_Z - (0.35 + zn.from * 8.6)
        const z1 = CREASE_Z - (0.35 + zn.to * 8.6)
        this.poly(
          [
            { x: -hw, y: 0.015, z: z0 },
            { x: hw, y: 0.015, z: z0 },
            { x: hw, y: 0.015, z: z1 },
            { x: -hw, y: 0.015, z: z1 },
          ],
          zn.c,
        )
        const lp = this.cam.project({ x: hw + 0.15, y: 0.02, z: (z0 + z1) / 2 })
        if (lp) {
          this.ctx.fillStyle = 'rgba(255,255,255,0.75)'
          this.ctx.font = `600 ${Math.max(10, Math.min(14, lp.s * 0.35))}px Outfit, sans-serif`
          this.ctx.fillText(zn.label, lp.x + 4, lp.y + 4)
        }
      }
    }
    const white = 'rgba(255,255,255,0.92)'
    for (const zEnd of [0, -PITCH_LEN]) {
      const dir = zEnd === 0 ? -1 : 1
      this.line({ x: -1.32, y: 0.02, z: zEnd }, { x: 1.32, y: 0.02, z: zEnd }, white, 2)
      const pc = zEnd + dir * 1.22
      this.line({ x: -hw - 0.3, y: 0.02, z: pc }, { x: hw + 0.3, y: 0.02, z: pc }, white, 2)
      for (const sx of [-1.32, 1.32]) this.line({ x: sx, y: 0.02, z: zEnd - dir * 1.2 }, { x: sx, y: 0.02, z: pc }, white, 2)
    }
  }

  private ring(x: number, z: number, r: number, color: string, filled = false) {
    const pts: V3[] = []
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2
      pts.push({ x: x + Math.cos(a) * r, y: 0.03, z: z + Math.sin(a) * r })
    }
    const sp = this.cam.polygon(pts)
    if (sp.length < 3) return
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(sp[0].x, sp[0].y)
    for (const q of sp) ctx.lineTo(q.x, q.y)
    ctx.closePath()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = color
    ctx.stroke()
    if (filled) {
      ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.25)')
      ctx.fill()
    }
  }

  private drawStumps(z: number, brokenFor: number) {
    const ctx = this.ctx
    const xs = [-0.115, 0, 0.115]
    xs.forEach((x, i) => {
      let dx = 0
      let dz = 0
      let tilt = 0
      if (brokenFor > 0) {
        const u = Math.min(brokenFor, 0.6)
        dx = (i - 1) * u * 0.6
        dz = u * 0.8
        tilt = (i - 1 || 0.6) * u * 1.4
      }
      const base = this.cam.project({ x: x + dx * 0.2, y: 0, z: z + dz * 0.2 })
      const top = this.cam.project({ x: x + dx + Math.sin(tilt) * 0.5, y: 0.71 * Math.cos(tilt * 0.6), z: z + dz })
      if (!base || !top) return
      ctx.strokeStyle = '#f4e3c1'
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(1.5, base.s * 0.04)
      ctx.beginPath()
      ctx.moveTo(base.x, base.y)
      ctx.lineTo(top.x, top.y)
      ctx.stroke()
    })
    if (brokenFor < 0) {
      const l = this.cam.project({ x: -0.12, y: 0.72, z })
      const r = this.cam.project({ x: 0.12, y: 0.72, z })
      if (l && r) {
        ctx.strokeStyle = '#ffd36b'
        ctx.lineWidth = Math.max(1.2, l.s * 0.025)
        ctx.beginPath()
        ctx.moveTo(l.x, l.y)
        ctx.lineTo(r.x, r.y)
        ctx.stroke()
      }
    } else {
      // flying bails
      const u = Math.min(brokenFor, 1)
      for (const s of [-1, 1]) {
        const b = this.cam.project({ x: s * 0.06 + s * u * 0.8, y: 0.72 + u * 1.6 - u * u * 2.2, z: z + u * 1.2 })
        if (b) {
          ctx.fillStyle = '#ffd36b'
          ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3)
        }
      }
    }
    ctx.lineCap = 'butt'
  }

  private drawBall(b: V3) {
    const ctx = this.ctx
    const sh = this.cam.project({ x: b.x, y: 0, z: b.z })
    const p = this.cam.project(b)
    if (!p) return
    if (sh) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(sh.x, sh.y, Math.max(2, sh.s * 0.07), Math.max(1, sh.s * 0.03), 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // motion trail
    if (this.trail.length > 1) {
      ctx.lineCap = 'round'
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.cam.project(this.trail[i - 1])
        const c = this.cam.project(this.trail[i])
        if (!a || !c) continue
        ctx.strokeStyle = `rgba(255,240,200,${(i / this.trail.length) * 0.55})`
        ctx.lineWidth = Math.max(1.5, (i / this.trail.length) * Math.max(3, c.s * 0.08))
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(c.x, c.y)
        ctx.stroke()
      }
      ctx.lineCap = 'butt'
    }
    const r = Math.max(this.camT > 0.5 ? 4 : 2.8, p.s * 0.055)
    if (this.camT > 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, '#ffe9e0')
    g.addColorStop(1, '#d8c4bb')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(200,30,30,0.7)'
    ctx.lineWidth = Math.max(0.8, r * 0.18)
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 0.7, -0.6, 1.2)
    ctx.stroke()
  }

  private drawPerson(
    x: number,
    z: number,
    col: { main: string; dark: string; light: string },
    role: 'batter' | 'nonstriker' | 'bowler' | 'fielder' | 'keeper' | 'umpire',
    swing: number,
    run: number,
    shotDir: number,
  ) {
    const ctx = this.ctx
    const foot = this.cam.project({ x, y: 0, z })
    const head = this.cam.project({ x, y: 1.8, z })
    if (!foot || !head) return
    const h = foot.y - head.y
    if (h < 2) return
    const u = h / 10 // unit
    const X = foot.x
    const Y = foot.y
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(X, Y, u * 2.4, u * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
    if (h < 7) {
      // tiny: a simple capsule
      ctx.fillStyle = col.main
      ctx.fillRect(X - u * 1.2, Y - h, u * 2.4, h * 0.65)
      ctx.fillStyle = role === 'umpire' ? '#222' : '#f4f4f4'
      ctx.fillRect(X - u * 1.1, Y - h * 0.38, u * 2.2, h * 0.38)
      return
    }
    const stride = Math.sin(run) * (run > 0 ? 1 : 0)
    const legCol = role === 'umpire' ? '#1d1d24' : '#f2f2f2'
    const pad = role === 'batter' || role === 'nonstriker' || role === 'keeper'
    // legs
    const leg = (dx: number, lift: number) => {
      ctx.fillStyle = pad ? '#ffffff' : legCol
      ctx.beginPath()
      ctx.roundRect(X + dx * u - u * 0.75, Y - u * 4.6 - lift * u, u * 1.5, u * 4.6, u * 0.6)
      ctx.fill()
      if (pad) {
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'
        ctx.lineWidth = Math.max(0.5, u * 0.15)
        ctx.beginPath()
        ctx.moveTo(X + dx * u, Y - u * 4.3 - lift * u)
        ctx.lineTo(X + dx * u, Y - u * 0.3 - lift * u)
        ctx.stroke()
      }
      ctx.fillStyle = '#1b1b1b'
      ctx.fillRect(X + dx * u - u * 0.8, Y - u * 0.5 - lift * u, u * 1.6, u * 0.55)
    }
    leg(-0.9 + stride * 0.4, Math.max(0, stride) * 0.8)
    leg(0.9 - stride * 0.4, Math.max(0, -stride) * 0.8)
    // torso
    const tg = ctx.createLinearGradient(X - u * 2, 0, X + u * 2, 0)
    tg.addColorStop(0, col.dark)
    tg.addColorStop(0.45, col.main)
    tg.addColorStop(1, col.dark)
    ctx.fillStyle = role === 'umpire' ? '#f4f4f4' : tg
    ctx.beginPath()
    ctx.roundRect(X - u * 1.9, Y - u * 8.2, u * 3.8, u * 4, u * 1.1)
    ctx.fill()
    if (role !== 'umpire') {
      ctx.fillStyle = col.light
      ctx.fillRect(X - u * 1.9, Y - u * 6.6, u * 3.8, u * 0.35)
    }
    // arms
    ctx.strokeStyle = role === 'umpire' ? '#f4f4f4' : col.main
    ctx.lineCap = 'round'
    ctx.lineWidth = u * 0.95
    const shoulderY = Y - u * 7.6
    if (role === 'bowler') {
      const a = run * 0.9
      ctx.beginPath()
      ctx.moveTo(X - u * 1.6, shoulderY)
      ctx.lineTo(X - u * 1.6 + Math.sin(a) * u * 2.6, shoulderY - Math.cos(a) * u * 2.6)
      ctx.moveTo(X + u * 1.6, shoulderY)
      ctx.lineTo(X + u * 1.6 - Math.sin(a) * u * 2.6, shoulderY + Math.cos(a) * u * 2.6)
      ctx.stroke()
    } else if (role !== 'batter') {
      const sw = Math.sin(run) * u * 1.2
      ctx.beginPath()
      ctx.moveTo(X - u * 1.8, shoulderY)
      ctx.lineTo(X - u * 2.4 + sw, shoulderY + u * 3)
      ctx.moveTo(X + u * 1.8, shoulderY)
      ctx.lineTo(X + u * 2.4 - sw, shoulderY + u * 3)
      ctx.stroke()
    }
    // head
    const hy = Y - u * 9.1
    ctx.fillStyle = '#c98e62'
    ctx.beginPath()
    ctx.arc(X, hy, u * 1.05, 0, Math.PI * 2)
    ctx.fill()
    if (role === 'batter' || role === 'nonstriker' || role === 'keeper') {
      ctx.fillStyle = '#16213f'
      ctx.beginPath()
      ctx.arc(X, hy - u * 0.15, u * 1.2, Math.PI, 0)
      ctx.fill()
      ctx.fillRect(X - u * 1.2, hy - u * 0.2, u * 2.4, u * 0.6)
    } else if (role === 'umpire') {
      ctx.fillStyle = '#f4f4f4'
      ctx.beginPath()
      ctx.ellipse(X, hy - u * 0.6, u * 1.7, u * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = col.main
      ctx.beginPath()
      ctx.arc(X, hy - u * 0.2, u * 1.08, Math.PI, 0)
      ctx.fill()
    }
    // gloves for keeper
    if (role === 'keeper') {
      ctx.fillStyle = '#f2d24b'
      ctx.beginPath()
      ctx.arc(X - u * 2.2, Y - u * 5, u * 0.8, 0, Math.PI * 2)
      ctx.arc(X + u * 2.2, Y - u * 5, u * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    // the bat
    if (role === 'batter' || role === 'nonstriker') {
      let ang: number
      if (role === 'nonstriker') ang = 0.25
      else if (swing < 0) ang = -0.35 // stance: bat grounded behind
      else {
        const e = swing < 0.3 ? -swing / 0.3 : (swing - 0.3) / 0.7
        // backlift then follow through, steered by the shot direction
        ang = swing < 0.3 ? lerp(-0.35, -2.3, -e) : lerp(-2.3, 2.6 - shotDir * 0.8, e)
      }
      const hx = X + u * 1.3
      const hyy = Y - u * 5.6
      ctx.save()
      ctx.translate(hx, hyy)
      ctx.rotate(Math.PI - ang)
      ctx.fillStyle = '#e6c88c'
      ctx.beginPath()
      ctx.roundRect(-u * 0.55, u * 1.2, u * 1.1, u * 4.6, u * 0.3)
      ctx.fill()
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(-u * 0.22, 0, u * 0.44, u * 1.4)
      ctx.restore()
      ctx.strokeStyle = col.main
      ctx.lineWidth = u * 0.95
      ctx.beginPath()
      ctx.moveTo(X - u * 1.5, shoulderY)
      ctx.lineTo(hx, hyy)
      ctx.moveTo(X + u * 1.6, shoulderY)
      ctx.lineTo(hx, hyy)
      ctx.stroke()
    }
    ctx.lineCap = 'butt'
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0)
    for (const p of this.particles) {
      p.vy += 900 * dt
      p.vx *= 0.99
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += dt * 8
      ctx.save()
      ctx.globalAlpha = Math.min(1, p.life)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
  }
}
