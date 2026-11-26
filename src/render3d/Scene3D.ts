import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { bowlStyle, CONTACT_Z, CREASE_Z, FIELDS, fieldFor, PITCH_LEN, STUMP_H, SWING_TIME, trajectory, type Fielder, type Trajectory } from '../game/physics'
import type { BallOutcome, Delivery, FieldSetting, PathPoint, ShotInput, ShotType, TeamId } from '../game/types'
import { LINGER, POST_SPEED, REPLAY_DELAY, REPLAY_SPEED, replaySpan, resultTime, slowWindows } from '../game/pacing'
import type { PlayOptions } from '../render/scene'
import { TEAM_COLORS } from '../render/scene'
import { crowdAmbience, sfx } from '../render/sound'
import { buildStadium, type Stadium } from './stadium'
import { ballTexture, blobTexture, glowTexture, shade } from './textures'
import {
  APPEAL,
  bowlAction,
  CATCH_CHEST,
  CATCH_HIGH,
  cheerPose,
  Cricketer,
  divePose,
  getUpPose,
  HANDS_ON_HEAD,
  IDLE,
  KEEPER_CROUCH,
  lerpPose,
  PICKUP,
  READY,
  runPose,
  throwPose,
  umpirePose,
  walkPose,
  type Kit,
  type Pose,
} from './cricketer'

export type Quality = 'high' | 'medium' | 'low'

const BATTER = { x: -0.42, z: -0.8 }
const NONSTRIKER = { x: -1.05, z: -PITCH_LEN - 0.4 }
const BAT_CAM = { pos: new THREE.Vector3(1.3, 3.9, 8.6), target: new THREE.Vector3(-0.4, 0.4, -12), zoom: 1.6 }
const AIM_CAM = { pos: new THREE.Vector3(0.6, 6.4, 8.2), target: new THREE.Vector3(0, 0, -11), zoom: 1.45 }
export { POST_SPEED }

interface Play {
  opts: PlayOptions
  d: Delivery
  tr: Trajectory
  field: Fielder[]
  start: number
  shot: ShotInput | null
  outcome: BallOutcome | null
  resultAt: number | null
  resultFired: boolean
  noSwingFired: boolean
  contactFired: boolean
  doneFired: boolean
  replay: { from: number; to: number; startReal: number } | null
  replayDone: boolean
  /** Live view clock (see viewTime) and the real time it last advanced from. */
  vt: number
  lastRaw: number
  /** Whether the result was known before bat met ball (only then do hit-stop and slow-mo play). */
  armed: boolean | null
}

const pathEnd = (p: PathPoint[]) => (p.length ? p[p.length - 1].t : 0)
function interp(path: PathPoint[], t: number): THREE.Vector3 {
  if (!path.length) return new THREE.Vector3()
  if (t <= path[0].t) return new THREE.Vector3(path[0].x, path[0].y, path[0].z)
  for (let i = 1; i < path.length; i++) {
    if (path[i].t >= t) {
      const a = path[i - 1]
      const b = path[i]
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t)
      return new THREE.Vector3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u)
    }
  }
  const l = path[path.length - 1]
  return new THREE.Vector3(l.x, l.y, l.z)
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const smooth = (u: number) => {
  const x = clamp(u, 0, 1)
  return x * x * (3 - 2 * x)
}
const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz)

/** Critically damped spring toward a target (Game Programming Gems 4, 1.10). Returns [value, velocity]. */
function smoothDamp(cur: number, target: number, vel: number, time: number, dt: number): [number, number] {
  const w = 2 / Math.max(0.0001, time)
  const x = w * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const ch = cur - target
  const tmp = (vel + w * ch) * dt
  const v = (vel - w * tmp) * e
  return [target + (ch + tmp) * e, v]
}
function smoothDampV(cur: THREE.Vector3, target: THREE.Vector3, vel: THREE.Vector3, time: number, dt: number) {
  for (const k of ['x', 'y', 'z'] as const) {
    const r = smoothDamp(cur[k], target[k], vel[k], time, dt)
    cur[k] = r[0]
    vel[k] = r[1]
  }
}

export function detectQuality(): Quality | '2d' {
  try {
    const q = localStorage.getItem('cvx-quality')
    if (q === 'high' || q === 'medium' || q === 'low' || q === '2d') return q
  } catch {
    /* ignore */
  }
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  if (!gl) return '2d'
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  const cores = navigator.hardwareConcurrency ?? 4
  if (mobile) return cores >= 8 ? 'medium' : 'low'
  return cores >= 6 ? 'high' : 'medium'
}

// ----------------------------------------------------------------------------- shot keyframes
// Bat grip point and blade direction in the batter's local frame
// (+X toward the bowler, +Z the way the batter faces = off side, -Z leg side).
type K = { g: [number, number, number]; d: [number, number, number] }
const STANCE: K = { g: [0.06, 0.78, 0.3], d: [-0.32, -1, -0.04] }
const BACKLIFT: K = { g: [-0.12, 1.22, 0.22], d: [-0.55, 0.78, -0.18] }
const SHOTS: Record<ShotType, { impact: K; follow: K; front: boolean }> = {
  leave: { impact: { g: [-0.05, 1.5, 0.12], d: [-0.3, 0.95, 0.1] }, follow: { g: [-0.05, 1.52, 0.12], d: [-0.3, 0.95, 0.1] }, front: false },
  miss: { impact: { g: [0.3, 0.8, 0.3], d: [0.3, -0.95, 0.05] }, follow: { g: [0.22, 1.35, 0.05], d: [-0.35, 0.8, -0.45] }, front: true },
  block: { impact: { g: [0.33, 0.8, 0.28], d: [0.32, -0.95, 0.03] }, follow: { g: [0.34, 0.8, 0.28], d: [0.32, -0.95, 0.03] }, front: true },
  'straight drive': { impact: { g: [0.32, 0.76, 0.32], d: [0.22, -0.97, 0] }, follow: { g: [0.28, 1.5, 0.05], d: [-0.35, 0.8, -0.45] }, front: true },
  'cover drive': { impact: { g: [0.3, 0.76, 0.38], d: [0.2, -0.97, 0.1] }, follow: { g: [0.2, 1.48, 0.25], d: [-0.4, 0.75, -0.3] }, front: true },
  'on drive': { impact: { g: [0.3, 0.76, 0.26], d: [0.2, -0.97, -0.1] }, follow: { g: [0.25, 1.45, -0.1], d: [-0.3, 0.75, -0.6] }, front: true },
  'lofted drive': { impact: { g: [0.32, 0.8, 0.32], d: [0.35, -0.93, 0] }, follow: { g: [0.15, 1.65, -0.05], d: [-0.55, 0.75, -0.35] }, front: true },
  flick: { impact: { g: [0.3, 0.74, 0.22], d: [0.25, -0.95, -0.15] }, follow: { g: [0.12, 1.15, -0.2], d: [-0.2, 0.45, -0.87] }, front: true },
  slog: { impact: { g: [0.24, 0.92, 0.22], d: [0.45, -0.75, -0.45] }, follow: { g: [-0.05, 1.55, -0.25], d: [-0.5, 0.65, -0.55] }, front: true },
  pull: { impact: { g: [0.16, 1.15, 0.3], d: [0.85, -0.15, 0.5] }, follow: { g: [-0.05, 1.32, -0.15], d: [-0.55, 0.25, -0.8] }, front: false },
  hook: { impact: { g: [0.12, 1.3, 0.28], d: [0.8, 0.05, 0.6] }, follow: { g: [-0.1, 1.5, -0.2], d: [-0.6, 0.45, -0.65] }, front: false },
  cut: { impact: { g: [0.2, 1.0, 0.46], d: [0.35, -0.35, 0.87] }, follow: { g: [0.05, 0.86, 0.46], d: [-0.3, -0.6, 0.74] }, front: false },
  'upper cut': { impact: { g: [0.15, 1.25, 0.45], d: [0.3, 0.1, 0.95] }, follow: { g: [-0.05, 1.5, 0.3], d: [-0.5, 0.7, 0.5] }, front: false },
}
const v3 = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2])
function lerpK(a: K, b: K, u: number): { g: THREE.Vector3; d: THREE.Vector3 } {
  return { g: v3(a.g).lerp(v3(b.g), u), d: v3(a.d).normalize().lerp(v3(b.d).normalize(), u).normalize() }
}

// ----------------------------------------------------------------------------- the scene

