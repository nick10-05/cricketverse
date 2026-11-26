import * as THREE from 'three'
import { BOUNDARY_R, FIELD_CENTER, PITCH_LEN } from '../game/physics'
import { adBoardTexture, glowTexture, grassTexture, pitchTexture, scoreboardTexture, seatTexture } from './textures'

const C = new THREE.Vector3(FIELD_CENTER.x, 0, FIELD_CENTER.z)
const FIELD_R = 112

export interface Stadium {
  group: THREE.Group
  crowd: { update(time: number, excitement: number): void }
  scoreboard: (s: { big: string; small: string; color: string }) => void
}

export function buildStadium(quality: 'high' | 'medium' | 'low'): Stadium {
  const group = new THREE.Group()

  // ---------------------------------------------------------------- outfield
  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(FIELD_R, 128),
    new THREE.MeshStandardMaterial({ map: grassTexture(FIELD_R, BOUNDARY_R), roughness: 0.92, metalness: 0 }),
  )
  grass.rotation.x = -Math.PI / 2
  grass.position.copy(C)
  grass.receiveShadow = true
  group.add(grass)

  // ---------------------------------------------------------------- pitch
  const pitchLen = PITCH_LEN + 4.4
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, pitchLen),
    new THREE.MeshStandardMaterial({ map: pitchTexture(3.2, pitchLen, 2.2), roughness: 0.85 }),
  )
  pitch.rotation.x = -Math.PI / 2
  // v=0 should be the striker end (+z); plane's v runs -y→+y which maps to +z→-z after rotation.
  pitch.position.set(0, 0.006, 2.2 - pitchLen / 2)
  pitch.receiveShadow = true
  group.add(pitch)

  // ---------------------------------------------------------------- boundary rope
  const rope = new THREE.Mesh(
    new THREE.TorusGeometry(BOUNDARY_R, 0.09, 8, 220),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x333333, roughness: 0.5 }),
  )
  rope.rotation.x = -Math.PI / 2
  rope.position.set(C.x, 0.09, C.z)
  group.add(rope)

  // ---------------------------------------------------------------- LED boards
  const adTex = adBoardTexture()
  adTex.repeat.set(-10, 1) // negative: the boards are seen from inside the cylinder
  const boards = new THREE.Mesh(
    new THREE.CylinderGeometry(BOUNDARY_R + 5, BOUNDARY_R + 5, 1.1, 160, 1, true),
    new THREE.MeshStandardMaterial({ map: adTex, emissiveMap: adTex, emissive: 0xffffff, emissiveIntensity: 0.85, side: THREE.BackSide, roughness: 0.4 }),
  )
  boards.position.set(C.x, 0.55, C.z)
  group.add(boards)

  // ---------------------------------------------------------------- stands (two tiers + roof)
  const seat = seatTexture()
  seat.repeat.set(90, 10)
  const standMat = new THREE.MeshStandardMaterial({ map: seat, roughness: 0.9, side: THREE.DoubleSide })
  const tier = (pts: [number, number][]) => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 128)
    const m = new THREE.Mesh(g, standMat)
    m.position.copy(C)
    group.add(m)
  }
  const R0 = BOUNDARY_R + 9
  tier([
    [R0 - 1, 0],
    [R0, 2.4],
    [R0 + 24, 15],
  ])
  tier([
    [R0 + 24, 15],
    [R0 + 27, 16],
    [R0 + 27, 18.5],
    [R0 + 48, 32],
  ])
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(R0 - 0.5, R0 - 0.5, 2.4, 128, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x0b1024, side: THREE.BackSide, roughness: 0.8 }),
  )
  wall.position.set(C.x, 1.2, C.z)
  group.add(wall)
  // roof canopy with an emissive light strip
  const roof = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [R0 + 52, 38],
        [R0 + 30, 40],
        [R0 + 29, 39.4],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      128,
    ),
    new THREE.MeshStandardMaterial({ color: 0x0c1226, roughness: 0.7, side: THREE.DoubleSide }),
  )
  roof.position.copy(C)
  group.add(roof)
  const strip = new THREE.Mesh(
    new THREE.TorusGeometry(R0 + 29.5, 0.35, 6, 160),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8 }),
  )
  strip.rotation.x = -Math.PI / 2
  strip.position.set(C.x, 39.2, C.z)
  group.add(strip)

  // ---------------------------------------------------------------- crowd (GPU-animated points)
  const crowd = buildCrowd(quality === 'high' ? 14000 : quality === 'medium' ? 8000 : 4000, R0)
  group.add(crowd.points)

  // ---------------------------------------------------------------- floodlights
  const glow = glowTexture()
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x3a4566, roughness: 0.6, metalness: 0.4 })
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xfffbe8 })
  const towerGeo = new THREE.CylinderGeometry(0.5, 1.1, 62, 8)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    const r = R0 + 56
    const x = C.x + Math.cos(a) * r
    const z = C.z + Math.sin(a) * r
    const tower = new THREE.Mesh(towerGeo, towerMat)
    tower.position.set(x, 31, z)
    group.add(tower)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.6), panelMat)
    panel.position.set(x, 63, z)
    panel.lookAt(C.x, 0, C.z)
    group.add(panel)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff6d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    sprite.position.set(x, 63, z)
    sprite.scale.set(38, 38, 1)
    group.add(sprite)
  }

  // ---------------------------------------------------------------- sight screens
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18, roughness: 0.9 })
  for (const zEnd of [C.z - (BOUNDARY_R + 7), C.z + (BOUNDARY_R + 7)]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 0.6), screenMat)
    s.position.set(0, 4.5, zEnd)
    group.add(s)
  }

  // ---------------------------------------------------------------- big screen (behind the bowler, upper tier)
  const sb = scoreboardTexture()
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 14),
    new THREE.MeshBasicMaterial({ map: sb.texture, toneMapped: false }),
  )
  screen.position.set(-34, 36, C.z - (R0 + 36))
  screen.lookAt(0, 6, 0)
  group.add(screen)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(29.5, 15.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x111522 }))
  frame.position.copy(screen.position).add(new THREE.Vector3(0, 0, -0.5).applyQuaternion(screen.quaternion))
  frame.quaternion.copy(screen.quaternion)
  group.add(frame)

  return { group, crowd, scoreboard: sb.draw }
}

