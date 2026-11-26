import { useEffect, useRef } from 'react'
import { timingWindows } from '../game/physics'
import type { Delivery, ShotInput } from '../game/types'

interface Probe {
  timingProbe(now?: number): { t: number; tContact: number; d: Delivery; shot: ShotInput | null } | null
}

const RANGE = 420 // ms shown either side of the contact moment

/**
 * Arcade-style timing bar for batting: a marker slides toward the centre and crosses it
 * exactly when the ball reaches the bat. Hit while it's in the green.
 */
export function TimingBar({ scene }: { scene: () => Probe | null }) {
  const wrap = useRef<HTMLDivElement>(null)
  const marker = useRef<HTMLDivElement>(null)
  const zones = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let frozenAt: number | null = null
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const pr = scene()?.timingProbe()
      const el = wrap.current
      if (!el || !marker.current || !zones.current) return
      if (!pr) {
        el.style.opacity = '0'
        frozenAt = null
        return
      }
      el.style.opacity = '1'
      const w = timingWindows(pr.d)
      const pct = (ms: number) => (ms / RANGE) * 50
      zones.current.style.setProperty('--ok', `${pct(w.ok)}%`)
      zones.current.style.setProperty('--good', `${pct(w.good)}%`)
      zones.current.style.setProperty('--perfect', `${pct(w.perfect)}%`)
      if (pr.shot && frozenAt === null) frozenAt = pr.shot.swung ? pr.shot.timing : RANGE
      const ms = frozenAt ?? (pr.t - pr.tContact) * 1000
      const x = 50 + Math.max(-50, Math.min(50, pct(ms)))
      marker.current.style.left = `${x}%`
      const a = Math.abs(ms)
      marker.current.style.background = frozenAt === null ? '#ffffff' : a <= w.perfect ? '#34d399' : a <= w.good ? '#bef264' : a <= w.ok ? '#fdba74' : '#f87171'
      marker.current.style.transform = `translateX(-50%) scale(${frozenAt === null ? 1 : 1.35})`
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [scene])

  return (
    <div ref={wrap} className="flex-1 max-w-[340px] mr-3 mb-1 transition-opacity duration-150" style={{ opacity: 0 }}>
      <div ref={zones} className="relative h-4 rounded-full bg-black/55 border border-white/20 overflow-hidden">
        <div className="absolute inset-y-0 bg-orange-400/35" style={{ left: 'calc(50% - var(--ok, 15%))', right: 'calc(50% - var(--ok, 15%))' }} />
        <div className="absolute inset-y-0 bg-lime-300/55" style={{ left: 'calc(50% - var(--good, 8%))', right: 'calc(50% - var(--good, 8%))' }} />
        <div className="absolute inset-y-0 bg-emerald-400" style={{ left: 'calc(50% - var(--perfect, 4%))', right: 'calc(50% - var(--perfect, 4%))' }} />
      </div>
      <div ref={marker} className="relative -mt-[22px] h-7 w-2 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)]" style={{ left: '0%', transform: 'translateX(-50%)' }} />
      <div className="text-center text-[10px] font-semibold tracking-[0.3em] text-white/60 mt-1">HIT IN THE GREEN</div>
    </div>
  )
}
