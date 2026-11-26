import { useEffect, useRef, useState } from 'react'
import { crowdAmbience, getVolumes, isMuted, setMuted, setVolume, sfx, type Bus } from '../render/sound'

const ROWS: { bus: Bus; label: string }[] = [
  { bus: 'ambience', label: 'Ambience' },
  { bus: 'crowd', label: 'Crowd' },
  { bus: 'sfx', label: 'Effects' },
]

/** Sound button: tap to open mute plus separate volume sliders for ambience, crowd and effects. */
export function SoundPanel() {
  const [open, setOpen] = useState(false)
  const [muted, setMutedState] = useState(isMuted())
  const [vol, setVol] = useState(getVolumes())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const toggleMute = () => {
    const m = !muted
    setMuted(m)
    setMutedState(m)
    if (!m) {
      sfx.unlock()
      crowdAmbience(true)
    }
  }

  return (
    <div ref={ref} className="relative h-full">
      <button
        className="h-full w-10 sm:w-auto sm:aspect-square shrink-0 rounded-2xl bg-black/60 border border-white/10 text-base sm:text-lg"
        onClick={() => {
          sfx.unlock()
          setOpen(!open)
        }}
        title="Sound"
        aria-label="Sound settings"
        aria-expanded={open}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl bg-black/85 border border-white/10 p-3 shadow-xl backdrop-blur text-xs">
          <button
            className={`w-full mb-3 rounded-xl px-3 py-2 font-bold uppercase tracking-wider ${muted ? 'bg-white/10 text-white/70' : 'bg-emerald-500/20 text-emerald-300'}`}
            onClick={toggleMute}
          >
            {muted ? 'Sound off · tap to turn on' : 'Sound on'}
          </button>
          {ROWS.map(({ bus, label }) => (
            <label key={bus} className={`block mb-2 last:mb-0 ${muted ? 'opacity-40' : ''}`}>
              <span className="flex justify-between text-white/70 mb-1">
                <span>{label}</span>
                <span className="tabular-nums">{Math.round(vol[bus] * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(vol[bus] * 100)}
                disabled={muted}
                aria-label={`${label} volume`}
                className="w-full accent-emerald-400"
                onChange={(e) => {
                  const v = Number(e.target.value) / 100
                  setVolume(bus, v)
                  setVol((prev) => ({ ...prev, [bus]: v }))
                }}
                onPointerUp={() => {
                  if (bus === 'sfx') sfx.bat(0.8)
                  else if (bus === 'crowd') sfx.clap(0.5)
                }}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
