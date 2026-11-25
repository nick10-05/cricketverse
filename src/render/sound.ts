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
}