function buildCrowd(n: number, R0: number) {
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const phase = new Float32Array(n)
  const ang = new Float32Array(n)
  const palette = ['#e94b4b', '#f5c542', '#3fb6ff', '#ffffff', '#ff8a3d', '#7a5cff', '#2bd17e', '#ff5fa2', '#1a2238', '#d9d9d9', '#ff6a1f', '#1aa7ff'].map((h) => new THREE.Color(h))
  for (let i = 0; i < n; i++) {
    const upper = Math.random() < 0.45
    const u = Math.random()
    const a = Math.random() * Math.PI * 2
    // place on the tier surfaces
    const r = upper ? R0 + 27.5 + u * 20 : R0 + 0.8 + u * 23
    const y = upper ? 19 + u * 12.6 + 0.7 : 2.6 + u * 12.2 + 0.7
    pos[i * 3] = FIELD_CENTER.x + Math.cos(a) * r
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = FIELD_CENTER.z + Math.sin(a) * r
    const c = palette[Math.floor(Math.random() * palette.length)]
    const shadeF = 0.65 + Math.random() * 0.35
    col[i * 3] = c.r * shadeF
    col[i * 3 + 1] = c.g * shadeF
    col[i * 3 + 2] = c.b * shadeF
    phase[i] = Math.random() * 6.28
    ang[i] = a
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('phase', new THREE.BufferAttribute(phase, 1))
  g.setAttribute('ang', new THREE.BufferAttribute(ang, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uExcite: { value: 0 }, uWave: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float phase;
      attribute float ang;
      uniform float uTime;
      uniform float uExcite;
      uniform float uWave;
      uniform float uScale;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec3 p = position;
        float d = abs(mod(ang - uWave + 3.14159, 6.28318) - 3.14159);
        float wave = smoothstep(0.5, 0.0, d) * 1.1;
        p.y += max(0.0, sin(uTime * (3.0 + uExcite * 5.0) + phase)) * (0.08 + uExcite * 0.45) + wave;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * 340.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        // head + shoulders silhouette
        float head = length(c - vec2(0.0, -0.22)) - 0.16;
        float body = length(vec2(c.x * 0.8, max(0.0, c.y - 0.05))) - 0.3;
        if (min(head, body) > 0.0) discard;
        vec3 col = head < 0.0 ? vec3(0.78, 0.56, 0.42) : vColor;
        gl_FragColor = vec4(col * 0.9, 1.0);
      }`,
    vertexColors: true,
  })
  const points = new THREE.Points(g, mat)
  points.frustumCulled = false
  let waveT = 0
  return {
    points,
    update(time: number, excitement: number) {
      mat.uniforms.uTime.value = time
      mat.uniforms.uExcite.value += (excitement - mat.uniforms.uExcite.value) * 0.05
      waveT += 0.012
      mat.uniforms.uWave.value = waveT % (Math.PI * 2)
      mat.uniforms.uScale.value = window.innerHeight / 900
    },
  }
}
