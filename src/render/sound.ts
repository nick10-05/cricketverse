/**
 * Match audio. Recorded CC0 clips (public/audio, see THIRD_PARTY_NOTICES.md) layered with a little
 * synthesis, mixed on three buses (ambience, crowd, effects) into a soft compressor so busy moments
 * never get harsh. Everything is client-side and driven by each player's own animation clock, so it
 * has no effect on multiplayer state. If a clip hasn't loaded (or fails), a synthesised fallback plays.
 */
import { ambienceGain, BUS_TRIM, BUSES, clamp01, jitter, loadVolumes, makePicker, saveVolumes, type Bus, type Volumes } from './audioMix'

export type { Bus, Volumes } from './audioMix'

const store = (() => {
  try {
    return window.localStorage
  } catch {
    return null
  }
})()

let muted = false
try {
  muted = store?.getItem('cvx-muted') === '1'
} catch {
  /* ignore */
}
let volumes: Volumes = loadVolumes(store)

// ----------------------------------------------------------------------------- graph

interface Graph {
  ctx: AudioContext
  master: GainNode
  bus: Record<Bus, GainNode>
}
let g: Graph | null = null
const voices: Record<Bus, number> = { ambience: 0, crowd: 0, sfx: 0 }
const MAX_VOICES: Record<Bus, number> = { ambience: 4, crowd: 6, sfx: 12 }
const pick = makePicker()

function graph(): Graph {
  if (!g) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new C()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 12
    comp.ratio.value = 3
    comp.attack.value = 0.01
    comp.release.value = 0.25
    const master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.9
    master.connect(comp).connect(ctx.destination)
    const bus = {} as Record<Bus, GainNode>
    for (const b of BUSES) {
      bus[b] = ctx.createGain()
      bus[b].gain.value = volumes[b] * BUS_TRIM[b]
      bus[b].connect(master)
    }
    g = { ctx, master, bus }
    // Pause everything while the tab is hidden; pick up again when it comes back.
    document.addEventListener('visibilitychange', () => {
      if (!g) return
      if (document.hidden) void g.ctx.suspend()
      else if (!muted) void g.ctx.resume()
    })
    void loadSamples(ctx)
  }
  if (g.ctx.state === 'suspended' && !document.hidden) void g.ctx.resume()
  return g
}

function ready() {
  return !muted && g !== null
}

// ----------------------------------------------------------------------------- volume settings

