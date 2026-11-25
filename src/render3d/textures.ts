import * as THREE from 'three'

/** Procedurally painted textures: no downloads, no licences, tiny bundle. */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, count: number, light = true) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const a = Math.random() * amount
    ctx.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
}

/**
 * Outfield: mowing stripes, darker grass beyond the rope, a worn square.
 * Covers a square of side 2*fieldR metres centred on the field centre.
 */
export function grassTexture(fieldR: number, boundaryR: number) {
  const S = 2048
  const [c, ctx] = canvas(S, S)
  const m2px = S / (2 * fieldR)
  ctx.fillStyle = '#2f7d34'
  ctx.fillRect(0, 0, S, S)
  // stripes along the pitch direction
  const stripe = 6.5 * m2px
  for (let y = 0, i = 0; y < S; y += stripe, i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(0, y, S, stripe)
  }
  // circular mowing inside the 30-yard circle
  const cx = S / 2
  for (let r = 27 * m2px; r > 0; r -= stripe) {
    ctx.beginPath()
    ctx.arc(cx, cx, r, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.025)'
    ctx.lineWidth = stripe / 2
    ctx.stroke()
  }
  noise(ctx, S, S, 0.06, 120000, true)
  noise(ctx, S, S, 0.08, 120000, false)
  // beyond the boundary: darker, worn
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, S, S)
  ctx.arc(cx, cx, (boundaryR + 1.5) * m2px, 0, Math.PI * 2, true)
  ctx.fillStyle = 'rgba(10,40,15,0.55)'
  ctx.fill('evenodd')
  ctx.restore()
  // 30-yard circle dashes
  ctx.setLineDash([2.2 * m2px, 2.2 * m2px])
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 0.18 * m2px
  ctx.beginPath()
  ctx.arc(cx, cx, 27 * m2px, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  // the square around the pitch (lighter, rolled)
  ctx.fillStyle = 'rgba(190,200,120,0.12)'
  ctx.fillRect(cx - 9 * m2px, cx - 14 * m2px, 18 * m2px, 28 * m2px)
  const t = tex(c)
  t.anisotropy = 16
  return t
}

/** The 22-yard strip with creases painted on. u across, v along (v=0 at the striker end). */
export function pitchTexture(widthM: number, lengthM: number, strikerStumpFromEnd: number) {
  const W = 256
  const H = 2048
  const [c, ctx] = canvas(W, H)
  const py = H / lengthM
  const px = W / widthM
  const g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, '#b49a63')
  g.addColorStop(0.5, '#d2b77d')
  g.addColorStop(1, '#b49a63')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  noise(ctx, W, H, 0.12, 30000, false)
  noise(ctx, W, H, 0.1, 20000, true)
  // worn patches at good length both ends + footmarks
  const wear = (vM: number) => {
    const rg = ctx.createRadialGradient(W / 2, vM * py, 2, W / 2, vM * py, 3.5 * py)
    rg.addColorStop(0, 'rgba(120,90,50,0.35)')
    rg.addColorStop(1, 'rgba(120,90,50,0)')
    ctx.fillStyle = rg
    ctx.fillRect(0, (vM - 4) * py, W, 8 * py)
  }
  const s0 = strikerStumpFromEnd
  const s1 = s0 + 20.12
  wear(s0 + 5.5)
  wear(s1 - 5.5)
  for (const s of [s0, s1]) {
    const dir = s === s0 ? 1 : -1
    ctx.fillStyle = 'rgba(95,70,40,0.4)'
    for (let i = 0; i < 26; i++) ctx.fillRect(W / 2 + (Math.random() - 0.5) * 1.6 * px, (s + dir * (0.4 + Math.random() * 1.6)) * py, 6, 9)
  }
  // creases
  const white = 'rgba(255,255,255,0.95)'
  ctx.fillStyle = white
  const line = (v: number, x0: number, x1: number) => ctx.fillRect(W / 2 + x0 * px, v * py - 2, (x1 - x0) * px, 4)
  for (const s of [s0, s1]) {
    const dir = s === s0 ? 1 : -1
    line(s, -1.32, 1.32) // bowling crease
    line(s + dir * 1.22, -widthM / 2, widthM / 2) // popping crease
    for (const x of [-1.32, 1.32]) {
      const a = Math.min(s - dir * 1.22, s + dir * 1.22)
      ctx.fillRect(W / 2 + x * px - 2, a * py, 4, 2.44 * py)
    }
  }
  return tex(c)
}

