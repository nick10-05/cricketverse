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
  bat(quality: number) {
    noise(0.09, 0.9 * quality + 0.2, 1800 + quality * 1400, 'bandpass', 2)
    tone(520 + quality * 300, 0.08, 0.25, 'triangle', 0.6)
  },
  bounce() {
    noise(0.05, 0.25, 600, 'lowpass')
  },
  stumps() {
    tone(900, 0.15, 0.25, 'square', 0.5)
    noise(0.2, 0.6, 2500)
  },
  cheer(big: boolean) {
    noise(big ? 2.4 : 1.4, big ? 0.55 : 0.35, 1100, 'bandpass', 0.4)
  },
  groan() {
    noise(1.2, 0.3, 450, 'lowpass')
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
