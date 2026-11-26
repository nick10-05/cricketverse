import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Procedural, articulated cricketer. No external model files: every part is built from
 * primitives so the game ships with zero third-party art. Joints are plain Object3D pivots
 * whose limbs hang along local -Y, so a pose is just a set of Euler angles per joint.
 *
 * Local frame of the root: +Z = facing direction, +Y = up, +X = the player's left.
 */

export type Role = 'batter' | 'bowler' | 'fielder' | 'keeper' | 'umpire'

export interface Kit {
  shirt: string
  trim: string
  trousers: string
  skin: string
  hat: 'helmet' | 'cap' | 'hat' | 'none'
  pads: boolean
  gloves: boolean
}

export type JointName =
  | 'hips' | 'spine' | 'chest' | 'neck'
  | 'lShoulder' | 'lElbow' | 'rShoulder' | 'rElbow'
  | 'lHip' | 'lKnee' | 'rHip' | 'rKnee'

export type Pose = Partial<Record<JointName, [number, number, number]>> & {
  /** Root offset (local, metres) and hip height drop. */
  offset?: [number, number, number]
  /** Extra root rotation (yaw, pitch, roll). */
  lean?: [number, number, number]
}

const SEG = { upperArm: 0.29, foreArm: 0.27, thigh: 0.44, shin: 0.44, hipH: 0.94 }

// ----------------------------------------------------------------------------- toon look

/** Three-step light ramp: flat, cartoon-style shading. */
let rampTex: THREE.DataTexture | null = null
function ramp() {
  if (!rampTex) {
    const d = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 235, 235, 235, 255])
    rampTex = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat)
    rampTex.minFilter = THREE.NearestFilter
    rampTex.magFilter = THREE.NearestFilter
    rampTex.generateMipmaps = false
    rampTex.needsUpdate = true
  }
  return rampTex
}

const matCache = new Map<string, THREE.Material>()
function mat(color: string, shiny = false) {
  const k = `${color}|${shiny}`
  let m = matCache.get(k)
  if (!m) {
    const t = new THREE.MeshToonMaterial({ color, gradientMap: ramp() })
    if (shiny) t.emissive = new THREE.Color(color).multiplyScalar(0.25)
    m = t
    matCache.set(k, m)
  }
  return m
}
/** Unlit colour (eyes, mouth): stays crisp in any light. */
function flat(color: string) {
  const k = `flat|${color}`
  let m = matCache.get(k)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color })
    matCache.set(k, m)
  }
  return m
}

/** Inverted-hull outline: the back faces pushed out along their normals, drawn dark. */
let outlineMat: THREE.MeshBasicMaterial | null = null
function outline() {
  if (!outlineMat) {
    outlineMat = new THREE.MeshBasicMaterial({ color: 0x14161f, side: THREE.BackSide })
    outlineMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normal * 0.014;')
    }
  }
  return outlineMat
}

const geoCache = new Map<string, THREE.BufferGeometry>()
function cached(k: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(k)
  if (!g) {
    g = make()
    geoCache.set(k, g)
  }
  return g
}
/** Capsule hanging from its top (joint) down local -Y. */
function capsule(r: number, len: number) {
  return cached(`cap|${r}|${len}`, () => {
    const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 5, 12)
    g.translate(0, -len / 2, 0)
    return g
  })
}
/**
 * Tapered limb hanging from its joint: a rounded end centred on this joint (radius r0) and one
 * centred on the next joint down (radius r1), so neighbouring limbs blend with no pinch.
 */
