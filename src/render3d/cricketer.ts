import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

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
      this.bat = buildBat(shadows)
      this.root.add(this.bat)
    }
    const ball = new THREE.Mesh(sphere(0.036, 10, 8), mat('#c3161e'))
    ball.visible = false
    ball.position.y = -0.06
    this.hands.r.add(ball)
    this.heldBall = ball
  }

  /** Add a mesh (and its outline shell) to a joint. */
  private part(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, line = true, cast = true) {
    const x = new THREE.Mesh(g, m)
    x.castShadow = this.shadows && cast
    parent.add(x)
    if (line && this.outlined) x.add(new THREE.Mesh(g, outline()))
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
  }
}

function buildBat(shadows: boolean) {
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

/** Overarm throw. u 0..1 */
export function throwPose(u: number): Pose {
  const wind = Math.min(1, u / 0.45)
  const fire = Math.max(0, (u - 0.45) / 0.55)
  return {
    spine: [0.2 * fire, 0.6 * (1 - fire) - 0.5 * fire, 0],
    rShoulder: [2.8 * wind - 4.6 * fire, 0, -0.3],
    rElbow: [-1.4 * wind + 1.2 * fire, 0, 0],
    lShoulder: [-1.4 * wind + 1.0 * fire, 0, 0.3],
    lElbow: [-0.5, 0, 0],
    lHip: [-0.6 * wind, 0, 0],
    rHip: [0.3, 0, 0],
    lKnee: [0.3, 0, 0],
    rKnee: [0.4 * fire, 0, 0],
  }
}

/** Bowling action around release (t=0). t in seconds relative to release. */
export function bowlPose(t: number): Pose {
  if (t < -0.32) return {}
  if (t < 0) {
    // gather + bound: arms up, front knee high, then the bowling arm windmills over the top
    const u = (t + 0.32) / 0.32
    return {
      lShoulder: [-2.9 * Math.min(1, u * 1.6), 0, 0.2],
      lElbow: [-0.2, 0, 0],
      rShoulder: [1.4 - 3.4 * u, 0, -0.15],
      rElbow: [-0.2 * (1 - u), 0, 0],
      lHip: [-1.3 * Math.sin(u * Math.PI), 0, 0],
      lKnee: [1.4 * Math.sin(u * Math.PI), 0, 0],
      rHip: [0.25 * u, 0, 0],
      spine: [-0.2 + 0.1 * u, 0.5 * (1 - u), 0],
      offset: [0, 0.08 * Math.sin(u * Math.PI), 0],
    }
  }
  // release and follow-through: arm sweeps down past the opposite hip, body folds over
  const u = Math.min(1, t / 0.45)
  return {
    rShoulder: [-2.0 - 2.4 * u, 0, -0.15 + 0.5 * u],
    rElbow: [0, 0, 0],
    lShoulder: [-2.9 + 3.1 * u, 0, 0.2],
    lElbow: [-0.3, 0, 0],
    spine: [-0.1 + 0.75 * u, -0.5 * u, 0],
    lHip: [-0.6 + 0.2 * u, 0, 0],
    lKnee: [0.15, 0, 0],
    rHip: [0.5 * u, 0, 0],
    rKnee: [0.9 * u, 0, 0],
    offset: [0, -0.08 * u, 0],
  }
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