/** LED advertising band around the boundary (repeats around the circle). */
export function adBoardTexture() {
  const [c, ctx] = canvas(2048, 64)
  const ads = [
    { bg: '#ff6a1f', fg: '#fff', text: 'CRICKETVERSE' },
    { bg: '#0e1530', fg: '#ffd23f', text: 'ARENA' },
    { bg: '#1aa7ff', fg: '#fff', text: 'PLAY WITH FRIENDS' },
    { bg: '#0e1530', fg: '#2bd17e', text: '1 – 10 OVERS' },
  ]
  const w = 2048 / ads.length
  ads.forEach((a, i) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, a.bg)
    g.addColorStop(1, shade(a.bg, -0.25))
    ctx.fillStyle = g
    ctx.fillRect(i * w, 0, w, 64)
    ctx.fillStyle = a.fg
    ctx.font = '900 40px Outfit, Arial Black, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(a.text, i * w + w / 2, 34)
  })
  const t = tex(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

/** Seat rows for the stands. */
export function seatTexture() {
  const [c, ctx] = canvas(256, 256)
  ctx.fillStyle = '#1c2340'
  ctx.fillRect(0, 0, 256, 256)
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = '#2a3560'
    ctx.fillRect(0, y, 256, 9)
    ctx.fillStyle = '#121729'
    ctx.fillRect(0, y + 9, 256, 3)
  }
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Cricket ball: white leather with a stitched seam. */
export function ballTexture() {
  const [c, ctx] = canvas(256, 128)
  ctx.fillStyle = '#f4f1ea'
  ctx.fillRect(0, 0, 256, 128)
  noise(ctx, 256, 128, 0.08, 3000, false)
  ctx.fillStyle = '#c9c2b4'
  ctx.fillRect(0, 60, 256, 8)
  ctx.strokeStyle = '#b3261e'
  ctx.lineWidth = 2
  for (let x = 0; x < 256; x += 6) {
    ctx.beginPath()
    ctx.moveTo(x, 56)
    ctx.lineTo(x + 3, 60)
    ctx.moveTo(x, 72)
    ctx.lineTo(x + 3, 68)
    ctx.stroke()
  }
  return tex(c)
}

/** Jersey with a team-coloured body, a sash and the team name on the back. */
export function jerseyTexture(main: string, accent: string, name: string) {
  const [c, ctx] = canvas(256, 256)
  ctx.fillStyle = main
  ctx.fillRect(0, 0, 256, 256)
  const g = ctx.createLinearGradient(0, 0, 256, 0)
  g.addColorStop(0, 'rgba(0,0,0,0.25)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(0,0,0,0.25)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = accent
  ctx.save()
  ctx.translate(128, 128)
  ctx.rotate(-0.5)
  ctx.fillRect(-200, -14, 400, 22)
  ctx.restore()
  // back (u 0.5..1 faces away in our capsule mapping)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '900 30px Outfit, Arial Black, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(name.toUpperCase().slice(0, 8), 192, 110)
  ctx.font = '900 64px Outfit, Arial Black, sans-serif'
  ctx.fillText(String(7 + (name.length % 12)), 192, 175)
  return tex(c)
}

/** Glow sprite for floodlights. */
export function glowTexture() {
  const [c, ctx] = canvas(128, 128)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,240,1)')
  g.addColorStop(0.2, 'rgba(255,250,220,0.55)')
  g.addColorStop(1, 'rgba(255,250,220,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return tex(c)
}

/** Soft round shadow blob. */
export function blobTexture() {
  const [c, ctx] = canvas(64, 64)
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return tex(c, false)
}

/** Giant screen showing the live score. Returns the texture and a redraw function. */
export function scoreboardTexture() {
  const [c, ctx] = canvas(1024, 512)
  const t = tex(c)
  const draw = (lines: { big: string; small: string; color: string }) => {
    ctx.fillStyle = '#05070f'
    ctx.fillRect(0, 0, 1024, 512)
    const g = ctx.createLinearGradient(0, 0, 1024, 0)
    g.addColorStop(0, lines.color)
    g.addColorStop(1, shade(lines.color, -0.4))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 90)
    ctx.fillStyle = '#fff'
    ctx.font = '900 64px Outfit, Arial Black, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('CRICKETVERSE ARENA', 512, 48)
    ctx.font = '900 190px Outfit, Arial Black, sans-serif'
    ctx.fillText(lines.big, 512, 270)
    ctx.font = '700 60px Outfit, Arial, sans-serif'
    ctx.fillStyle = '#ffd23f'
    ctx.fillText(lines.small, 512, 440)
    // LED dot grid
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    for (let y = 0; y < 512; y += 4) ctx.fillRect(0, y, 1024, 1)
    t.needsUpdate = true
  }
  draw({ big: '0/0', small: 'Welcome', color: '#ff6a1f' })
  return { texture: t, draw }
}

export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