export function isMuted() {
  return muted
}
export function setMuted(m: boolean) {
  muted = m
  try {
    store?.setItem('cvx-muted', m ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (!g) {
    if (!m) graph()
    return
  }
  g.master.gain.setTargetAtTime(m ? 0 : 0.9, g.ctx.currentTime, 0.08)
  if (m) crowdAmbience(false)
}
export function getVolumes(): Volumes {
  return { ...volumes }
}
export function setVolume(bus: Bus, v: number) {
  volumes = { ...volumes, [bus]: clamp01(v) }
  saveVolumes(store, volumes)
  if (g) g.bus[bus].gain.setTargetAtTime(volumes[bus] * BUS_TRIM[bus], g.ctx.currentTime, 0.05)
}

// ----------------------------------------------------------------------------- samples

const SAMPLES = {
  bed: ['crowd-bed'],
  applauseBig: ['applause-big-1', 'applause-big-2'],
  applauseSmall: ['applause-small-1', 'applause-small-2'],
  shout: ['shout'],
  whistle: ['whistle-1', 'whistle-2'],
  bounce: ['bounce-1', 'bounce-2', 'bounce-3'],
  wood: ['wood-1', 'wood-2', 'wood-3', 'wood-4'],
  run: ['run-grass'],
} as const
type SampleSet = keyof typeof SAMPLES
const buffers: Partial<Record<SampleSet, AudioBuffer[]>> = {}

async function loadSamples(ctx: AudioContext) {
  const base = `${import.meta.env.BASE_URL}audio/`
  await Promise.all(
    (Object.keys(SAMPLES) as SampleSet[]).map(async (set) => {
      const list: AudioBuffer[] = []
      for (const name of SAMPLES[set]) {
        try {
          const res = await fetch(base + name + '.mp3')
          if (!res.ok) continue
          list.push(await ctx.decodeAudioData(await res.arrayBuffer()))
        } catch {
          /* this clip falls back to synthesis */
        }
      }
      if (list.length) buffers[set] = list
      if (set === 'bed' && list.length && amb.on) startBed()
    }),
  )
}

interface PlayOpts {
  gain?: number
  rate?: number
  delay?: number
  pan?: number
  /** Play only this many seconds, fading out over the last 30 %. */
  length?: number
  offset?: number
}

/** Plays one variant of a clip on a bus. Returns false if the clip isn't available. */
function sample(set: SampleSet, bus: Bus, o: PlayOpts = {}): boolean {
  if (!ready()) return false
  const list = buffers[set]
  if (!list) return false
  if (voices[bus] >= MAX_VOICES[bus]) return true // busy moment: drop it rather than pile up
  const { ctx } = g!
  const buf = list[pick(set, list.length)]
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = o.rate ?? 1
  const gain = ctx.createGain()
  const t0 = ctx.currentTime + (o.delay ?? 0)
  const vol = o.gain ?? 1
  gain.gain.setValueAtTime(vol, t0)
  let node: AudioNode = src.connect(gain)
  if (o.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner()
    p.pan.value = o.pan
    node = node.connect(p)
  }
  node.connect(g!.bus[bus])
  const offset = Math.min(o.offset ?? 0, Math.max(0, buf.duration - 0.1))
  const len = o.length ?? (buf.duration - offset) / src.playbackRate.value
  if (o.length) {
    gain.gain.setValueAtTime(vol, t0 + len * 0.7)
    gain.gain.linearRampToValueAtTime(0.0001, t0 + len)
  }
  src.start(t0, offset)
  src.stop(t0 + len + 0.05)
  voices[bus]++
  src.onended = () => {
    voices[bus]--
    src.disconnect()
  }
  return true
}

// ----------------------------------------------------------------------------- synthesis

function noise(bus: Bus, duration: number, gain: number, filterFreq: number, type: BiquadFilterType = 'bandpass', q = 1, delay = 0) {
  if (!ready()) return
  const { ctx } = g!
  const len = Math.floor(ctx.sampleRate * duration)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = filterFreq
  f.Q.value = q
  const gn = ctx.createGain()
  gn.gain.value = gain
  src.connect(f).connect(gn).connect(g!.bus[bus])
  src.start(ctx.currentTime + delay)
}

/** Crowd voice: band-passed noise that swells and fades, like a stand going "oooh" or roaring. */
function swell(duration: number, gain: number, f0: number, f1: number, q = 0.7, attack = 0.25, delay = 0) {
  if (!ready()) return
  if (voices.crowd >= MAX_VOICES.crowd) return
  const { ctx } = g!
  const len = Math.floor(ctx.sampleRate * duration)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4
    data[i] = last
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  const t0 = ctx.currentTime + delay
  f.frequency.setValueAtTime(f0, t0)
  f.frequency.linearRampToValueAtTime(f1, t0 + duration * 0.6)
  f.frequency.linearRampToValueAtTime(f0, t0 + duration)
  const gn = ctx.createGain()
  gn.gain.setValueAtTime(0.0001, t0)
  gn.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  gn.gain.setTargetAtTime(0.0001, t0 + duration * 0.55, duration * 0.18)
  src.connect(f).connect(gn).connect(g!.bus.crowd)
  src.start(t0)
  src.stop(t0 + duration + 0.5)
  voices.crowd++
  src.onended = () => voices.crowd--
}

function tone(bus: Bus, freq: number, duration: number, gain: number, type: OscillatorType = 'sine', slide = 0, delay = 0) {
  if (!ready()) return
  const { ctx } = g!
  const t0 = ctx.currentTime + delay
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + duration)
  const gn = ctx.createGain()
  gn.gain.setValueAtTime(0.0001, t0)
  gn.gain.exponentialRampToValueAtTime(gain, t0 + 0.004)
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  o.connect(gn).connect(g!.bus[bus])
  o.start(t0)
  o.stop(t0 + duration + 0.02)
}

// ----------------------------------------------------------------------------- effects

export const sfx = {
  /** Call from a user gesture: creates/resumes the audio context (needed on iOS and Android). */
  unlock() {
    if (!muted) graph()
  },
  /** Bowler lets it go: a soft rush of air, quicker for pace. */
  release(pace = 1) {
    noise('sfx', 0.18, 0.05 + 0.05 * pace, 1400 + 600 * pace, 'bandpass', 0.8)
  },
  /** Willow on leather: a crisp wooden crack with a short "tock" body; edges sound thin. */
  bat(quality: number, edge = false) {
    if (edge) {
      sample('wood', 'sfx', { gain: 0.35, rate: jitter(1.7, 0.08) })
      tone('sfx', 2400, 0.05, 0.12, 'triangle', 0.8)
      return
    }
    const q = clamp01(quality)
    if (!sample('wood', 'sfx', { gain: 0.55 + 0.4 * q, rate: jitter(1.2 + 0.15 * q, 0.04) })) noise('sfx', 0.025, 0.4 + q * 0.3, 2600, 'bandpass', 1.5)
    const f = jitter(1050 + q * 450, 30)
    tone('sfx', f, 0.05 + q * 0.05, 0.18 + q * 0.16, 'sine', 0.92)
    tone('sfx', 190, 0.08, 0.14 + q * 0.12, 'sine', 0.7)
  },
  /** Ball into the pitch: a dull thud, heavier for quicker bowling. */
  pitch(pace = 1) {
    const k = clamp01(pace)
    if (!sample('bounce', 'sfx', { gain: 0.45 + 0.3 * k, rate: jitter(0.72 + 0.12 * k, 0.03) })) noise('sfx', 0.06, 0.2 + 0.15 * k, 420 + 200 * k, 'lowpass')
    tone('sfx', 95 + 35 * k, 0.07, 0.1 + 0.08 * k, 'sine', 0.6)
  },
  /** Ball into the keeper's gloves or a fielder's hands: a leathery pop. */
  gloves(soft = false) {
    noise('sfx', 0.05, soft ? 0.26 : 0.4, soft ? 900 : 1300, 'bandpass', 1.6)
    noise('sfx', 0.07, soft ? 0.18 : 0.26, 260, 'lowpass')
    tone('sfx', jitter(soft ? 230 : 300, 15), 0.05, 0.1, 'sine', 0.7)
  },
  /** Stumps flattened: hollow wood knocks, then the bails rattling away. */
  stumps() {
    if (!sample('wood', 'sfx', { gain: 0.8, rate: jitter(0.85, 0.03) })) tone('sfx', 1500, 0.09, 0.2, 'triangle', 0.75)
    sample('wood', 'sfx', { gain: 0.45, rate: jitter(1.05, 0.04), delay: 0.03, pan: 0.15 })
    tone('sfx', 980, 0.1, 0.12, 'triangle', 0.7)
    tone('sfx', 2100, 0.05, 0.08, 'triangle', 0.9, 0.08)
    tone('sfx', 1800, 0.04, 0.06, 'triangle', 0.9, 0.17)
  },
  /** A footfall on turf. */
  step(weight = 0.5) {
    noise('sfx', 0.035, 0.05 + 0.08 * weight, 260, 'lowpass')
  },
  /** Bats grounded and feet on grass as the batters complete a run. */
  run() {
    noise('sfx', 0.04, 0.14, 400, 'lowpass')
    sample('run', 'sfx', { gain: 0.25, offset: Math.random() * 2, length: 0.6, rate: jitter(1, 0.05) })
  },
  /** Generic cheer (kept for callers that just want "the crowd likes that"). */
  cheer(big: boolean) {
    if (big) sfx.six()
    else sfx.four()
  },
  /** A four: a quick lift from the crowd and warm applause, with the odd whistle. */
  four() {
    swell(1.8, 0.16, 600, 880, 0.7, 0.15)
    if (!sample('applauseBig', 'crowd', { gain: 0.75, rate: jitter(1, 0.03) })) sfx.clap(0.8)
    sample('whistle', 'crowd', { gain: 0.16, delay: 0.35, rate: jitter(1, 0.05), pan: -0.4 })
  },
  /** A six: a bigger roar, shouts, whistles and applause that rolls on a little longer. */
  six() {
    swell(2.6, 0.24, 620, 1000, 0.6, 0.18)
    if (!sample('applauseBig', 'crowd', { gain: 0.85, rate: jitter(1, 0.03) })) sfx.clap(1)
    sample('applauseBig', 'crowd', { gain: 0.4, delay: 1.2, rate: jitter(0.97, 0.03), pan: 0.3 })
    sample('shout', 'crowd', { gain: 0.45, delay: 0.1, rate: jitter(0.92, 0.04), pan: 0.2 })
    sample('whistle', 'crowd', { gain: 0.18, delay: 0.3, pan: -0.5 })
    sample('whistle', 'crowd', { gain: 0.13, delay: 0.9, rate: 1.06, pan: 0.5 })
  },
  /** A wicket: a sharp gasp turning into a roar, then applause and a whistle. */
  wicket() {
    swell(0.6, 0.14, 500, 750, 1, 0.05)
    swell(2.4, 0.22, 650, 1050, 0.6, 0.12, 0.2)
    sample('shout', 'crowd', { gain: 0.4, delay: 0.2, rate: jitter(0.88, 0.04) })
    if (!sample('applauseBig', 'crowd', { gain: 0.7, delay: 0.35 })) sfx.clap(0.9)
    sample('whistle', 'crowd', { gain: 0.15, delay: 0.6, pan: 0.4 })
  },
  /** Wide: the umpire's signal, as two soft falling notes. */
  wide() {
    tone('sfx', 784, 0.22, 0.09, 'sine', 0.98)
    tone('sfx', 587, 0.3, 0.08, 'sine', 0.98, 0.18)
    swell(1.1, 0.06, 380, 520, 1.2, 0.2, 0.1)
  },
  /** No-ball: a short, firmer whistle-like call, rising, so it can't be mistaken for a wide. */
  noball() {
    tone('sfx', 880, 0.12, 0.08, 'triangle', 1.05)
    tone('sfx', 1175, 0.2, 0.08, 'triangle', 1.03, 0.12)
    if (!sample('whistle', 'sfx', { gain: 0.12, delay: 0.32, length: 0.25, rate: 1.1 })) tone('sfx', 2000, 0.15, 0.04, 'sine', 1, 0.32)
  },
  /** "Oooh": the batter is beaten, or an edge drops short. */
  ooh() {
    swell(1.4, 0.16, 420, 620, 1.2, 0.2)
  },
  /** Polite applause: singles and twos. */
  clap(level = 0.5) {
    const l = clamp01(level)
    if (sample('applauseSmall', 'crowd', { gain: 0.25 + 0.35 * l, rate: jitter(1, 0.03), length: 1.8 + l })) return
    noise('crowd', 1.2, 0.05 + 0.06 * l, 2500, 'highpass')
  },
  groan() {
    swell(1.3, 0.14, 520, 340, 1.0, 0.15)
  },
  click() {
    tone('sfx', 660, 0.05, 0.08, 'triangle')
  },
  whoosh() {
    noise('sfx', 0.25, 0.12, 900, 'highpass')
  },
}

// ----------------------------------------------------------------------------- ambience

/**
 * The stadium bed: the recorded crowd, muffled to a murmur, played in overlapping segments from
 * random points with long crossfades so it never loops audibly. `level` swells it (ball in the air).
 */
const amb = {
  on: false,
  level: 0.12,
  gain: null as GainNode | null,
  timer: 0 as ReturnType<typeof setTimeout> | 0,
  fallback: null as AudioBufferSourceNode | null,
}
const SEG = 14
const FADE = 4

function bedGain() {
  const { ctx, bus } = g!
  if (!amb.gain) {
    amb.gain = ctx.createGain()
    amb.gain.gain.value = 0
    amb.gain.connect(bus.ambience)
  }
  return amb.gain
}

function startBed() {
  if (!g || amb.timer) return
  if (amb.fallback) {
    const f = amb.fallback
    amb.fallback = null
    try {
      f.stop(g.ctx.currentTime + FADE)
    } catch {
      /* already stopped */
    }
  }
  const segment = () => {
    if (!amb.on || !g) {
      amb.timer = 0
      return
    }
    const buf = buffers.bed![0]
    const { ctx } = g
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = jitter(1, 0.02)
    const fade = ctx.createGain()
    const t0 = ctx.currentTime + 0.05
    fade.gain.setValueAtTime(0, t0)
    fade.gain.linearRampToValueAtTime(1, t0 + FADE)
    fade.gain.setValueAtTime(1, t0 + SEG - FADE)
    fade.gain.linearRampToValueAtTime(0, t0 + SEG)
    src.connect(fade).connect(bedGain())
    src.start(t0, Math.random() * Math.max(0, buf.duration - SEG * 1.05))
    src.stop(t0 + SEG + 0.1)
    src.onended = () => src.disconnect()
    amb.timer = setTimeout(segment, (SEG - FADE) * 1000)
  }
  segment()
}

/** Synthesised murmur used until (or unless) the recorded bed loads. */
function startFallback() {
  const { ctx } = g!
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02
    d[i] = last * 2.5
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 650
  f.Q.value = 0.5
  src.connect(f).connect(bedGain())
  src.start()
  amb.fallback = src
}

/** Continuous murmur of the crowd. `level` (about 0.12 to 0.45) swells it, e.g. as a big hit flies. */
export function crowdAmbience(on: boolean, level = 0.12) {
  if (!on || muted) {
    amb.on = false
    if (amb.timer) clearTimeout(amb.timer)
    amb.timer = 0
    if (g && amb.gain) {
      amb.gain.gain.setTargetAtTime(0, g.ctx.currentTime, 0.5)
      if (amb.fallback) {
        try {
          amb.fallback.stop(g.ctx.currentTime + 2)
        } catch {
          /* already stopped */
        }
        amb.fallback = null
      }
    }
    return
  }
  const { ctx } = graph()
  amb.level = level
  if (!amb.on) {
    amb.on = true
    if (buffers.bed) startBed()
    else if (!amb.fallback) startFallback()
  }
  // swells rise in about a second and settle more slowly, so changes are never abrupt
  const target = ambienceGain(level)
  const cur = bedGain().gain
  cur.cancelScheduledValues(ctx.currentTime)
  cur.setTargetAtTime(target, ctx.currentTime, target > cur.value ? 0.35 : 0.9)
}
