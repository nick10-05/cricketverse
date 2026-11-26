import { useEffect, useRef, useState } from 'react'

/**
 * Runs/wickets that tick up instead of jumping, with a gold pulse on a boundary and a red flash
 * when a wicket falls.
 */
export function ScoreTicker({ runs, wickets }: { runs: number; wickets: number }) {
  const [shown, setShown] = useState(runs)
  const [fx, setFx] = useState<{ kind: 'boundary' | 'wicket'; key: number } | null>(null)
  const prev = useRef({ runs, wickets })

  useEffect(() => {
    const from = prev.current
    prev.current = { runs, wickets }
    if (wickets > from.wickets) setFx({ kind: 'wicket', key: Date.now() })
    else if (runs - from.runs >= 4) setFx({ kind: 'boundary', key: Date.now() })
    // a new innings (or a resync) goes straight to the value
    if (runs < from.runs || runs - from.runs > 12) {
      setShown(runs)
      return
    }
    const start = performance.now()
    const dur = 180 + 70 * (runs - from.runs)
    let raf = 0
    const step = () => {
      const u = Math.min(1, (performance.now() - start) / dur)
      setShown(Math.round(from.runs + (runs - from.runs) * u))
      if (u < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [runs, wickets])

  return (
    <div key={fx?.key} className={`font-display text-3xl sm:text-4xl leading-none rounded-lg px-1 -mx-1 ${fx?.kind === 'boundary' ? 'score-pulse' : fx?.kind === 'wicket' ? 'score-flash' : ''}`}>
      {shown}
      <span className="text-white/60">/{wickets}</span>
    </div>
  )
}
