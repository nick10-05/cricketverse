let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem('cvx-muted') === '1'
} catch {
  /* ignore */
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new C()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function isMuted() {
  return muted
}
export function setMuted(m: boolean) {
  muted = m
  if (m) crowdAmbience(false)
  try {
    localStorage.setItem('cvx-muted', m ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function noise(duration: number, gain: number, filterFreq: number, type: BiquadFilterType = 'bandpass', q = 1) {
  if (muted) return
  const a = ac()
  const len = Math.floor(a.sampleRate * duration)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = type
  f.frequency.value = filterFreq
  f.Q.value = q
  const g = a.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(a.destination)
  src.start()
}

/**
 * Crowd voice: band-passed noise whose pitch glides and whose volume swells and fades, which is
 * how thousands of people going "oooh" or roaring sound from the middle.
 */
function swell(duration: number, gain: number, f0: number, f1: number, q = 0.7, attack = 0.25, delay = 0) {
  if (muted) return
  const a = ac()
  const len = Math.floor(a.sampleRate * duration)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4
    data[i] = last
  }
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  const t0 = a.currentTime + delay
  f.frequency.setValueAtTime(f0, t0)
  f.frequency.linearRampToValueAtTime(f1, t0 + duration * 0.6)
  f.frequency.linearRampToValueAtTime(f0, t0 + duration)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.setTargetAtTime(0.0001, t0 + duration * 0.55, duration * 0.18)
  src.connect(f).connect(g).connect(a.destination)
  src.start(t0)
  src.stop(t0 + duration + 0.5)
}

/** Applause: thousands of random hand claps, built as sparse bursts of noise. */
function applause(duration: number, gain: number) {
  if (muted) return
  const a = ac()
  const len = Math.floor(a.sampleRate * duration)
  const buf = a.createBuffer(2, len, a.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    const claps = Math.floor(duration * 900)
    for (let c = 0; c < claps; c++) {
      const at = Math.floor(Math.random() * len)
      const env = Math.min(1, (at / len) * 8) * (1 - at / len)
      const amp = (0.3 + Math.random() * 0.7) * env
      const n = Math.floor(a.sampleRate * (0.004 + Math.random() * 0.006))
      for (let i = 0; i < n && at + i < len; i++) d[at + i] += (Math.random() * 2 - 1) * amp * (1 - i / n)
    }
  }
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = 900
  const g = a.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(a.destination)
  src.start()
}

function tone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine', slide = 0) {
  if (muted) return
  const a = ac()
  const o = a.createOscillator()
  o.type = type
  o.frequency.value = freq
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, a.currentTime + duration)
  const g = a.createGain()
  g.gain.setValueAtTime(gain, a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + duration)
  o.connect(g).connect(a.destination)
  o.start()
  o.stop(a.currentTime + duration)
}

export const sfx = {
  unlock() {
    if (!muted) ac()
  },
  /** Willow on leather: a bright, short "tock" with a woody body; edges sound thin. */
  bat(quality: number, edge = false) {
    if (edge) {
      tone(2400, 0.05, 0.22, 'triangle', 0.8)
      noise(0.03, 0.35, 3200, 'highpass')
      return
    }
    const f = 1050 + quality * 500
    tone(f, 0.06 + quality * 0.06, 0.32 + quality * 0.3, 'sine', 0.92)
    tone(f * 2.76, 0.035, 0.12 * quality, 'sine')
    tone(210, 0.09, 0.22 + quality * 0.18, 'sine', 0.7)
    noise(0.025, 0.5 + quality * 0.4, 2600, 'bandpass', 1.5)
  },
  /** Ball into the pitch: a dull thud, heavier for quicker bowling. */
  pitch(pace = 1) {
    noise(0.06, 0.25 + 0.2 * pace, 420 + 200 * pace, 'lowpass')
    tone(110 + 40 * pace, 0.07, 0.16 + 0.1 * pace, 'sine', 0.6)
  },
  /** Ball into gloves or hands: a leathery pop. */
  gloves(soft = false) {
    noise(0.045, soft ? 0.3 : 0.5, soft ? 1000 : 1500, 'bandpass', 2)
    tone(soft ? 240 : 320, 0.05, 0.14, 'sine', 0.7)
  },
  /** Stumps flattened: hollow wood knocks, then the bails rattling away. */
  stumps() {
    tone(1500, 0.09, 0.22, 'triangle', 0.75)
    tone(980, 0.12, 0.2, 'triangle', 0.7)
    noise(0.05, 0.5, 2200, 'bandpass', 3)
    if (muted) return
    setTimeout(() => tone(2100, 0.05, 0.12, 'triangle', 0.9), 70)
    setTimeout(() => tone(1800, 0.04, 0.08, 'triangle', 0.9), 150)
  },
  /** A footfall on turf. */
  step(weight = 0.5) {
    noise(0.035, 0.08 + 0.12 * weight, 260, 'lowpass')
  },
  /** The crowd roars; bigger for a six or a wicket. */
  cheer(big: boolean) {
    swell(big ? 3.2 : 2.2, big ? 0.7 : 0.45, 650, big ? 1050 : 900, 0.6, 0.18)
    applause(big ? 3.5 : 2.6, big ? 0.35 : 0.25)
  },
  /** "Oooh": the batter is beaten, or an edge drops short. */
  ooh() {
    swell(1.4, 0.32, 420, 620, 1.2, 0.2)
  },
  /** Polite applause: a single, a good leave, a dot ball well bowled. */
  clap(level = 0.5) {
    applause(1.6, 0.1 + 0.12 * level)
  },
  groan() {
    swell(1.3, 0.3, 520, 340, 1.0, 0.15)
  },
  click() {
    tone(660, 0.05, 0.12, 'triangle')
  },
  whoosh() {
    noise(0.25, 0.2, 900, 'highpass')
  },
  /** Stadium drum roll for a boundary. */
  drums(beats = 6) {
    if (muted) return
    for (let i = 0; i < beats; i++) setTimeout(() => tone(i % 2 ? 140 : 95, 0.18, 0.35, 'sine', 0.5), i * 140)
  },
  /** Air horn for a six. */
  horn() {
    tone(330, 0.7, 0.12, 'sawtooth', 1.02)
    tone(415, 0.7, 0.08, 'sawtooth', 1.02)
  },
  /** Bat-on-ground thud as the batters complete a run. */
  run() {
    noise(0.04, 0.2, 400, 'lowpass')
  },
}

// ----------------------------------------------------------------------------- crowd ambience

let crowd: { src: AudioBufferSourceNode; gain: GainNode } | null = null

/** Continuous murmur of the crowd. `level` 0..1 swells it (e.g. as a big hit flies). */
export function crowdAmbience(on: boolean, level = 0.12) {
  if (!on || muted) {
    if (crowd) {
      const c = crowd
      crowd = null
      try {
        c.gain.gain.setTargetAtTime(0, c.gain.context.currentTime, 0.4)
        setTimeout(() => c.src.stop(), 1500)
      } catch {
        /* already stopped */
      }
    }
    return
  }
  const a = ac()
  if (!crowd) {
    const len = a.sampleRate * 3
    const buf = a.createBuffer(2, len, a.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let last = 0
      for (let i = 0; i < len; i++) {
        // brown-ish noise with slow swells sounds like a distant crowd
        last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02
        d[i] = last * 3.5 * (0.75 + 0.25 * Math.sin((i / len) * Math.PI * 6 + ch))
      }
    }
    const src = a.createBufferSource()
    src.buffer = buf
    src.loop = true
    const f = a.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 700
    f.Q.value = 0.5
    const gain = a.createGain()
    gain.gain.value = 0
    src.connect(f).connect(gain).connect(a.destination)
    src.start()
    crowd = { src, gain }
  }
  crowd.gain.gain.setTargetAtTime(level, a.currentTime, 0.5)
}