export class Scene3D {
  canvas: HTMLCanvasElement
  quality: Quality
  play: Play | null = null
  aim: { x: number; z: number } | null = null
  showZones = false
  /** Field placement shown while idle (the bowler's current choice). */
  field: FieldSetting = 'balanced'
  onReplay: ((on: boolean) => void) | null = null
  /** Whether a non-striker is at the crease (false for a lone batter). */
  partner = true

  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900)
  private stadium: Stadium
  private key: THREE.DirectionalLight
  private raf = 0
  private last = performance.now()
  private clock = 0
  private _batting: TeamId = 'A'
  private _bowling: TeamId = 'B'

  // actors
  private striker!: Cricketer
  private nonStriker!: Cricketer
  private bowler!: Cricketer
  private keeper!: Cricketer
  private fielders: Cricketer[] = []
  private umpires: Cricketer[] = []
  private fieldPos: THREE.Vector3[] = []
  /** How far the fielders have walked in with the bowler (metres). */
  private walkIn = 0
  /** Sound cues: the play and view time they were last checked at, and the crowd swell level. */
  private sndPlay: Play | null = null
  private sndT = -99
  private swell = 0
  private actorsReplay = false

  // props
  private ball: THREE.Mesh
  private ballShadow: THREE.Mesh
  private trail: THREE.Sprite[] = []
  private trailPts: THREE.Vector3[] = []
  private bounceRing: THREE.Mesh
  private aimRing: THREE.Mesh
  private zones: THREE.Group
  private stumps: { group: THREE.Group; parts: THREE.Mesh[]; z: number }[] = []
  private particles: { pts: THREE.Points; vel: Float32Array; life: number; max: number }[] = []

  // camera state
  private camPos = BAT_CAM.pos.clone()
  private camTarget = BAT_CAM.target.clone()
  private camZoom = BAT_CAM.zoom
  private camPosVel = new THREE.Vector3()
  private camTargetVel = new THREE.Vector3()
  private camZoomVel = 0
  private shake = 0
  /** Zoom impulse queued for the next camera update (bat-on-ball punch). */
  private kick = 0
  private excitement = 0

  constructor(canvas: HTMLCanvasElement, quality: Quality = 'high') {
    this.canvas = canvas
    this.quality = quality
    const r = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' })
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1))
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.08
    r.shadowMap.enabled = quality !== 'low'
    r.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer = r

    const sc = this.scene
    sc.fog = new THREE.Fog(0x0a1230, 180, 420)
    sc.background = skyTexture()

    // ---- lights: night match under floodlights
    sc.add(new THREE.HemisphereLight(0xb8c8ff, 0x1d3b1d, 0.85))
    const key = new THREE.DirectionalLight(0xfff4e0, 2.4)
    key.position.set(30, 70, 25)
    key.castShadow = quality !== 'low'
    const sm = quality === 'high' ? 2048 : 1024
    key.shadow.mapSize.set(sm, sm)
    const sc2 = key.shadow.camera
    sc2.left = -34
    sc2.right = 34
    sc2.top = 34
    sc2.bottom = -34
    sc2.near = 10
    sc2.far = 200
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.03
    sc.add(key)
    sc.add(key.target)
    this.key = key
    for (const [x, z, i] of [[-60, -40, 0.7], [50, -70, 0.55], [-40, 60, 0.5]] as const) {
      const fill = new THREE.DirectionalLight(0xe6ecff, i)
      fill.position.set(x, 60, z)
      sc.add(fill)
    }

    this.stadium = buildStadium(quality)
    this.stadium.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.receiveShadow = true
    })
    sc.add(this.stadium.group)

    // ---- stumps at both ends
    for (const z of [0, -PITCH_LEN]) this.stumps.push(buildStumps(z, quality !== 'low'))
    for (const s of this.stumps) sc.add(s.group)

    // ---- ball, shadow, trail, markers
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.036 * 1.6, 18, 12), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.35, emissive: 0x330000 }))
    this.ball.castShadow = quality !== 'low'
    sc.add(this.ball)
    this.ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }))
    this.ballShadow.rotation.x = -Math.PI / 2
    sc.add(this.ballShadow)
    const glow = glowTexture()
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
      s.visible = false
      this.trail.push(s)
      sc.add(s)
    }
    this.bounceRing = ring(0.22, 0.3, 0xffd23f)
    sc.add(this.bounceRing)
    this.aimRing = ring(0.2, 0.32, 0xff3b3b)
    sc.add(this.aimRing)
    this.zones = buildZones()
    sc.add(this.zones)

    this.buildActors()

    if (quality === 'high') {
      const comp = new EffectComposer(r)
      comp.addPass(new RenderPass(sc, this.camera))
      this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.6, 0.93)
      comp.addPass(this.bloom)
      comp.addPass(new OutputPass())
      this.composer = comp
    }

    this.loop()
  }

  // ----------------------------------------------------------------------------- teams / actors

  get batting() {
    return this._batting
  }
  set batting(t: TeamId) {
    if (t === this._batting) return
    this._batting = t
    this.buildActors()
  }
  get bowling() {
    return this._bowling
  }
  set bowling(t: TeamId) {
    if (t === this._bowling) return
    this._bowling = t
    this.buildActors()
  }

  private kit(team: TeamId, role: 'bat' | 'field' | 'keeper'): Kit {
    const c = TEAM_COLORS[team]
    return {
      shirt: c.main,
      trim: c.dark,
      trousers: shade(c.dark, -0.15),
      skin: ['#d9a07a', '#a46a45', '#f0c39f', '#7f4e30'][Math.floor(Math.random() * 4)],
      hat: role === 'bat' ? 'helmet' : role === 'keeper' ? 'helmet' : Math.random() < 0.6 ? 'cap' : 'none',
      pads: role !== 'field',
      gloves: role !== 'field',
    }
  }

  private buildActors() {
    const sh = this.quality !== 'low'
    const ol = this.quality === 'high' // cartoon outlines cost a draw call per part, so only on High
    for (const a of [this.striker, this.nonStriker, this.bowler, this.keeper, ...this.fielders, ...this.umpires]) a?.dispose()
    this.striker = new Cricketer('batter', this.kit(this._batting, 'bat'), sh, { bat: true, outline: ol })
    this.nonStriker = new Cricketer('batter', this.kit(this._batting, 'bat'), sh, { bat: true, outline: ol })
    this.bowler = new Cricketer('bowler', { ...this.kit(this._bowling, 'field'), hat: 'none' }, sh, { outline: ol })
    this.keeper = new Cricketer('keeper', this.kit(this._bowling, 'keeper'), sh, { outline: ol })
    this.fielders = []
    for (let i = 2; i < 11; i++) this.fielders.push(new Cricketer('fielder', this.kit(this._bowling, 'field'), sh && this.quality === 'high', { outline: ol }))
    const umpKit: Kit = { shirt: '#f2efe6', trim: '#1b1f2e', trousers: '#1b1f2e', skin: '#b98260', hat: 'hat', pads: false, gloves: false }
    this.umpires = [new Cricketer('umpire', umpKit, sh, { outline: ol }), new Cricketer('umpire', umpKit, false, { outline: ol })]
    for (const a of [this.striker, this.nonStriker, this.bowler, this.keeper, ...this.fielders, ...this.umpires]) this.scene.add(a.root)
    this.fieldPos = FIELDS[this.field].map((f) => new THREE.Vector3(f.x, 0, f.z))
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose?.()
    })
  }

  private onResize = () => this.resize()

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000))
    this.last = now
    this.clock += dt
    this.frame(now, dt)
  }

  // ----------------------------------------------------------------------------- play control (same API as the 2D Scene)

  playDelivery(opts: PlayOptions) {
    const tr = trajectory(opts.delivery)
    this.play = {
      opts,
      d: opts.delivery,
      tr,
      field: fieldFor(opts.delivery),
      start: performance.now(),
      shot: opts.shot ?? null,
      outcome: opts.outcome ?? null,
      resultAt: null,
      resultFired: false,
      noSwingFired: false,
      contactFired: false,
      doneFired: false,
      replay: null,
      replayDone: false,
      vt: -99,
      lastRaw: -99,
      armed: null,
    }
    if (opts.delivery.field) this.field = opts.delivery.field
    this.aim = null
    if (opts.outcome) this.setOutcome(opts.outcome)
  }

  flightTime(now = performance.now()) {
    if (!this.play) return -99
    return (now - this.play.start) / 1000 - bowlStyle(this.play.d.type).runup
  }

  swing(dir: number, loft: boolean, now = performance.now()): ShotInput | null {
    const p = this.play
    if (!p || !p.opts.live || p.shot) return null
    const t = this.flightTime(now)
    if (t < 0.05) return null
    const timing = (t + SWING_TIME - p.tr.tContact) * 1000
    p.shot = { swung: true, dir, loft, timing }
    return p.shot
  }

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
    p.resultAt = resultTime(p.d, o, this.hitTime(p))
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

  /**
   * When bat meets ball on screen. The swing starts at the tap and is drawn so the bat lands
   * on the ball; a late tap can only push contact back a fraction (the ball can't wait).
   */
  private hitTime(p: Play) {
    const s = p.shot
    if (!s?.swung || !p.outcome?.path.length) return p.tr.tContact
    const tap = p.tr.tContact - SWING_TIME + s.timing / 1000
    return p.tr.tContact + clamp(tap + 0.045 - p.tr.tContact, 0, 0.02)
  }

  /**
   * The live view's clock. It follows real time exactly until bat meets ball (so what you see
   * is what you time against), then holds for a beat on a sweet hit and plays the rest of the
   * ball briskly.
   */
  private viewTime(p: Play, raw: number) {
    const o = p.outcome
    const moment = !o ? null : o.path.length ? this.hitTime(p) : p.tr.tContact
    if (moment === null || raw <= moment) {
      p.vt = raw
      p.lastRaw = raw
      return raw
    }
    if (p.armed === null) p.armed = p.vt <= moment
    const step = p.vt < moment ? raw - moment : clamp(raw - p.lastRaw, 0, 0.1)
    p.lastRaw = raw
    const since = raw - moment
    let rate = POST_SPEED
    if (p.armed && o!.path.length && !o!.edged) {
      const stop = o!.grade === 'perfect' || o!.boundary ? 0.07 : o!.grade === 'good' ? 0.04 : 0
      if (since < stop) rate = 0
      else rate = POST_SPEED * clamp((since - stop) / 0.08, 0.35, 1)
    }
    // live slow motion over the big moment, easing in and out
    if (p.armed) {
      for (const [w0, w1, r] of this.slowWindows(p)) {
        const e = Math.min(smooth((p.vt - (w0 - 0.06)) / 0.06), 1 - smooth((p.vt - w1) / 0.1))
        if (e > 0) rate = Math.min(rate, POST_SPEED + (r - POST_SPEED) * e)
      }
    }
    p.vt = Math.max(p.vt, moment) + step * rate
    return p.vt
  }

  /** View-time windows [from, to, rate] that play in slow motion live (shared with the room's pacing). */
  private slowWindows(p: Play): [number, number, number][] {
    return p.outcome ? slowWindows(p.d, p.outcome, this.hitTime(p)) : []
  }

  /** Skip an in-progress replay. */
  skipReplay() {
    const p = this.play
    if (p?.replay) p.replay.startReal = -1e9
  }

  burst(kind: 'four' | 'six' | 'wicket', at?: THREE.Vector3) {
    const colors = kind === 'wicket' ? [0xff3b3b, 0xffffff, 0xffb3b3] : [0xffd23f, 0xff6a1f, 0x1aa7ff, 0xffffff, 0x2bd17e, 0xff5fa2]
    const spots: THREE.Vector3[] = []
    if (kind === 'six') for (let i = 0; i < 5; i++) spots.push(new THREE.Vector3((Math.random() - 0.5) * 160, 55 + Math.random() * 25, -10 + (Math.random() - 0.5) * 160))
    else spots.push(at ?? new THREE.Vector3(0, 2, -1))
    for (const s of spots) this.spawnParticles(s, kind === 'six' ? 220 : kind === 'four' ? 140 : 80, colors, kind === 'six' ? 16 : kind === 'four' ? 7 : 4)
    if (kind === 'wicket') this.shake = 0.45
    this.excitement = kind === 'six' ? 1 : kind === 'four' ? 0.8 : 0.7
  }

  /**
   * Sounds tied to what is on screen: each fires as the view clock passes its moment, so the
   * thud lands when the ball hits the pitch, not when the server decided it would.
   */
  private sounds(p: Play | null, t: number, replay: boolean) {
    if (!p) {
      this.sndPlay = null
      return
    }
    if (this.sndPlay !== p) {
      this.sndPlay = p
      this.sndT = -99
    } else if (t < this.sndT - 1e-4) {
      this.sndT = t // jumped back (replay start): pick up from here
      return
    }
    const a = this.sndT
    this.sndT = t
    const cross = (x: number) => a < x && t >= x
    const o = p.outcome
    const tr = p.tr
    const st = bowlStyle(p.d.type)
    const s = st.gather / 0.36
    if (!replay) for (const x of [-0.17 * s, -0.07 * s]) if (cross(x)) sfx.step(st.k)
    if (!replay && cross(0)) sfx.release(st.k)
    const hit = !!o?.path.length
    const th = o ? this.hitTime(p) : Infinity
    if (cross(tr.tBounce) && (!hit || tr.tBounce < th)) {
      sfx.pitch(st.k)
      this.spawnParticles(new THREE.Vector3(tr.bounceX, 0.05, tr.bounceZ), 10 + Math.round(10 * st.k), [0xd9c49a, 0xc4ab7c, 0xe8dcc0], 1.2 + st.k, { size: 0.09, life: 0.5, additive: false })
    }
    if (!o) return
    if (replay && hit && cross(th)) sfx.bat(o.grade === 'perfect' ? 1 : o.grade === 'good' ? 0.7 : 0.35, o.edged)
    if (!hit) {
      if (o.wicket === 'bowled') {
        if (cross(tr.tStumps)) sfx.stumps()
      } else if (o.wicket === 'lbw') {
        if (cross(tr.tContact)) sfx.pitch(0.2) // ball into pad
      } else if (cross(tr.tStumps + 0.12)) sfx.gloves()
      if (o.wicket === 'stumped' && cross(tr.tStumps + 0.3)) sfx.stumps()
      if (!replay && !o.wicket && p.shot?.swung && cross(tr.tStumps + 0.15)) sfx.ooh()
      return
    }
    const pEnd = pathEnd(o.path)
    if ((o.wicket === 'caught' || o.wicket === 'caught behind') && cross(th + pEnd)) sfx.gloves(true)
    if (o.throwPath.length && cross(th + pathEnd(o.throwPath))) {
      if (o.wicket === 'run out') sfx.stumps()
      else sfx.gloves()
    }
    if (!replay && o.edged && !o.wicket && cross(th + 0.35)) sfx.ooh()
    // bats grounded at each crease
    const runs = !o.boundary && !o.wicket && o.extra !== 'wide' ? (o.extra === 'noball' ? o.runs - 1 : o.runs) : o.wicket === 'run out' ? Math.max(1, o.runs) : 0
    const runDur = clamp((pEnd + 1.4) / Math.max(1, runs), 1.3, 2.4)
    for (let k = 1; k <= runs; k++) if (cross(th + 0.1 + k * runDur)) sfx.run()
    // the crowd rises with a ball in the air, and settles if it comes to nothing
    if (!replay) {
      const hitT = t - th
      const ball = this.ball.position
      let level = 0.12
      if (hitT > 0 && hitT < pEnd && !p.resultFired) level = 0.12 + clamp((ball.y - 2) / 22, 0, 0.32)
      if (p.resultFired && !o.boundary) level = 0.12
      if (Math.abs(level - this.swell) > 0.02 && !(p.resultFired && o.boundary)) {
        this.swell = level
        crowdAmbience(true, level)
      }
    }
  }

  /** Bat meets ball: a beat of camera punch, a puff off the bat. */
  private impact(p: Play) {
    const o = p.outcome!
    const q = o.edged ? 0.25 : o.grade === 'perfect' ? 1 : o.grade === 'good' ? 0.7 : 0.4
    this.kick = 0.9 * q
    this.shake = Math.max(this.shake, 0.08 * q)
    const at = v(p.tr.pos(this.hitTime(p)))
    this.spawnParticles(at, Math.round(14 + 24 * q), [0xfff4d6, 0xe8d3a8, 0xffffff], 2.2 + 2.5 * q, { size: 0.07, life: 0.45, additive: false })
  }

  private spawnParticles(at: THREE.Vector3, n: number, colors: number[], speed: number, opts: { size?: number; life?: number; additive?: boolean } = {}) {
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3)
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const sp = speed * (0.4 + Math.random() * 0.6)
      vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp * 0.8 + speed * 0.3, Math.sin(ph) * Math.sin(th) * sp], i * 3)
      c.setHex(colors[i % colors.length])
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const m = new THREE.PointsMaterial({
      size: opts.size ?? (speed > 10 ? 1.4 : 0.35),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      map: glowTexture(),
    })
    const pts = new THREE.Points(g, m)
    this.scene.add(pts)
    this.particles.push({ pts, vel, life: 0, max: opts.life ?? 2.2 })
  }

  setScoreboard(big: string, small: string, color: string) {
    this.stadium.scoreboard({ big, small, color })
  }

  // ----------------------------------------------------------------------------- input helpers

  private ray = new THREE.Raycaster()
  groundAt(sx: number, sy: number) {
    const r = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    const o = this.ray.ray.origin
    const d = this.ray.ray.direction
    if (d.y >= -1e-4) return null
    const k = -o.y / d.y
    return { x: o.x + d.x * k, z: o.z + d.z * k }
  }

  batterScreen() {
    const r = this.canvas.getBoundingClientRect()
    const v = new THREE.Vector3(0, 0.8, CONTACT_Z).project(this.camera)
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height }
  }

  // ----------------------------------------------------------------------------- frame

  resize() {
    const r = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(r.width))
    const h = Math.max(1, Math.round(r.height))
    this.renderer.setSize(w, h, false)
    this.composer?.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private sizeKey = ''
  private frame(now: number, dt: number) {
    const r = this.canvas.getBoundingClientRect()
    const key = `${Math.round(r.width)}x${Math.round(r.height)}`
    if (key !== this.sizeKey) {
      this.sizeKey = key
      this.resize()
    }
    if (r.width < 10 || r.height < 10) return

    const p = this.play
    const rawT = p ? this.flightTime(now) : -99
    const realT = p ? this.viewTime(p, rawT) : rawT
    let viewT = realT
    if (p?.replay) viewT = p.replay.from + ((now - p.replay.startReal) / 1000) * REPLAY_SPEED

    // a camera cut into or out of the replay: bodies jump to the new moment instead of blending
    if (!!p?.replay !== this.actorsReplay) {
      this.actorsReplay = !!p?.replay
      for (const a of [this.striker, this.nonStriker, this.bowler, this.keeper, ...this.fielders, ...this.umpires]) a.cut()
    }
    this.updateWorld(p, viewT, dt, !!p?.replay)
    this.sounds(p, viewT, !!p?.replay)
    this.updateCamera(p, viewT, dt, !!p?.replay, r.width, r.height)
    this.updateParticles(dt)
    this.stadium.crowd.update(this.clock, this.excitement)
    this.excitement = Math.max(0.05, this.excitement - dt * 0.12)

    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)

    if (p) this.tick(p, realT, now)
  }

  private tick(p: Play, t: number, now: number) {
    if (p.opts.live && !p.shot && !p.noSwingFired && this.flightTime(now) > p.tr.tContact + 0.32) {
      p.noSwingFired = true
      p.shot = { swung: false, dir: 0, loft: false, timing: 0 }
      p.opts.onNoSwing?.()
    }
    if (p.outcome && p.outcome.path.length && !p.contactFired && t >= this.hitTime(p)) {
      p.contactFired = true
      this.impact(p)
      p.opts.onContact?.(p.outcome)
    }
    if (p.outcome && p.resultAt !== null && !p.resultFired && t >= p.resultAt) {
      p.resultFired = true
      const o = p.outcome
      const endP = o.path.length ? o.path[o.path.length - 1] : null
      if (o.boundary === 6) this.burst('six')
      else if (o.boundary === 4 && endP) this.burst('four', new THREE.Vector3(endP.x, 1.5, endP.z))
      else if (o.wicket) this.burst('wicket', new THREE.Vector3(0, 1, o.wicket === 'run out' ? (o.throwPath.at(-1)?.z ?? 0) : 0))
      p.opts.onResult?.(o)
    }
    if (p.resultFired && !p.doneFired) {
      const o = p.outcome!
      const wantReplay = (o.boundary === 6 || !!o.wicket) && !p.replayDone
      const since = t - (p.resultAt ?? 0)
      if (wantReplay && !p.replay && since >= REPLAY_DELAY) {
        const [from, to] = replaySpan(p.d, o, this.hitTime(p))
        p.replay = { from, to, startReal: now }
        this.onReplay?.(true)
      }
      if (p.replay) {
        const el = ((now - p.replay.startReal) / 1000) * REPLAY_SPEED
        if (el >= p.replay.to - p.replay.from) {
          p.replay = null
          p.replayDone = true
          this.onReplay?.(false)
          this.finish(p)
        }
      } else if (!wantReplay && since >= LINGER) this.finish(p)
    }
  }

  private finish(p: Play) {
    p.doneFired = true
    const cb = p.opts.onDone
    this.play = null
    cb?.()
  }

  // ----------------------------------------------------------------------------- world state

  private updateWorld(p: Play | null, t: number, dt: number, replay: boolean) {
    const field = p ? p.field : FIELDS[this.field]
    const o = p?.outcome ?? null
    const tr = p?.tr ?? null
    const th = p && o ? this.hitTime(p) : 0
    const hitT = p && o && o.path.length && t >= th ? t - th : null
    const pEnd = o ? pathEnd(o.path) : 0

    // ---- ball
    let ball = new THREE.Vector3(0.5, 2.1, -20)
    let ballVisible = false
    if (p && tr) {
      if (t < 0) {
        ballVisible = true // in the bowler's hand, placed below
      } else if (hitT !== null && o) {
        ballVisible = true
        if (hitT <= pEnd) {
          ball = interp(o.path, hitT)
          // leave from where the ball really met the bat, easing onto the computed flight
          if (hitT < 0.25) ball.addScaledVector(v(tr.pos(th)).sub(v(o.path[0])), 1 - smooth(hitT / 0.25))
        }
        else if (o.throwPath.length && hitT >= o.throwPath[0].t) ball = interp(o.throwPath, hitT)
        else if (o.throwPath.length && o.fielder >= 1 && hitT > pEnd + 0.06) {
          // picked up: in the fielder's hand until the throw
          const f = o.fielder === 1 ? this.bowler : this.fielders[o.fielder - 2]
          ball = f ? f.handWorld('r') : interp(o.path, pEnd)
        } else if (o.wicket === 'caught' || o.wicket === 'caught behind') {
          const f = o.fielder === 0 ? this.keeper : o.fielder === 1 ? this.bowler : this.fielders[o.fielder - 2]
          ball = f ? f.handWorld('r') : interp(o.path, pEnd)
        } else ball = interp(o.path, pEnd)
      } else {
        ballVisible = true
        const tt = Math.min(t, tr.tStumps + 0.6)
        ball = v(tr.pos(tt))
        if ((o?.wicket === 'bowled') && t > tr.tStumps) {
          const u = t - tr.tStumps
          const s = tr.pos(tr.tStumps)
          ball = new THREE.Vector3(s.x + u * 0.6, Math.max(0.04, s.y + u * 1.2 - 4 * u * u), s.z + u * 1.2)
        } else if (o?.wicket === 'lbw' && t > tr.tContact) {
          const u = t - tr.tContact
          const c = tr.pos(tr.tContact)
          ball = new THREE.Vector3(c.x + u * 0.4, Math.max(0.04, c.y - 4 * u * u), c.z - u * 1.5)
        } else if (ball.z > 2.95) {
          ball = new THREE.Vector3(ball.x * 0.5, Math.max(0.6, ball.y), 2.95) // into the keeper's gloves
        }
      }
    }

    // ---- bowler
    const bw = this.bowler
    const releaseX = p ? 0.35 * p.d.turn * (p.d.type === 'spin' ? 0.4 : 1) : 0.35
    const bx = releaseX + 0.28
    const relZ = -20.6
    const reacting = !!(p && o && p.resultFired && !replay && p.resultAt !== null)
    const since = reacting ? t - p!.resultAt! : 0
    if (!p) {
      // between balls: walk back to the mark, then turn round and wait
      const mark = bw.memo.mark ?? -29
      const pos = bw.root.position
      if (pos.z > mark + 0.1) {
        pos.z = Math.max(mark, pos.z - dt * 3.4)
        pos.x += (0.63 - pos.x) * Math.min(1, dt * 1.2)
        bw.faceYaw(Math.PI, dt, 5)
        bw.animate('walkback', walkPose(bw.stride(dt, 0.8).phase), dt, 0.4)
      } else {
        pos.z = mark
        bw.faceYaw(0, dt, 4)
        bw.stride(dt)
        bw.animate('wait', lerpPose(IDLE, { spine: [0.05, 0, 0] }, 0.5), dt, 0.45)
      }
      bw.heldBall!.visible = true
    } else if (t < 0) {
      const st = bowlStyle(p.d.type)
      if (bw.memo.play !== p.start) {
        bw.memo.play = p.start
        bw.memo.mark = st.mark
        bw.memo.dz = clamp(bw.root.position.z - st.mark, -6, 6)
        bw.memo.dx = bw.root.position.x - bx
      }
      const zG = relZ - st.bound - st.step
      const appT = st.runup - st.gather
      let z: number
      let x = bx
      if (t < -st.gather) {
        // the approach builds speed all the way to the crease
        const u = clamp((t + st.runup) / appT, 0, 1)
        const fix = 1 - smooth(u / 0.6)
        z = THREE.MathUtils.lerp(st.mark, zG, Math.pow(u, 1.5)) + bw.memo.dz * fix
        x = bx + bw.memo.dx * fix
      } else {
        const g = (t + st.gather) / st.gather
        z = zG + (relZ - zG) * g * (1.25 - 0.25 * g)
      }
      bw.root.position.set(x, 0, z)
      bw.faceYaw(0, dt, 8)
      const s = bw.stride(dt, st.stepLen)
      if (t < -st.gather - 0.04) bw.animate('runup', runPose(s.phase, Math.max(0.55, s.effort)), dt, 0.3)
      else bw.animate('deliver', bowlAction(t, st.gather, st.k), dt, 0.08)
      bw.heldBall!.visible = true
    } else {
      const st = bowlStyle(p.d.type)
      bw.heldBall!.visible = false
      const ft = Math.min(t, 1.4)
      const fe = 1 - Math.pow(1 - ft / 1.4, 2)
      // follow through, peeling away off the pitch
      bw.root.position.set(bx + 1.5 * fe * (0.4 + 0.6 * st.k), 0, relZ + st.follow * fe)
      const fielderIdx = o?.fielder ?? -1
      const s = bw.stride(dt, st.stepLen)
      if (hitT !== null && fielderIdx === 1 && o && !reacting) this.animateChaser(bw, o, hitT, pEnd, new THREE.Vector3(bx + 0.5, 0, -17), dt)
      else {
        if (reacting && o!.wicket) bw.animate(since < 0.9 ? 'appeal' : 'cheer', since < 0.9 ? APPEAL : cheerPose(this.clock, 1), dt, 0.18)
        else if (reacting && o!.boundary) bw.animate('gutted', HANDS_ON_HEAD, dt, 0.3)
        else if (t < 0.42) bw.animate('deliver', bowlAction(t, st.gather, st.k), dt, 0.08)
        else if (t < 1.35) bw.animate('followrun', runPose(s.phase, s.effort), dt, 0.15)
        else bw.animate('ready', READY, dt, 0.35)
        bw.faceYaw(hitT !== null ? yawTo(ball.x - bw.root.position.x, ball.z - bw.root.position.z) : reacting && o!.wicket ? -0.5 : 0, dt, 7)
      }
    }
    if (p && t < 0) ball = bw.handWorld('r')

    // ---- striker
    this.animateStriker(p, t, hitT, pEnd, dt)

    // ---- non-striker: backs up, then runs
    const ns = this.nonStriker
    ns.root.visible = this.partner
    const runs = o && !o.boundary && !o.wicket && o.extra !== 'wide' ? (o.extra === 'noball' ? o.runs - 1 : o.runs) : o?.wicket === 'run out' ? Math.max(1, o.runs) : 0
    const runDur = clamp((pEnd + 1.4) / Math.max(1, runs), 1.3, 2.4)
    if (hitT !== null && runs > 0) {
      this.animateRunner(ns, hitT, runs, runDur, -1, 0.75, dt)
    } else {
      const backing = p && t > -0.3 ? Math.min(1.4, (t + 0.3) * 1.6) : 0
      ns.root.position.set(NONSTRIKER.x, 0, NONSTRIKER.z + backing)
      ns.faceYaw(0, dt, 8)
      const s = ns.stride(dt, 0.8)
      if (backing > 0.05 && backing < 1.4) ns.animate('backup', walkPose(s.phase), dt, 0.2)
      else ns.animate('idle', IDLE, dt, 0.4)
      ns.holdBat(new THREE.Vector3(-0.15, 0.8, 0.22), new THREE.Vector3(0.1, -1, 0.35), new THREE.Vector3(0, 0, 1))
    }

    // ---- keeper
    const kp = this.keeper
    kp.root.rotation.y = Math.PI
    kp.root.position.set(0, 0, 3.2)
    if (hitT !== null && o?.fielder === 0 && o.wicket === 'caught behind') {
      kp.animate('catch', lerpPose(KEEPER_CROUCH, CATCH_HIGH, smooth(hitT / 0.3)), dt, 0.06)
      kp.root.position.x = THREE.MathUtils.lerp(0, o.path.at(-1)!.x, smooth(hitT / 0.3))
    } else if (p && tr && t > tr.tBounce && hitT === null) {
      const u = smooth((t - tr.tBounce) / 0.35)
      kp.animate('take', lerpPose(KEEPER_CROUCH, lerpPose(READY, CATCH_HIGH, 0.4), u), dt, 0.06)
      kp.root.position.x = THREE.MathUtils.lerp(0, clamp(ball.x, -1, 1), u)
    } else if (hitT !== null) {
      // after a hit, the keeper runs up to the stumps for the return
      const u = smooth(hitT / 1.2)
      kp.root.position.set(0.3, 0, THREE.MathUtils.lerp(3.2, 1.3, u))
      kp.animate('up', lerpPose(KEEPER_CROUCH, READY, u), dt, 0.1)
    } else if (p && tr && t > -0.5) {
      // rises slightly out of the crouch as the bowler lets go
      kp.animate('crouch', lerpPose(KEEPER_CROUCH, READY, 0.18 * smooth((t + 0.5) / 0.5)), dt, 0.3)
    } else kp.animate('crouch', KEEPER_CROUCH, dt, 0.3)
    if (reacting && o!.wicket && hitT === null) kp.animate('cheer', cheerPose(this.clock, 2), dt, 0.25)

    // ---- fielders (indices 2..10 of the field)
    const runupT = p ? bowlStyle(p.d.type).runup : 1.2
    const walkTarget = p ? smooth((t + runupT) / (runupT + 0.3)) * 1.8 : 0
    // walking in with the bowler, and back out between balls (never a jump)
    this.walkIn += clamp(walkTarget - this.walkIn, -dt * 1.1, dt * 1.6)
    if (replay) this.walkIn = walkTarget
    for (let i = 2; i < 11; i++) {
      const f = this.fielders[i - 2]
      const base = field[i]
      // drift smoothly toward a new field setting between balls
      const fp = this.fieldPos[i] ?? new THREE.Vector3(base.x, 0, base.z)
      fp.x += (base.x - fp.x) * Math.min(1, dt * 1.5)
      fp.z += (base.z - fp.z) * Math.min(1, dt * 1.5)
      this.fieldPos[i] = fp
      const toBat = new THREE.Vector3(-fp.x, 0, -1 - fp.z).normalize()
      const home = fp.clone().addScaledVector(toBat, this.walkIn)
      if (hitT !== null && o && i === o.fielder) {
        this.animateChaser(f, o, hitT, pEnd, home, dt)
      } else if (hitT !== null && o) {
        // back up: drift a few metres toward the ball
        const d = new THREE.Vector3(ball.x - home.x, 0, ball.z - home.z)
        const dist = d.length() || 1
        const move = Math.min(Math.max(0, hitT - 0.3) * 2.5, 5, dist * 0.3)
        f.root.position.copy(home).addScaledVector(d.normalize(), move)
        f.faceYaw(yawTo(ball.x - f.root.position.x, ball.z - f.root.position.z), dt, 8)
        const s = f.stride(dt, 1.2)
        f.animate(s.effort > 0.18 && hitT < pEnd + 0.4 ? 'jog' : 'ready', s.effort > 0.18 && hitT < pEnd + 0.4 ? runPose(s.phase, s.effort) : READY, dt, 0.25)
      } else {
        f.root.position.copy(home)
        f.faceYaw(yawTo(-home.x, -1 - home.z), dt, 5)
        const s = f.stride(dt, 0.8)
        if (f.speed > 0.35) f.animate('walk', walkPose(s.phase), dt, 0.3)
        else f.animate(p ? 'ready' : 'idle', p ? READY : IDLE, dt, 0.4)
      }
      // celebrate a wicket together; the chaser is gutted by a boundary
      if (reacting && o!.wicket) {
        f.animate('cheer', cheerPose(this.clock, i * 1.7), dt, 0.25)
        f.faceYaw(yawTo(-f.root.position.x, -10 - f.root.position.z), dt, 4)
      } else if (reacting && o!.boundary && i === o!.fielder) f.animate('gutted', HANDS_ON_HEAD, dt, 0.35)
      f.root.position.y = 0
    }

    // ---- umpires
    const [u1, u2] = this.umpires
    u1.root.position.set(-0.2, 0, -PITCH_LEN - 2.4)
    u1.root.rotation.y = 0
    u2.root.position.set(-24, 0, -1)
    u2.root.rotation.y = Math.PI / 2
    let signal: Parameters<typeof umpirePose>[0] = 'none'
    if (o && p?.resultFired && !replay) {
      signal = o.boundary === 6 && !o.extra ? 'six' : o.boundary === 4 && !o.extra ? 'four' : o.wicket ? 'out' : o.extra === 'wide' ? 'wide' : o.extra === 'noball' ? 'noball' : o.extra === 'bye' || o.extra === 'legbye' ? 'bye' : 'none'
    }
    u1.animate(signal, umpirePose(signal, this.clock), dt, 0.3)
    u2.animate('none', umpirePose('none', this.clock), dt, 0.3)
    // step aside for the bowler, back in once the ball is on its way
    const aside = p ? 1 - smooth((t - 0.6) / 0.8) : 0
    u1.root.position.x = -0.2 - 0.7 * (p && t < 0 ? 1 : aside)

    // ---- stumps
    for (let k = 0; k < this.stumps.length; k++) {
      const s = this.stumps[k]
      let hitAt: number | null = null
      if (p && tr && o) {
        if (k === 0 && o.wicket === 'bowled') hitAt = tr.tStumps
        if (o.wicket === 'run out' && o.throwPath.length) {
          const endZ = o.throwPath.at(-1)!.z
          if ((k === 0 && endZ > -10) || (k === 1 && endZ <= -10)) hitAt = tr.tContact + pathEnd(o.throwPath)
        }
        if (o.wicket === 'stumped' && k === 0) hitAt = tr.tStumps + 0.3
      }
      breakStumps(s, hitAt !== null && t >= hitAt ? t - hitAt : -1)
    }

    // ---- ball, shadow, trail, markers
    this.ball.visible = ballVisible && !(p && t < 0)
    this.ball.position.copy(ball)
    // seam upright with backspin for the quicks, side-spin for the spinners, topspin off the bat
    if (p && hitT === null && t > 0 && p.d.type === 'spin') this.ball.rotation.z += dt * 28 * (p.d.turn || 1)
    else if (hitT !== null) this.ball.rotation.x -= dt * 30
    else this.ball.rotation.x += dt * 38
    // Grow the ball a little with camera distance so it never shrinks to a speck on big hits.
    const bs = clamp(this.camera.position.distanceTo(ball) / 13, 1.1, 3.2)
    this.ball.scale.setScalar(bs)
    this.ballShadow.visible = this.ball.visible
    this.ballShadow.position.set(ball.x, 0.02, ball.z)
    const sh = 0.6 + ball.y * 0.15
    this.ballShadow.scale.set(sh, sh, sh)
    ;(this.ballShadow.material as THREE.MeshBasicMaterial).opacity = clamp(1 - ball.y * 0.06, 0.15, 0.9)

    const trailOn = this.ball.visible && (hitT !== null || (p && t > 0))
    if (trailOn) {
      this.trailPts.push(ball.clone())
      if (this.trailPts.length > this.trail.length) this.trailPts.shift()
    } else this.trailPts.length = 0
    for (let i = 0; i < this.trail.length; i++) {
      const s = this.trail[i]
      const pt = this.trailPts[this.trailPts.length - 1 - i]
      s.visible = !!pt
      if (pt) {
        s.position.copy(pt)
        const k = 1 - i / this.trail.length
        const sz = (hitT !== null ? 0.9 + bs * 0.25 : 0.5) * k
        s.scale.set(sz, sz, 1)
        ;(s.material as THREE.SpriteMaterial).opacity = 0.55 * k
      }
    }

    // pitch marker: where the ball will land (shown from release until it bounces)
    this.bounceRing.visible = !!(p && tr && t > -0.1 && t < tr.tBounce + 0.25)
    if (tr) this.bounceRing.position.set(tr.bounceX, 0.02, tr.bounceZ)
    ;(this.bounceRing.material as THREE.MeshBasicMaterial).opacity = tr && t > tr.tBounce ? clamp(1 - (t - tr.tBounce) / 0.25, 0, 1) : 0.9
    this.zones.visible = this.showZones
    this.aimRing.visible = !!this.aim && this.showZones
    if (this.aim) {
      this.aimRing.position.set(this.aim.x, 0.025, this.aim.z)
      const s = 1 + Math.sin(this.clock * 6) * 0.08
      this.aimRing.scale.set(s, s, s)
    }
  }

  private animateStriker(p: Play | null, t: number, hitT: number | null, pEnd: number, dt: number) {
    const b = this.striker
    b.root.position.set(BATTER.x, 0, BATTER.z)
    b.root.rotation.y = Math.PI / 2
    const o = p?.outcome ?? null
    const stance: Pose = {
      spine: [0.32, 0, 0],
      chest: [0, 0.15, 0],
      neck: [-0.12, 1.15, 0],
      lHip: [-0.12, 0, 0.16],
      rHip: [0.05, 0, -0.16],
      lKnee: [0.35, 0, 0],
      rKnee: [0.3, 0, 0],
      offset: [0, -0.06, 0],
    }
    // Running between the wickets
    const runs = o && !o.boundary && !o.wicket && o.extra !== 'wide' ? (o.extra === 'noball' ? o.runs - 1 : o.runs) : o?.wicket === 'run out' ? Math.max(1, o.runs) : 0
    if (p && hitT !== null && runs > 0 && hitT > 0.45) {
      const runDur = clamp((pEnd + 1.4) / Math.max(1, runs), 1.3, 2.4)
      this.animateRunner(b, hitT - 0.2, runs, runDur, 1, -0.75, dt)
      return
    }
    if (!p) {
      b.animate('stance', stance, dt, 0.4)
      const k = lerpK(STANCE, STANCE, 0)
      b.holdBat(k.g, k.d, new THREE.Vector3(1, 0, 0))
      return
    }
    const tr = p.tr
    const shot = p.shot
    const type: ShotType = shot ? (o?.shot ?? (shot.swung ? (shot.dir < -0.4 ? 'flick' : shot.dir > 0.4 ? 'cover drive' : 'straight drive') : 'leave')) : 'leave'
    const def = SHOTS[type] ?? SHOTS['straight drive']
    const swung = !!shot?.swung
    // The swing starts at the tap and lands on the ball at the hit time.
    const tap = swung ? tr.tContact - SWING_TIME + shot!.timing / 1000 : tr.tContact
    const connect = swung && !!o?.path.length
    const ti = connect ? this.hitTime(p) : tap + SWING_TIME
    // Backlift as the bowler releases, with a small back-and-across trigger.
    const lift = smooth((t - (tr.tContact - 0.6)) / 0.35)
    let k = lerpK(STANCE, BACKLIFT, lift)
    const front = o ? o.footwork === 'front' : def.front
    // Feet move as the batter reads the length (before the tap), so they never jump on a late tap.
    const stride = smooth((t - (tr.tContact - 0.34)) / 0.24)
    const trigger = smooth((t + 0.25) / 0.25) * (1 - stride)
    let pose: Pose
    if (front) {
      pose = lerpPose(stance, { ...stance, lHip: [-0.25, 0, 0.55], lKnee: [0.6, 0, 0], rHip: [0.15, 0, -0.25], rKnee: [0.25, 0, 0], spine: [0.5, 0, 0], offset: [0.2, -0.12, 0] }, stride)
    } else {
      pose = lerpPose(stance, { ...stance, rHip: [0.1, 0, -0.4], lHip: [-0.1, 0, 0.1], lKnee: [0.15, 0, 0], rKnee: [0.15, 0, 0], spine: [0.15, 0, 0], offset: [-0.14, 0, 0.04] }, stride)
    }
    pose.offset = [(pose.offset?.[0] ?? 0) - 0.05 * trigger, pose.offset?.[1] ?? 0, (pose.offset?.[2] ?? 0) + 0.06 * trigger]

    // Reach: move the impact so the middle of the blade meets the ball where it actually is.
    let impact: K = def.impact
    const shift = new THREE.Vector3()
    if (swung && type !== 'leave') {
      b.root.updateMatrixWorld(true)
      const ballLocal = b.root.worldToLocal(v(tr.pos(Math.min(ti, tr.tStumps))))
      const sweet = v3(def.impact.g).addScaledVector(v3(def.impact.d).normalize(), 0.5)
      shift.copy(ballLocal).sub(sweet)
      shift.set(clamp(shift.x, -0.6, 0.45), clamp(shift.y, -0.55, 0.55), clamp(shift.z, -0.55, 0.55))
      if (!connect) shift.y += 0.14 // beaten: the bat goes over the top of it
      impact = { g: [def.impact.g[0] + shift.x, def.impact.g[1] + shift.y, def.impact.g[2] + shift.z], d: def.impact.d }
    }
    let watch = 0
    if (swung || type === 'leave') {
      if (type === 'leave') {
        k = lerpK(BACKLIFT, def.impact, smooth((t - (tr.tContact - 0.3)) / 0.25))
      } else if (t >= tap && t < ti) {
        // the bat accelerates into the ball
        k = lerpK(BACKLIFT, impact, Math.pow(clamp((t - tap) / Math.max(0.05, ti - tap), 0, 1), 1.4))
      } else if (t >= ti) {
        const fol = (t - ti) / 0.34
        k = lerpK(impact, def.follow, smooth(fol))
        // rotate the follow-through toward where the ball went
        if (hitT !== null && o?.path.length) {
          const end = o.path[Math.min(o.path.length - 1, 4)]
          const ang = Math.atan2(end.x - BATTER.x, -(end.z - BATTER.z)) // 0 = straight, + = off side
          const rot = clamp(ang, -1.6, 1.6) * 0.35
          k.g.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rot)
          k.d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rot).normalize()
        }
        pose = lerpPose(pose, { ...pose, chest: [0, -0.5, 0], spine: [(pose.spine?.[0] ?? 0.3) - 0.1, -0.2, 0] }, smooth(fol) * 0.6)
      }
      // head down, eyes on the ball onto the bat; body shifts toward the ball
      watch = type === 'leave' ? 0 : smooth((t - (ti - 0.18)) / 0.18) * (1 - smooth((t - ti - 0.35) / 0.4))
      const reach = smooth((t - tap) / Math.max(0.05, ti - tap))
      pose.offset = [
        (pose.offset?.[0] ?? 0) + shift.x * 0.35 * reach,
        (pose.offset?.[1] ?? 0) + Math.min(0, shift.y) * 0.4 * reach,
        (pose.offset?.[2] ?? 0) + shift.z * 0.45 * reach,
      ]
    }
    pose.neck = [-0.12 + 0.45 * watch, 1.15 - 0.35 * watch, 0]
    // Out: drop the bat a little and look down
    if (o?.wicket && p.resultFired && hitT === null) pose = lerpPose(pose, { ...IDLE, neck: [0.5, 0, 0] }, 0.7)
    if (o?.wicket && p.resultFired && o.path.length) pose = lerpPose(pose, { ...IDLE, neck: [0.5, 0.6, 0] }, 0.6)
    // A boundary: raise the bat to the crowd
    let face = new THREE.Vector3(1, 0, 0.2)
    if (o?.boundary && !o.wicket && p.resultFired && !p.replay && p.resultAt !== null) {
      const u = smooth((t - p.resultAt) / 0.45)
      pose = lerpPose(pose, { spine: [-0.1, -0.6, 0], chest: [0, -0.4, 0], neck: [-0.35, 0.4, 0], lHip: [-0.1, 0, 0.1], rHip: [0.05, 0, -0.1], lKnee: [0.1, 0, 0], rKnee: [0.1, 0, 0] }, u)
      k = { g: k.g.clone().lerp(new THREE.Vector3(0.05, 2.0, -0.25), u), d: k.d.clone().lerp(new THREE.Vector3(0.1, 1, -0.15), u).normalize() }
      face = face.lerp(new THREE.Vector3(0, 0, -1), u)
    }
    b.animate('bat', pose, dt, 0.25)
    b.holdBat(k.g, k.d, face)
  }


  /**
   * Run `runs` lengths between the creases. dir +1 = striker (starts at the striker's end).
   * Each length speeds up out of the crease, slows into the far one with the bat grounded ahead,
   * and the runner turns round rather than snapping.
   */
  private animateRunner(r: Cricketer, t: number, runs: number, runDur: number, dir: 1 | -1, laneX: number, dt: number) {
    const zA = BATTER.z
    const zB = -PITCH_LEN + 1.0
    const tt = Math.max(0, t)
    const leg = Math.min(runs, Math.floor(tt / runDur))
    const u = leg >= runs ? 1 : (tt % runDur) / runDur
    const fromStriker = (leg % 2 === 0) === (dir === 1)
    const z0 = fromStriker ? zA : zB
    const z1 = fromStriker ? zB : zA
    const done = leg >= runs
    const endFromStriker = (runs % 2 === 0) === (dir === 1)
    const zEnd = endFromStriker ? zA : zB
    const z = done ? zEnd : THREE.MathUtils.lerp(z0, z1, smooth(Math.min(1, u * 1.08)))
    r.root.position.set(laneX, 0, z)
    const s = r.stride(dt, 1.45)
    // facing: toward the far crease, turning back once over the line
    const heading = done ? (endFromStriker ? Math.PI : 0) : z1 < z0 ? Math.PI : 0
    r.faceYaw(heading, dt, done ? 5 : 11)
    const sinceDone = done ? tt - runs * runDur : 0
    if (!done) r.animate('run', runPose(s.phase, Math.max(0.35, s.effort)), dt, 0.18)
    else r.animate('idle', lerpPose(IDLE, { spine: [0.15, 0, 0] }, 1 - smooth(sinceDone / 0.8)), dt, 0.35)
    // carry the bat, then reach it out along the ground into the crease
    const ground = done ? 1 - smooth((sinceDone - 0.25) / 0.4) : smooth((u - 0.74) / 0.18)
    const carryG = new THREE.Vector3(-0.2, 0.9, 0.25)
    const carryD = new THREE.Vector3(0.1, -0.6, 0.8).normalize()
    const reachG = new THREE.Vector3(-0.12, 0.62, 0.55)
    const reachD = new THREE.Vector3(0.05, -0.9, 0.43).normalize()
    r.holdBat(carryG.lerp(reachG, ground), carryD.lerp(reachD, ground).normalize(), new THREE.Vector3(1, 0, 0))
  }

  /** Fielder going for the ball: run, dive or catch, then gather and throw it in. */
  private animateChaser(f: Cricketer, o: BallOutcome, hitT: number, pEnd: number, home: THREE.Vector3, dt: number) {
    const fp = o.fielderPath
    const at = fp.length ? interp(fp, Math.min(hitT, pEnd)) : home.clone()
    if (hitT < 0.32) at.copy(home)
    const target = o.path.at(-1)!
    f.root.position.set(at.x, 0, at.z)
    const s = f.stride(dt, 1.35)
    const caught = o.wicket === 'caught'
    const runHeading = yawTo(target.x - home.x, target.z - home.z)
    if (hitT < 0.32) {
      f.faceYaw(runHeading, dt, 10)
      f.animate('ready', READY, dt, 0.15)
    } else if (hitT < pEnd - 0.25) {
      f.faceYaw(runHeading, dt, 10)
      f.animate('chase', runPose(s.phase, Math.max(0.4, s.effort)), dt, 0.15)
    } else if (caught) {
      const u = smooth((hitT - (pEnd - 0.25)) / 0.25)
      f.faceYaw(runHeading, dt, 10)
      if (o.dive) f.animate('dive', divePose(u), dt, 0.08)
      else {
        const hands = target.y > 1.35 ? CATCH_HIGH : CATCH_CHEST
        if (hitT < pEnd + 0.08) f.animate('catch', lerpPose(READY, hands, u), dt, 0.1)
        // ...and pull it in to the chest
        else f.animate('caught', lerpPose(hands, { ...CATCH_CHEST, spine: [0.4, 0, 0] }, smooth((hitT - pEnd - 0.08) / 0.3)), dt, 0.1)
      }
    } else if (o.boundary) {
      // didn't get there: pull up at the rope
      f.faceYaw(runHeading, dt, 6)
      f.animate('pullup', READY, dt, 0.4)
    } else {
      // gather, then a crow hop and an overarm throw at the stumps
      const throwStart = o.throwPath.length ? o.throwPath[0].t : pEnd + 0.5
      const THROW = 0.55
      const throwFrom = throwStart - THROW * 0.65 // release about two-thirds through the action
      if (o.dive && hitT < pEnd + 0.45) {
        f.faceYaw(runHeading, dt, 10)
        f.animate('dive', divePose(smooth((hitT - (pEnd - 0.25)) / 0.25)), dt, 0.08)
      } else if (o.dive && hitT < throwFrom) {
        f.animate('getup', getUpPose((hitT - pEnd - 0.45) / Math.max(0.1, throwFrom - pEnd - 0.45)), dt, 0.1)
      } else if (hitT < throwFrom) {
        f.faceYaw(runHeading, dt, 10)
        f.animate('pickup', PICKUP, dt, 0.14)
      } else {
        const endP = o.throwPath.at(-1)
        if (endP) f.faceYaw(yawTo(endP.x - at.x, endP.z - at.z) + 0.5 * (1 - smooth((hitT - throwFrom) / (THROW * 0.5))), dt, 14)
        f.animate('throw', throwPose(clamp((hitT - throwFrom) / THROW, 0, 1)), dt, 0.08)
      }
    }
  }

  // ----------------------------------------------------------------------------- camera director

  private updateCamera(p: Play | null, t: number, dt: number, replay: boolean, w: number, h: number) {
    const o = p?.outcome ?? null
    const tr = p?.tr
    const th = p && o ? this.hitTime(p) : 0
    const hitT = p && o && o.path.length && t >= th ? t - th : null
    const ball = this.ball.position
    let pos = BAT_CAM.pos.clone()
    let target = BAT_CAM.target.clone()
    let zoom = BAT_CAM.zoom
    let rate = 0.55 // smoothing time (s): lower = snappier

    if (!p && this.showZones) {
      pos = AIM_CAM.pos.clone()
      target = AIM_CAM.target.clone()
      zoom = AIM_CAM.zoom
    } else if (replay && p) {
      // Side-on replay camera, tracking the ball at half speed.
      if (hitT !== null) {
        const look = ball.clone().lerp(new THREE.Vector3(BATTER.x, 1, BATTER.z), clamp(1 - hitT, 0, 1) * 0.6)
        pos = new THREE.Vector3(look.x - 13, 3 + ball.y * 0.4, look.z + 6)
        target = look
        zoom = 1.9
      } else {
        pos = new THREE.Vector3(-7, 1.4, 1.6)
        target = new THREE.Vector3(0, 0.6, -1.2)
        zoom = 2.2
      }
      rate = 0.12
    } else if (hitT !== null && o && !o.edged) {
      // Follow cam: stays at the batting end, rises and pulls back, and pans to keep the ball in frame.
      // It never orbits round the ground, so big hits stay easy to read.
      const g = new THREE.Vector3(ball.x, 0, ball.z)
      const d = Math.hypot(g.x - BATTER.x, g.z - BATTER.z)
      const behind = clamp((g.z - 2) / 20, 0, 1) // ball going fine, behind the batter
      pos = new THREE.Vector3(g.x * 0.22, 4.5 + Math.min(24, d * 0.36) + behind * 10, 9 + Math.min(18, d * 0.26) + Math.max(0, g.z) * 0.9)
      target = new THREE.Vector3(g.x, Math.min(ball.y, 18) * 0.45, g.z)
      zoom = 1.45 + Math.min(0.75, d * 0.011)
      rate = 0.42 // smoothing time in seconds for the follow cam
    } else if (p && tr && o && (o.wicket === 'bowled' || o.wicket === 'lbw' || o.wicket === 'stumped') && t > tr.tStumps) {
      // leg side, so slips and gully never block the shot
      pos = new THREE.Vector3(-2.7, 1.0, 1.9)
      target = new THREE.Vector3(0.05, 0.42, -0.1)
      zoom = 2.1
      rate = 0.2
    } else if (hitT !== null && o?.edged) {
      pos = new THREE.Vector3(5, 4, 9)
      target = new THREE.Vector3(ball.x * 0.5, 0.8, ball.z * 0.5)
      zoom = 1.5
    }

    const snap = replay !== this.wasReplay
    this.wasReplay = replay
    if (snap) {
      // hard cut into and out of replays, like TV
      this.camPos.copy(replay ? pos : BAT_CAM.pos)
      this.camTarget.copy(replay ? target : BAT_CAM.target)
      this.camZoom = replay ? zoom : BAT_CAM.zoom
      this.camPosVel.set(0, 0, 0)
      this.camTargetVel.set(0, 0, 0)
      this.camZoomVel = 0
    }
    // Critically damped springs: no sudden starts or stops, the camera eases in and out.
    smoothDampV(this.camPos, pos, this.camPosVel, rate, dt)
    smoothDampV(this.camTarget, target, this.camTargetVel, rate * 0.8, dt)
    const zr = smoothDamp(this.camZoom, zoom, this.camZoomVel, rate, dt)
    this.camZoom = zr[0]
    this.camZoomVel = zr[1]
    if (this.kick > 0) {
      this.camZoomVel += this.kick
      this.kick = 0
    }
    const cp = this.camPos.clone()
    if (this.shake > 0) {
      this.shake -= dt
      const s = this.shake * 0.12
      cp.x += (Math.random() - 0.5) * s
      cp.y += (Math.random() - 0.5) * s
    }
    // Match the 2D camera's framing: focal length tied to min(width, 0.72·height).
    const f = Math.min(w, h * 0.72) * this.camZoom
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(h / 2 / f))
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.camera.position.copy(cp)
    this.camera.lookAt(this.camTarget)
    // keep the shadow frustum centred on the action
    const c = this.camTarget
    this.key.target.position.set(c.x, 0, c.z)
    this.key.position.set(c.x + 30, 70, c.z + 25)
  }
  private wasReplay = false

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.life += dt
      const pos = p.pts.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as Float32Array
      for (let i = 0; i < arr.length; i += 3) {
        p.vel[i + 1] -= 9.8 * dt * 0.6
        arr[i] += p.vel[i] * dt
        arr[i + 1] += p.vel[i + 1] * dt
        arr[i + 2] += p.vel[i + 2] * dt
      }
      pos.needsUpdate = true
      ;(p.pts.material as THREE.PointsMaterial).opacity = clamp(1 - p.life / p.max, 0, 1)
    }
    const dead = this.particles.filter((p) => p.life >= p.max)
    for (const d of dead) {
      d.pts.removeFromParent()
      d.pts.geometry.dispose()
    }
    this.particles = this.particles.filter((p) => p.life < p.max)
  }
}

