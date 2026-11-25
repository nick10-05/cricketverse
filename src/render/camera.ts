export interface V3 {
  x: number
  y: number
  z: number
}

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const norm = (a: V3): V3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / l, y: a.y / l, z: a.z / l }
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const lerpV = (a: V3, b: V3, t: number): V3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) })

export const NEAR = 0.25

/** A simple pinhole camera with near-plane clipping. */
export class Camera {
  pos: V3 = { x: 0, y: 2, z: 5 }
  target: V3 = { x: 0, y: 0, z: -10 }
  zoom = 1.3
  w = 800
  h = 600
  private f = 1
  private r: V3 = { x: 1, y: 0, z: 0 }
  private u: V3 = { x: 0, y: 1, z: 0 }
  private fw: V3 = { x: 0, y: 0, z: -1 }

  update(w: number, h: number) {
    this.w = w
    this.h = h
    this.fw = norm(sub(this.target, this.pos))
    this.r = norm(cross(this.fw, { x: 0, y: 1, z: 0 }))
    this.u = cross(this.r, this.fw)
    this.f = Math.min(w, h * 0.72) * this.zoom
  }

  toCam(p: V3): V3 {
    const d = sub(p, this.pos)
    return { x: dot(d, this.r), y: dot(d, this.u), z: dot(d, this.fw) }
  }

  projCam(c: V3) {
    return { x: this.w / 2 + (this.f * c.x) / c.z, y: this.h * 0.5 - (this.f * c.y) / c.z, s: this.f / c.z }
  }

  /** Project a world point. Returns null when behind the camera. */
  project(p: V3) {
    const c = this.toCam(p)
    if (c.z < NEAR) return null
    return this.projCam(c)
  }

  /** Project a polygon, clipped against the near plane. */
  polygon(pts: V3[]): { x: number; y: number }[] {
    const cam = pts.map((p) => this.toCam(p))
    const out: V3[] = []
    for (let i = 0; i < cam.length; i++) {
      const a = cam[i]
      const b = cam[(i + 1) % cam.length]
      const ain = a.z >= NEAR
      const bin = b.z >= NEAR
      if (ain) out.push(a)
      if (ain !== bin) {
        const t = (NEAR - a.z) / (b.z - a.z)
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR })
      }
    }
    return out.map((c) => this.projCam(c))
  }

  /** Screen point → point on the ground plane (y = 0). */
  unprojectGround(sx: number, sy: number): V3 | null {
    const cx = (sx - this.w / 2) / this.f
    const cy = -(sy - this.h * 0.5) / this.f
    const dir = {
      x: this.fw.x + this.r.x * cx + this.u.x * cy,
      y: this.fw.y + this.r.y * cx + this.u.y * cy,
      z: this.fw.z + this.r.z * cx + this.u.z * cy,
    }
    if (dir.y >= -1e-4) return null
    const t = -this.pos.y / dir.y
    return { x: this.pos.x + dir.x * t, y: 0, z: this.pos.z + dir.z * t }
  }
}