function limb(r0: number, r1: number, len: number) {
  return cached(`limb|${r0}|${r1}|${len}`, () => {
    const pts: THREE.Vector2[] = []
    const n = 6
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.sin(a) * r1, -len - Math.cos(a) * r1))
    }
    for (let i = n; i >= 0; i--) {
      const a = (i / n) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.sin(a) * r0, Math.cos(a) * r0))
    }
    const g = new THREE.LatheGeometry(pts, 14)
    g.computeVertexNormals()
    return g
  })
}
function rbox(w: number, h: number, d: number, r: number) {
  return cached(`rbox|${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r))
}
function box(w: number, h: number, d: number) {
  return cached(`box|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d))
}
function sphere(r: number, ws = 16, hs = 12) {
  return cached(`sph|${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs))
}

const smoothU = (u: number) => {
  const x = Math.max(0, Math.min(1, u))
  return x * x * (3 - 2 * x)
}

let vcToon: THREE.MeshToonMaterial | null = null
let vcFlat: THREE.MeshBasicMaterial | null = null

/** A part's geometry baked into its parent's space, with its colour as vertex colour. */
function bakeGeometry(m: THREE.Mesh) {
  m.updateMatrix()
  const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k)
  g.applyMatrix4(m.matrix)
  const c = (m.material as THREE.MeshBasicMaterial).color ?? new THREE.Color(1, 1, 1)
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function mergeInto(node: THREE.Object3D, parts: THREE.Mesh[], outlined: boolean, shadows: boolean) {
  const toon: THREE.BufferGeometry[] = []
  const flatG: THREE.BufferGeometry[] = []
  const line: THREE.BufferGeometry[] = []
  let cast = false
  for (const m of parts) {
    const g = bakeGeometry(m)
    if (m.material instanceof THREE.MeshBasicMaterial) flatG.push(g)
    else toon.push(g)
    if (m.userData.line) line.push(g)
    cast = cast || m.castShadow
    node.remove(m)
  }
  vcToon ??= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp() })
  vcFlat ??= new THREE.MeshBasicMaterial({ vertexColors: true })
  const add = (gs: THREE.BufferGeometry[], material: THREE.Material, castShadow: boolean) => {
    if (!gs.length) return
    const merged = mergeGeometries(gs, false)
    if (!merged) return
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = castShadow
    mesh.userData.own = true
    node.add(mesh)
  }
  add(toon, vcToon, shadows && cast)
  add(flatG, vcFlat, false)
  if (outlined) add(line, outline(), false)
  for (const g of [...toon, ...flatG]) g.dispose()
}

const tmpV = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const DOWN = new THREE.Vector3(0, -1, 0)

const HEAD_R = 0.195
const HAIR = ['#1b120c', '#2b1a10', '#4a2d16', '#0e0e12', '#6b4a2a']

export class Cricketer {
  root = new THREE.Group()
  joints = {} as Record<JointName, THREE.Object3D>
  hands: { l: THREE.Object3D; r: THREE.Object3D }
  bat: THREE.Group | null = null
  /** Hidden ball held in the hand (bowler / fielder after collecting). */
  heldBall: THREE.Mesh | null = null
  role: Role
  private body = new THREE.Group()
  private shadows: boolean
  private outlined: boolean

  constructor(role: Role, kit: Kit, shadows: boolean, opts: { bat?: boolean; outline?: boolean } = {}) {
    this.role = role
    this.shadows = shadows
    this.outlined = !!opts.outline
    this.root.add(this.body)
    const shirt = mat(kit.shirt)
    const trim = mat(kit.trim)
    const trousers = mat(kit.trousers)
    const skin = mat(kit.skin)
    const white = mat('#e6e6e0')
    const shoe = mat('#24262f')
    const sole = mat('#f0f0f0')

    const J = (name: JointName, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const o = new THREE.Object3D()
      o.position.set(x, y, z)
      parent.add(o)
      this.joints[name] = o
      return o
    }
    const M = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, line = true, cast = true) => this.part(g, m, parent, line, cast)

    // ---- pelvis / torso: chunky and rounded
    const hips = J('hips', this.body, 0, SEG.hipH, 0)
    M(rbox(0.4, 0.24, 0.28, 0.1), trousers, hips).position.y = -0.03
    const spine = J('spine', hips, 0, 0.06, 0)
    const belly = M(capsule(0.19, 0.36), shirt, spine)
    belly.rotation.x = Math.PI
    belly.scale.set(1.05, 1, 0.82)
    const chest = J('chest', spine, 0, 0.26, 0)
    M(rbox(0.52, 0.4, 0.3, 0.13), shirt, chest).position.y = 0.07
    // bold kit trim: collar, chest band and a number panel on the back
    const collar = M(new THREE.TorusGeometry(0.1, 0.03, 6, 16), trim, chest, false, false)
    collar.rotation.x = Math.PI / 2
    collar.position.y = 0.27
    M(rbox(0.535, 0.07, 0.315, 0.03), trim, chest, false, false)
    const panel = M(box(0.2, 0.17, 0.01), trim, chest, false, false)
    panel.position.set(0, 0.12, -0.152)

    const neck = J('neck', chest, 0, 0.27, 0)
    M(capsule(0.075, 0.1), skin, neck, false).rotation.x = Math.PI
    this.buildHead(neck, kit, skin)

    // ---- arms: thick, tapered, mitten hands
    const arm = (side: 'l' | 'r') => {
      const s = side === 'l' ? 1 : -1
      const sh = J(side === 'l' ? 'lShoulder' : 'rShoulder', chest, 0.27 * s, 0.17, 0)
      M(sphere(0.088, 12, 10), shirt, sh)
      M(limb(0.094, 0.086, 0.12), shirt, sh) // short sleeve
      M(limb(0.078, 0.066, SEG.upperArm), skin, sh)
      const el = J(side === 'l' ? 'lElbow' : 'rElbow', sh, 0, -SEG.upperArm, 0)
      M(limb(0.066, 0.056, SEG.foreArm - 0.06), kit.gloves ? white : skin, el)
      const hand = new THREE.Object3D()
      hand.position.y = -SEG.foreArm
      el.add(hand)
      const glove = kit.gloves ? (role === 'keeper' ? mat('#efe7c6') : white) : skin
      const palm = M(sphere(kit.gloves ? 0.085 : 0.07, 12, 10), glove, hand)
      palm.position.y = -0.035
      palm.scale.set(1, 1.1, 0.85)
      if (kit.gloves) {
        const cuff = M(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), trim, hand, false, false)
        cuff.position.y = 0.025
      }
      return hand
    }
    this.hands = { l: arm('l'), r: arm('r') }

    // ---- legs: sturdy, big shoes
    const leg = (side: 'l' | 'r') => {
      const s = side === 'l' ? 1 : -1
      const hp = J(side === 'l' ? 'lHip' : 'rHip', hips, 0.115 * s, -0.06, 0)
      M(limb(0.125, 0.1, SEG.thigh), trousers, hp)
      const kn = J(side === 'l' ? 'lKnee' : 'rKnee', hp, 0, -SEG.thigh, 0)
      M(limb(0.1, 0.078, SEG.shin - 0.06), trousers, kn)
      if (kit.pads) {
        const pad = M(rbox(0.21, 0.54, 0.15, 0.06), white, kn)
        pad.position.set(0, -0.2, 0.06)
        const knee = M(rbox(0.22, 0.14, 0.14, 0.06), white, kn, false)
        knee.position.set(0, 0.06, 0.08)
        for (const dx of [-0.055, 0, 0.055]) {
          const rib = M(box(0.014, 0.44, 0.014), mat('#cfd3da'), kn, false, false)
          rib.position.set(dx, -0.2, 0.137)
        }
        const strap = M(box(0.215, 0.03, 0.155), trim, kn, false, false)
        strap.position.set(0, -0.06, 0.062)
      }
      const foot = M(rbox(0.15, 0.1, 0.3, 0.045), shoe, kn)
      foot.position.set(0, -SEG.shin - 0.03, 0.06)
      const soleM = M(rbox(0.155, 0.03, 0.305, 0.012), sole, kn, false, false)
      soleM.position.set(0, -SEG.shin - 0.075, 0.06)
    }
    leg('l')
    leg('r')

    if (opts.bat) {
      this.bat = buildBat(shadows, this.outlined)
      this.root.add(this.bat)
    }
    const ball = new THREE.Mesh(sphere(0.036, 10, 8), mat('#c3161e'))
    ball.visible = false
    ball.position.y = -0.06
    this.hands.r.add(ball)
    this.heldBall = ball
    this.bake()
  }

  /**
   * Merge every joint's parts into one vertex-coloured toon mesh (plus one unlit mesh for the
   * face and one outline shell). ~45 parts per player become ~2 per joint: far fewer draw calls.
   */
  private bake() {
    const groups = new Map<THREE.Object3D, THREE.Mesh[]>()
    this.body.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || m === this.heldBall || m.userData.own) return
      const list = groups.get(m.parent!) ?? []
      list.push(m)
      groups.set(m.parent!, list)
    })
    for (const [node, parts] of groups) mergeInto(node, parts, this.outlined, this.shadows)
  }

  // ----------------------------------------------------------------------------- animation layer

  private stateKey = ''
  private fadeFrom: Pose | null = null
  private fadeT = 0
  private fadeDur = 0.2
  private yaw = 0
  private snapYaw = true
  private phase = 0
  private lastX = NaN
  private lastZ = 0
  /** Smoothed ground speed in m/s, measured from how far the root actually moved. */
  speed = 0
  /** Free per-actor state for the scene (celebration start points and so on). */
  memo: Record<string, number> = {}

  /**
   * Play a pose for an animation state. Switching state cross-fades from wherever the body
   * is right now, so moves blend instead of snapping; within a state the pose is exact.
   */
  animate(key: string, pose: Pose, dt: number, fade = 0.2) {
    if (key !== this.stateKey) {
      this.fadeFrom = this.stateKey ? this.snapshot() : null
      this.stateKey = key
      this.fadeT = 0
      this.fadeDur = fade
    }
    this.fadeT += dt
    if (this.fadeFrom && this.fadeT < this.fadeDur) this.setPose(lerpPose(this.fadeFrom, pose, smoothU(this.fadeT / this.fadeDur)))
    else this.setPose(pose)
  }

  get state() {
    return this.stateKey
  }

  /** Hard cut (camera cut into or out of a replay): next pose and heading apply instantly. */
  cut() {
    this.stateKey = ''
    this.fadeFrom = null
    this.snapYaw = true
    this.lastX = NaN
  }

  private snapshot(): Pose {
    const p: Pose = {}
    for (const n of Object.keys(this.joints) as JointName[]) {
      const r = this.joints[n].rotation
      p[n] = [r.x, r.y, r.z]
    }
    p.offset = [this.body.position.x, this.body.position.y, this.body.position.z]
    p.lean = [this.body.rotation.y, this.body.rotation.x, this.body.rotation.z]
    return p
  }

  /** Turn smoothly toward a heading (radians) instead of snapping. */
  faceYaw(target: number, dt: number, rate = 9) {
    if (this.snapYaw) {
      this.setYaw(target)
      this.snapYaw = false
      return
    }
    const d = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw))
    this.yaw += d * (1 - Math.exp(-rate * dt))
    this.root.rotation.y = this.yaw
  }

  setYaw(y: number) {
    this.yaw = y
    this.root.rotation.y = y
  }

  /**
   * Advance the run cycle by the distance the root really moved, so feet plant instead of
   * sliding. Returns the cycle phase (one step = PI) and a 0..1 effort for runPose.
   */
  stride(dt: number, stepLen = 1.3): { phase: number; effort: number } {
    const x = this.root.position.x
    const z = this.root.position.z
    let d = 0
    if (!Number.isNaN(this.lastX)) d = Math.min(0.5, Math.hypot(x - this.lastX, z - this.lastZ))
    this.lastX = x
    this.lastZ = z
    const v = dt > 0 ? d / dt : 0
    this.speed += (v - this.speed) * (1 - Math.exp(-10 * dt))
    const effort = Math.min(1, Math.max(0.12, this.speed / 8))
    this.phase += (d / (stepLen * (0.55 + 0.45 * effort))) * Math.PI
    return { phase: this.phase, effort }
  }

  /** Add a mesh (and its outline shell) to a joint. */
  private part(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, line = true, cast = true) {
    const x = new THREE.Mesh(g, m)
    x.castShadow = this.shadows && cast
    x.userData.line = line
    parent.add(x)
    return x
  }

  /** Big friendly head: face, hair, then headwear. */
  private buildHead(neck: THREE.Object3D, kit: Kit, skin: THREE.Material) {
    const head = new THREE.Group()
    head.position.y = 0.215
    neck.add(head)
    const skull = this.part(sphere(HEAD_R, 20, 16), skin, head)
    skull.scale.set(0.96, 1.0, 0.94)
    // ears
    for (const s of [1, -1]) {
      const ear = this.part(sphere(0.038, 8, 6), skin, head, false, false)
      ear.position.set(HEAD_R * 0.93 * s, -0.01, -0.01)
      ear.scale.set(0.6, 1, 0.8)
    }
    // eyes: white, dark pupil, tiny highlight, brows
    for (const s of [1, -1]) {
      const eye = new THREE.Mesh(sphere(0.034, 12, 10), flat('#ffffff'))
      eye.position.set(0.058 * s, 0.015, HEAD_R * 0.84)
      eye.scale.set(0.85, 1.1, 0.5)
      head.add(eye)
      const pupil = new THREE.Mesh(sphere(0.021, 10, 8), flat('#15171f'))
      pupil.position.set(0.058 * s, 0.01, HEAD_R * 0.84 + 0.016)
      pupil.scale.set(0.9, 1.15, 0.5)
      head.add(pupil)
      const glint = new THREE.Mesh(sphere(0.006, 6, 4), flat('#ffffff'))
      glint.position.set(0.058 * s + 0.006, 0.02, HEAD_R * 0.84 + 0.026)
      head.add(glint)
      const brow = new THREE.Mesh(box(0.05, 0.012, 0.01), flat('#2a1c12'))
      brow.position.set(0.058 * s, 0.065, HEAD_R * 0.87)
      brow.rotation.z = -0.12 * s
      head.add(brow)
    }
    const nose = this.part(sphere(0.024, 8, 6), skin, head, false, false)
    nose.position.set(0, -0.025, HEAD_R * 0.93)
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 10, Math.PI), flat('#5a2a22'))
    mouth.position.set(0, -0.062, HEAD_R * 0.86)
    mouth.rotation.z = Math.PI
    head.add(mouth)
    // hair (under a cap or helmet it just peeks out at the back and sides)
    const hairCol = HAIR[Math.floor(Math.random() * HAIR.length)]
    const hair = this.part(new THREE.SphereGeometry(HEAD_R * 1.04, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hairCol), head, false, false)
    hair.position.set(0, 0.012, -0.02)
    hair.rotation.x = -0.35
    this.addHeadwear(head, kit)
  }

  private addHeadwear(head: THREE.Object3D, kit: Kit) {
    const R = HEAD_R
    if (kit.hat === 'helmet') {
      const navy = mat('#13254d')
      const shell = this.part(new THREE.SphereGeometry(R * 1.13, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), navy, head)
      shell.position.set(0, 0.012, -0.01)
      const peak = this.part(rbox(R * 1.6, 0.025, 0.12, 0.012), navy, head, false, false)
      peak.position.set(0, 0.07, R * 1.02)
      peak.rotation.x = 0.12
      const badge = this.part(sphere(0.022, 8, 6), mat(kit.trim), head, false, false)
      badge.position.set(0, 0.11, R * 1.04)
      // chunky face guard
      const steel = mat('#c9ccd4', true)
      for (let i = 0; i < 2; i++) {
        const bar = this.part(new THREE.TorusGeometry(R * 1.02, 0.011, 6, 18, Math.PI), steel, head, false, false)
        bar.rotation.set(-0.12, 0, Math.PI)
        bar.position.set(0, -i * 0.055, 0.01)
        bar.scale.set(1, 0.55, 1.08)
      }
    } else if (kit.hat === 'cap') {
      const cap = this.part(new THREE.SphereGeometry(R * 1.07, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(kit.trim), head)
      cap.position.y = 0.02
      const brim = this.part(rbox(R * 1.3, 0.022, 0.16, 0.01), mat(kit.trim), head, false, false)
      brim.position.set(0, 0.03, R * 1.05)
      brim.rotation.x = 0.15
      const button = this.part(sphere(0.02, 8, 6), mat(kit.shirt), head, false, false)
      button.position.y = R * 1.07 + 0.02
    } else if (kit.hat === 'hat') {
      const cream = mat('#f1ede0')
      const crown = this.part(new THREE.CylinderGeometry(R * 0.95, R * 1.05, 0.14, 18), cream, head)
      crown.position.y = R * 0.75
      const brim = this.part(new THREE.CylinderGeometry(R * 1.9, R * 1.9, 0.018, 22), cream, head, false)
      brim.position.y = R * 0.42
      const ribbon = this.part(new THREE.CylinderGeometry(R * 1.055, R * 1.06, 0.035, 18), mat('#1b1f2e'), head, false, false)
      ribbon.position.y = R * 0.52
    }
  }

  /** Apply a pose. Missing joints reset to neutral. */
  setPose(p: Pose) {
    const names = Object.keys(this.joints) as JointName[]
    for (const n of names) {
      const a = p[n]
      const j = this.joints[n]
      if (a) j.rotation.set(a[0], a[1], a[2])
      else j.rotation.set(0, 0, 0)
    }
    const o = p.offset ?? [0, 0, 0]
    this.body.position.set(o[0], o[1], o[2])
    const l = p.lean ?? [0, 0, 0]
    this.body.rotation.set(l[1], l[0], l[2])
  }

  /** Two-bone IK: put a hand at a point given in the root's local space. */
  reach(side: 'l' | 'r', targetLocal: THREE.Vector3, poleLocal: THREE.Vector3) {
    this.root.updateMatrixWorld(true)
    const sh = this.joints[side === 'l' ? 'lShoulder' : 'rShoulder']
    const el = this.joints[side === 'l' ? 'lElbow' : 'rElbow']
    const T = this.root.localToWorld(targetLocal.clone())
    const P = this.root.localToWorld(poleLocal.clone())
    const S = sh.getWorldPosition(new THREE.Vector3())
    const a = SEG.upperArm
    const b = SEG.foreArm + 0.03
    const toT = T.clone().sub(S)
    const d = Math.min(Math.max(toT.length(), 0.05), (a + b) * 0.999)
    const dir = toT.normalize()
    const cosA = (a * a + d * d - b * b) / (2 * a * d)
    const angA = Math.acos(Math.max(-1, Math.min(1, cosA)))
    const toP = P.sub(S)
    const axis = new THREE.Vector3().crossVectors(dir, toP).normalize()
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
    const upperDir = dir.clone().applyAxisAngle(axis, angA)
    const E = S.clone().addScaledVector(upperDir, a)
    const foreDir = T.clone().sub(E).normalize()
    // Shoulder: world orientation that points local -Y along upperDir.
    const parentQ = sh.parent!.getWorldQuaternion(new THREE.Quaternion())
    const qWorld = new THREE.Quaternion().setFromUnitVectors(DOWN, upperDir)
    sh.quaternion.copy(parentQ.invert().multiply(qWorld))
    sh.updateMatrixWorld(true)
    const shQ = sh.getWorldQuaternion(tmpQ)
    const qE = new THREE.Quaternion().setFromUnitVectors(DOWN, foreDir)
    el.quaternion.copy(shQ.clone().invert().multiply(qE))
  }

  /** Place the bat: handle grip point and blade direction (toward the toe), both in root space. */
  holdBat(grip: THREE.Vector3, dir: THREE.Vector3, face: THREE.Vector3) {
    if (!this.bat) return
    const d = dir.clone().normalize()
    // Bat local: handle along +Y from the shoulder of the blade; toe at -Y. Face toward +Z.
    const m = new THREE.Matrix4()
    const yAxis = d.clone().negate()
    const zAxis = face.clone().sub(yAxis.clone().multiplyScalar(face.dot(yAxis))).normalize()
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
    m.makeBasis(xAxis, yAxis, zAxis)
    this.bat.quaternion.setFromRotationMatrix(m)
    // grip point is 0.42 up the handle from the blade's shoulder origin
    this.bat.position.copy(grip).sub(yAxis.clone().multiplyScalar(0.2))
    const top = grip.clone().addScaledVector(yAxis, 0.06)
    const low = grip.clone().addScaledVector(yAxis, -0.06)
    const pole = new THREE.Vector3(0.6, 0.6, -0.6)
    this.reach('l', top, top.clone().add(pole))
    this.reach('r', low, low.clone().add(new THREE.Vector3(0.6, 0.0, -0.8)))
  }

  /** World position of the right hand (for releasing / throwing the ball). */
  handWorld(side: 'l' | 'r' = 'r') {
    return this.hands[side].getWorldPosition(tmpV).clone()
  }

  dispose() {
    this.root.removeFromParent()
    this.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.userData.own) m.geometry.dispose()
    })
  }
}

function buildBat(shadows: boolean, outlined = false) {
  const g = new THREE.Group()
  const willow = mat('#ecc98a')
  const blade = new THREE.Mesh(rbox(0.12, 0.58, 0.055, 0.02), willow)
  blade.castShadow = shadows
  blade.position.y = -0.29
  g.add(blade)
  const spine = new THREE.Mesh(rbox(0.06, 0.5, 0.035, 0.015), willow)
  spine.position.set(0, -0.27, -0.035)
  g.add(spine)
  const sticker = new THREE.Mesh(box(0.1, 0.14, 0.003), mat('#1aa7ff'))
  sticker.position.set(0, -0.13, 0.029)
  g.add(sticker)
  const sticker2 = new THREE.Mesh(box(0.1, 0.05, 0.003), mat('#ffd23f'))
  sticker2.position.set(0, -0.45, 0.029)
  g.add(sticker2)
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.021, 0.3, 10), mat('#d4262c'))
  handle.position.y = 0.15
  g.add(handle)
  mergeInto(g, g.children.slice() as THREE.Mesh[], outlined, shadows)
  return g
}

// ----------------------------------------------------------------------------- poses

export const lerpPose = (a: Pose, b: Pose, u: number): Pose => {
  const out: Pose = {}
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Pose>
  for (const k of keys) {
    const va = (a[k] as number[] | undefined) ?? [0, 0, 0]
    const vb = (b[k] as number[] | undefined) ?? [0, 0, 0]
    ;(out as Record<string, number[]>)[k] = [va[0] + (vb[0] - va[0]) * u, va[1] + (vb[1] - va[1]) * u, va[2] + (vb[2] - va[2]) * u]
  }
  return out
}

/** Running cycle. phase in radians; speed 0..1 scales stride. */
export function runPose(phase: number, speed = 1): Pose {
  const s = Math.sin(phase)
  const c = Math.cos(phase)
  const k = 0.25 + 0.75 * speed
  return {
    lHip: [-0.9 * s * k, 0, 0],
    rHip: [0.9 * s * k, 0, 0],
    lKnee: [Math.max(0, 1.3 * -c) * k + 0.15, 0, 0],
    rKnee: [Math.max(0, 1.3 * c) * k + 0.15, 0, 0],
    lShoulder: [0.8 * s * k, 0, 0.12],
    rShoulder: [-0.8 * s * k, 0, -0.12],
    lElbow: [-1.3, 0, 0],
    rElbow: [-1.3, 0, 0],
    spine: [0.18 * k, 0, 0],
    offset: [0, -0.04 * k + Math.abs(s) * 0.06 * k, 0],
  }
}

export const IDLE: Pose = {
  lShoulder: [0, 0, 0.08],
  rShoulder: [0, 0, -0.08],
  lElbow: [-0.15, 0, 0],
  rElbow: [-0.15, 0, 0],
}

/** Fielder walking in / ready crouch. */
export const READY: Pose = {
  spine: [0.35, 0, 0],
  neck: [-0.3, 0, 0],
  lHip: [-0.5, 0, 0.12],
  rHip: [-0.5, 0, -0.12],
  lKnee: [0.8, 0, 0],
  rKnee: [0.8, 0, 0],
  lShoulder: [-0.6, 0, 0.25],
  rShoulder: [-0.6, 0, -0.25],
  lElbow: [-0.6, 0, 0],
  rElbow: [-0.6, 0, 0],
  offset: [0, -0.14, 0],
}

export const KEEPER_CROUCH: Pose = {
  spine: [0.5, 0, 0],
  neck: [-0.55, 0, 0],
  lHip: [-1.4, 0, 0.35],
  rHip: [-1.4, 0, -0.35],
  lKnee: [2.2, 0, 0],
  rKnee: [2.2, 0, 0],
  lShoulder: [-0.9, 0, 0.1],
  rShoulder: [-0.9, 0, -0.1],
  lElbow: [-0.4, 0, 0],
  rElbow: [-0.4, 0, 0],
  offset: [0, -0.5, 0],
}

/** Catch: both hands up in front of the face. */
export const CATCH_HIGH: Pose = {
  lShoulder: [-2.6, 0, 0.2],
  rShoulder: [-2.6, 0, -0.2],
  lElbow: [-0.4, 0, 0],
  rElbow: [-0.4, 0, 0],
  neck: [-0.25, 0, 0],
}

/** Full-length dive to the player's right (+lean roll). */
export function divePose(u: number): Pose {
  const e = Math.min(1, u)
  return {
    lean: [0, 0, -1.35 * e],
    offset: [-0.55 * e, -0.7 * e, 0],
    lShoulder: [-1.2, 0, 2.6 * e],
    rShoulder: [-1.2, 0, -2.9 * e],
    lElbow: [-0.2, 0, 0],
    rElbow: [-0.2, 0, 0],
    lHip: [-0.3, 0, 0.3 * e],
    rHip: [0.2, 0, -0.1],
    lKnee: [0.5, 0, 0],
    rKnee: [0.2, 0, 0],
  }
}

/** Smoothstep blended with linear: eases between keys without stopping dead on each one. */
const easeKey = (u: number) => {
  const x = Math.max(0, Math.min(1, u))
  return 0.45 * x + 0.55 * x * x * (3 - 2 * x)
}

/** Sample a keyframed pose track at time t (keys sorted by time). */
function track(keys: [number, Pose][], t: number): Pose {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [t1, p1] = keys[i]
    if (t <= t1) {
      const [t0, p0] = keys[i - 1]
      return lerpPose(p0, p1, easeKey((t - t0) / (t1 - t0)))
    }
  }
  return keys[keys.length - 1][1]
}

/**
 * Overarm throw with a crow hop. u 0..1: the hop and wind-up take the first 45%, then the arm
 * comes over the top (shoulder X rises past straight up) and the body rotates through.
 */
export function throwPose(u: number): Pose {
  return track(
    [
      [0, { ...READY }],
      [0.25, { spine: [0.1, 0.7, 0], lHip: [-0.7, 0, 0], lKnee: [0.6, 0, 0], rHip: [0.2, 0, 0], rKnee: [0.3, 0, 0], rShoulder: [1.2, 0, -0.35], rElbow: [-0.8, 0, 0], lShoulder: [-1.2, 0, 0.2], lElbow: [-0.4, 0, 0], offset: [0, 0.1, 0] }],
      [0.45, { spine: [-0.05, 0.75, 0], lHip: [-0.5, 0, 0], lKnee: [0.2, 0, 0], rHip: [0.25, 0, 0], rKnee: [0.35, 0, 0], rShoulder: [2.6, 0, -0.35], rElbow: [-1.6, 0, 0], lShoulder: [-1.6, 0, 0.15], lElbow: [-0.2, 0, 0], neck: [0, -0.6, 0], offset: [0, -0.02, 0] }],
      [0.62, { spine: [0.15, 0.1, 0], lHip: [-0.55, 0, 0], lKnee: [0.25, 0, 0], rHip: [0.35, 0, 0], rKnee: [0.5, 0, 0], rShoulder: [3.5, 0, -0.25], rElbow: [-0.7, 0, 0], lShoulder: [-0.6, 0, 0.25], lElbow: [-0.6, 0, 0], neck: [0, -0.1, 0], offset: [0, -0.06, 0] }],
      [1, { spine: [0.5, -0.5, 0], lHip: [-0.6, 0, 0], lKnee: [0.4, 0, 0], rHip: [0.5, 0, 0], rKnee: [0.8, 0, 0], rShoulder: [4.7, 0, 0.1], rElbow: [-0.1, 0, 0], lShoulder: [0.4, 0, 0.3], lElbow: [-0.7, 0, 0], neck: [-0.2, 0.3, 0], offset: [0, -0.12, 0] }],
    ],
    u,
  )
}

/**
 * Bowling action around release (t = 0, seconds). The bowling arm turns one way only: from by
 * the chin, down and back, up over the top to release just past vertical, then down across the
 * body. `gather` is how long the bound and delivery stride take (pace bowlers leap longer);
 * `k` is 0..1 effort (pace 1, spin ~0.45) and scales the leap, the lean and the follow-through.
 */
export function bowlAction(t: number, gather = 0.36, k = 1): Pose {
  const s = gather / 0.36
  const lean = 0.5 + 0.5 * k
  return track(
    [
      [-0.36 * s, { spine: [0.15, 0, 0], rShoulder: [-0.6, 0, -0.2], rElbow: [-1.6, 0, 0], lShoulder: [-1.0, 0, 0.2], lElbow: [-1.4, 0, 0], lHip: [-0.4, 0, 0], lKnee: [0.6, 0, 0], rHip: [0.3, 0, 0], rKnee: [0.4, 0, 0], offset: [0, -0.04, 0] }],
      // the bound: front knee high, hands up by the chin, body turning side-on
      [-0.26 * s, { spine: [-0.05, 0.4, 0], rShoulder: [-1.2, 0, -0.3], rElbow: [-1.9, 0, 0], lShoulder: [-2.2, 0, 0.25], lElbow: [-0.9, 0, 0], lHip: [-1.25 * (0.6 + 0.4 * k), 0, 0], lKnee: [1.5 * (0.6 + 0.4 * k), 0, 0], rHip: [0.15, 0, 0], rKnee: [0.6, 0, 0], offset: [0, 0.16 * k, 0] }],
      // back foot lands side-on: front arm reaching high, bowling arm swung down and back
      [-0.17 * s, { spine: [-0.25 * lean, 0.7, 0], neck: [0, -0.7, 0], rShoulder: [0.7, 0, -0.25], rElbow: [-0.2, 0, 0], lShoulder: [-2.9, 0, 0.2], lElbow: [-0.15, 0, 0], lHip: [-0.9, 0, 0], lKnee: [0.5, 0, 0], rHip: [0.05, 0, 0], rKnee: [0.45, 0, 0], offset: [0, -0.05, 0] }],
      // front foot braced, the arm rising behind
      [-0.07 * s, { spine: [-0.15 * lean, 0.45, 0], neck: [0, -0.45, 0], rShoulder: [2.0, 0, -0.2], rElbow: [0, 0, 0], lShoulder: [-2.3, 0, 0.25], lElbow: [-0.2, 0, 0], lHip: [-0.55, 0, 0], lKnee: [0.12, 0, 0], rHip: [0.25, 0, 0], rKnee: [0.4, 0, 0], offset: [0, -0.03, 0] }],
      // release, just past straight up
      [0, { spine: [0.1, 0.05, 0], neck: [-0.1, -0.05, 0], rShoulder: [3.3, 0, -0.1], rElbow: [0, 0, 0], lShoulder: [-1.2, 0, 0.3], lElbow: [-0.6, 0, 0], lHip: [-0.6, 0, 0], lKnee: [0.1, 0, 0], rHip: [0.45, 0, 0], rKnee: [0.5, 0, 0], offset: [0, -0.04, 0] }],
      // follow-through: arm down across the body, back leg coming through
      [0.18, { spine: [0.6 * lean, -0.4, 0], neck: [-0.4, 0.2, 0], rShoulder: [4.9, 0, 0.35], rElbow: [-0.2, 0, 0], lShoulder: [0.3, 0, 0.35], lElbow: [-0.8, 0, 0], lHip: [-0.5, 0, 0], lKnee: [0.35, 0, 0], rHip: [0.1, 0, 0], rKnee: [1.1, 0, 0], offset: [0, -0.12 * lean, 0] }],
      [0.42, { spine: [0.45 * lean, -0.3, 0], neck: [-0.3, 0.1, 0], rShoulder: [5.7, 0, 0.3], rElbow: [-0.5, 0, 0], lShoulder: [0.5, 0, 0.25], lElbow: [-1.0, 0, 0], lHip: [-0.7, 0, 0], lKnee: [0.6, 0, 0], rHip: [-0.4, 0, 0], rKnee: [0.8, 0, 0], offset: [0, -0.08, 0] }],
    ],
    t,
  )
}

/** Walking cycle: short strides, arms swinging loose. */
export function walkPose(phase: number): Pose {
  const s = Math.sin(phase)
  const c = Math.cos(phase)
  return {
    lHip: [-0.4 * s, 0, 0.02],
    rHip: [0.4 * s, 0, -0.02],
    lKnee: [Math.max(0, -c) * 0.55 + 0.08, 0, 0],
    rKnee: [Math.max(0, c) * 0.55 + 0.08, 0, 0],
    lShoulder: [0.35 * s, 0, 0.08],
    rShoulder: [-0.35 * s, 0, -0.08],
    lElbow: [-0.3, 0, 0],
    rElbow: [-0.3, 0, 0],
    spine: [0.04, 0, 0],
    offset: [0, Math.abs(s) * 0.025 - 0.01, 0],
  }
}

/** Bent right down, right hand at the ground to scoop the ball up. */
export const PICKUP: Pose = {
  spine: [1.05, 0, 0],
  neck: [-0.7, 0, 0],
  lHip: [-1.0, 0, 0.15],
  rHip: [-0.15, 0, -0.1],
  lKnee: [1.25, 0, 0],
  rKnee: [0.7, 0, 0],
  rShoulder: [-1.15, 0, -0.1],
  rElbow: [-0.1, 0, 0],
  lShoulder: [-0.6, 0, 0.3],
  lElbow: [-0.5, 0, 0],
  offset: [0, -0.28, 0],
}

/** Catch taken in front of the chest, hands cupped together. */
export const CATCH_CHEST: Pose = {
  spine: [0.25, 0, 0],
  neck: [-0.3, 0, 0],
  lShoulder: [-1.15, 0, -0.35],
  rShoulder: [-1.15, 0, 0.35],
  lElbow: [-1.1, 0, 0],
  rElbow: [-1.1, 0, 0],
  lHip: [-0.25, 0, 0.1],
  rHip: [-0.25, 0, -0.1],
  lKnee: [0.4, 0, 0],
  rKnee: [0.4, 0, 0],
  offset: [0, -0.06, 0],
}

/** Both arms punching the air, bouncing on the toes. time in seconds. */
export function cheerPose(time: number, seed = 0): Pose {
  const w = Math.sin(time * 8 + seed)
  return {
    lShoulder: [-2.8 + 0.25 * w, 0, 0.35],
    rShoulder: [-2.8 - 0.25 * w, 0, -0.35],
    lElbow: [-0.45 - 0.3 * w, 0, 0],
    rElbow: [-0.45 + 0.3 * w, 0, 0],
    spine: [-0.12, 0, 0],
    neck: [-0.35, 0, 0],
    lKnee: [0.2 + 0.15 * Math.max(0, w), 0, 0],
    rKnee: [0.2 + 0.15 * Math.max(0, w), 0, 0],
    offset: [0, Math.max(0, w) * 0.12, 0],
  }
}

/** Bowler's appeal: arm up, leaning back, turned to the umpire. */
export const APPEAL: Pose = {
  spine: [-0.25, 0.3, 0],
  neck: [-0.45, 0.3, 0],
  rShoulder: [-2.95, 0, -0.3],
  rElbow: [-0.1, 0, 0],
  lShoulder: [-0.9, 0, 0.6],
  lElbow: [-0.4, 0, 0],
  lHip: [-0.3, 0, 0.12],
  rHip: [0.2, 0, -0.12],
  lKnee: [0.25, 0, 0],
  rKnee: [0.3, 0, 0],
}

/** Hands on head: that went a long way. */
export const HANDS_ON_HEAD: Pose = {
  spine: [-0.08, 0, 0],
  neck: [-0.25, 0, 0],
  lShoulder: [-2.3, 0, 1.0],
  rShoulder: [-2.3, 0, -1.0],
  lElbow: [-2.3, 0, 0],
  rElbow: [-2.3, 0, 0],
}

/** Clapping: hands meeting in front of the chest. time in seconds. */
export function clapPose(time: number): Pose {
  const c = 0.5 + 0.5 * Math.sin(time * 14)
  return {
    lShoulder: [-1.25, 0, -0.15 - 0.35 * c],
    rShoulder: [-1.25, 0, 0.15 + 0.35 * c],
    lElbow: [-1.0, 0, 0],
    rElbow: [-1.0, 0, 0],
    spine: [0.05, 0, 0],
  }
}

/** Getting back up from a dive. u 0..1 */
export function getUpPose(u: number): Pose {
  return lerpPose(divePose(1), READY, easeKey(u))
}

/** Umpire signals. */
export function umpirePose(signal: 'none' | 'four' | 'six' | 'out' | 'wide' | 'noball' | 'bye', time: number): Pose {
  switch (signal) {
    case 'out':
      return { rShoulder: [-3.0, 0, -0.1], rElbow: [0, 0, 0], lShoulder: [0, 0, 0.1] }
    case 'six':
      return { rShoulder: [-3.05, 0, -0.15], lShoulder: [-3.05, 0, 0.15] }
    case 'four': {
      const w = Math.sin(time * 9) * 0.6
      return { rShoulder: [-1.5, 0, -0.4 + w], rElbow: [0, 0, 0], lShoulder: [0, 0, 0.1] }
    }
    case 'wide':
      return { rShoulder: [0, 0, -1.55], lShoulder: [0, 0, 1.55] }
    case 'noball':
      return { rShoulder: [0, 0, -1.55], lShoulder: [0, 0, 0.1] }
    case 'bye':
      return { rShoulder: [-3.0, 0, -0.1], rElbow: [0, 0, 0] }
    default:
      return { lShoulder: [0.1, 0, 0.05], rShoulder: [0.1, 0, -0.05], lElbow: [-0.9, 0, 0], rElbow: [-0.9, 0, 0], spine: [0.08, 0, 0] }
  }
}