// ----------------------------------------------------------------------------- props

const v = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z)

function ring(r0: number, r1: number, color: number) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }))
  m.rotation.x = -Math.PI / 2
  m.visible = false
  m.renderOrder = 2
  return m
}

/** Coloured length bands on the pitch shown while aiming a delivery. */
function buildZones() {
  const g = new THREE.Group()
  const bands: [number, number, number, string][] = [
    [0, 0.12, 0xffd23f, 'Yorker'],
    [0.12, 0.38, 0x2bd17e, 'Full'],
    [0.38, 0.65, 0x1aa7ff, 'Good'],
    [0.65, 1.0, 0xff5a5a, 'Short'],
  ].map(([a, b, c, n]) => [a as number, b as number, c as number, n as string])
  const z = (len: number) => CREASE_Z - (0.35 + len * 8.6)
  for (const [a, b, c] of bands) {
    const z0 = z(a)
    const z1 = z(b)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, Math.abs(z1 - z0)), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, depthWrite: false }))
    m.rotation.x = -Math.PI / 2
    m.position.set(0, 0.015, (z0 + z1) / 2)
    m.renderOrder = 1
    g.add(m)
  }
  g.visible = false
  return g
}

function buildStumps(z: number, shadows: boolean) {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: 0xf2e6c9, roughness: 0.5 })
  const parts: THREE.Mesh[] = []
  for (const x of [-0.115, 0, 0.115]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, STUMP_H, 8), wood)
    s.position.set(x, STUMP_H / 2, z)
    s.castShadow = shadows
    group.add(s)
    parts.push(s)
  }
  for (const x of [-0.0575, 0.0575]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 6), wood)
    b.rotation.z = Math.PI / 2
    b.position.set(x, STUMP_H + 0.01, z)
    group.add(b)
    parts.push(b)
  }
  // remember rest transforms
  for (const p of parts) p.userData.rest = { pos: p.position.clone(), rot: p.rotation.clone() }
  return { group, parts, z }
}

