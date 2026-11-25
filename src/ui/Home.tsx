import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../net/host'
import type { MatchSettings } from '../game/types'
import { Scene } from '../render/scene'

type Action = { kind: 'create' } | { kind: 'join'; code: string } | { kind: 'practice'; settings: MatchSettings }

function savedName() {
  try {
    return localStorage.getItem('cvx-name') ?? ''
  } catch {
    return ''
  }
}

export function Home({ inviteCode, onStart }: { inviteCode: string; onStart: (name: string, a: Action) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [name, setName] = useState(savedName)
  const [code, setCode] = useState(inviteCode)
  const [overs, setOvers] = useState(2)
  const [tab, setTab] = useState<'play' | 'how'>('play')

  useEffect(() => {
    const s = new Scene(canvasRef.current!)
    s.cam.zoom = 1.2
    return () => s.destroy()
  }, [])

  const go = (a: Action) => {
    const n = name.trim() || 'Player'
    try {
      localStorage.setItem('cvx-name', n)
    } catch {
      /* ignore */
    }
    onStart(n, a)
  }

  const validCode = /^[A-Z0-9]{5}$/.test(code.trim().toUpperCase())

  return (
    <div className="relative min-h-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/40 to-ink/95" />
      <div className="relative z-10 min-h-full flex flex-col items-center px-4 py-8 sm:py-12">
        <header className="text-center animate-rise">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs tracking-[0.25em] text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> PLAY WITH FRIENDS
          </div>
          <h1 className="font-display text-[64px] sm:text-[96px] leading-[0.85] mt-4 tracking-wide text-stroke">
            CRICKET<span className="text-gold">VERSE</span>
          </h1>
          <div className="font-display text-2xl sm:text-3xl tracking-[0.5em] text-white/85 -mt-1">ARENA</div>
        </header>

        <div className="w-full max-w-md mt-8 glass rounded-3xl p-5 sm:p-6 animate-rise" style={{ animationDelay: '80ms' }}>
          <div className="flex gap-1 p-1 rounded-2xl bg-black/30 mb-5">
            {(['play', 'how'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${tab === t ? 'bg-white text-ink' : 'text-white/70'}`}
              >
                {t === 'play' ? 'Play' : 'How to play'}
              </button>
            ))}
          </div>

          {tab === 'play' ? (
            <>
              <label className="text-xs uppercase tracking-widest text-white/60">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 16))}
                placeholder="Enter your name"
                className="mt-1 w-full rounded-xl bg-black/35 border border-white/10 px-4 py-3 text-lg outline-none focus:border-gold"
              />

              <button className="btn-primary mt-5 w-full rounded-2xl py-4 font-display text-3xl tracking-wider" onClick={() => go({ kind: 'create' })}>
                Create room
              </button>

              <div className="flex items-center gap-3 my-5 text-white/40 text-xs">
                <div className="h-px flex-1 bg-white/15" /> OR JOIN A FRIEND <div className="h-px flex-1 bg-white/15" />
              </div>

              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                  placeholder="ROOM CODE"
                  className="min-w-0 flex-1 rounded-xl bg-black/35 border border-white/10 px-4 py-3 font-display text-3xl tracking-[0.3em] text-center outline-none focus:border-gold"
                  onKeyDown={(e) => e.key === 'Enter' && validCode && go({ kind: 'join', code })}
                />
                <button
                  disabled={!validCode}
                  onClick={() => go({ kind: 'join', code })}
                  className="rounded-xl px-5 font-bold bg-tide disabled:opacity-40 shadow-[0_5px_0_#075a9c] active:translate-y-1 active:shadow-none transition"
                >
                  Join
                </button>
              </div>

              <div className="mt-6 rounded-2xl bg-black/25 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Practice vs Bot</div>
                    <div className="text-xs text-white/55">Warm up offline before facing friends</div>
                  </div>
                  <button
                    className="btn-ghost rounded-xl px-4 py-2 text-sm font-semibold"
                    onClick={() => go({ kind: 'practice', settings: { ...DEFAULT_SETTINGS, overs, teamNames: { A: name.trim() || 'You', B: 'Bots' } } })}
                  >
                    Play
                  </button>
                </div>
                <div className="flex gap-1 mt-3">
                  {[1, 2, 3, 5].map((o) => (
                    <button
                      key={o}
                      onClick={() => setOvers(o)}
                      className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${overs === o ? 'bg-gold text-ink' : 'bg-white/5 text-white/70'}`}
                    >
                      {o} over{o > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <HowTo />
          )}
        </div>
        <p className="mt-6 text-xs text-white/40 text-center max-w-sm">
          Rooms are private and peer-to-peer: only friends with your code can join. 1v1 up to 5v5, or split any number of players into two teams.
        </p>
      </div>
    </div>
  )
}

function HowTo() {
  const rows = [
    ['🏏', 'Batting', 'Watch the yellow ring where the ball pitches. Tap/press the moment the ball reaches you. Tap left, middle or right of the batter to pick the direction. Turn on LOFT to go aerial: more sixes, more risk.'],
    ['⏱️', 'Timing', 'PERFECT timing middles it. Early pulls it to the leg side, late steers it to the off side. Way off and you miss.'],
    ['🎯', 'Bowling', 'Pick a delivery, drag the target on the pitch, then stop the power meter in the green zone for an accurate, quicker ball.'],
    ['⌨️', 'Keyboard', 'Batting: ← ↑ → to hit, hold Shift (or L) to loft. Bowling: Space to bowl.'],
    ['👥', 'Rooms', 'Create a room, share the code, choose 1–10 overs and 1v1, 2v2, 3v3… or Teams. Fill empty spots with bots.'],
  ]
  return (
    <div className="space-y-3">
      {rows.map(([icon, title, body]) => (
        <div key={title} className="flex gap-3 rounded-2xl bg-black/25 p-3">
          <div className="text-2xl">{icon}</div>
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-sm text-white/65 leading-snug">{body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