function breakStumps(s: { parts: THREE.Mesh[] }, u: number) {
  for (let i = 0; i < s.parts.length; i++) {
    const p = s.parts[i]
    const rest = p.userData.rest as { pos: THREE.Vector3; rot: THREE.Euler }
    if (u < 0) {
      p.position.copy(rest.pos)
      p.rotation.copy(rest.rot)
      continue
    }
    const k = Math.min(u, 1.2)
    if (i < 3) {
      // stumps cartwheel back
      const lean = Math.min(1.25, k * (2.5 + i * 0.6))
      p.rotation.set(-lean, 0, (i - 1) * 0.25 * k)
      p.position.set(rest.pos.x + (i - 1) * 0.12 * k, rest.pos.y - Math.sin(lean) * 0.2, rest.pos.z + Math.sin(lean) * 0.3)
    } else {
      // bails fly
      const vx = i === 3 ? -1.4 : 1.6
      p.position.set(rest.pos.x + vx * k, Math.max(0.01, rest.pos.y + 3.2 * k - 4.9 * k * k), rest.pos.z + 1.4 * k)
      p.rotation.set(k * 14, k * 9, rest.rot.z)
    }
  }
}

function skyTexture() {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#02040d')
  grd.addColorStop(0.5, '#0b1838')
  grd.addColorStop(1, '#1d3566')
  g.fillStyle = grd
  g.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
