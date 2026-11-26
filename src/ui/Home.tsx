import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../net/host'
import type { GameMode, MatchSettings } from '../game/types'
import { defaultWickets } from '../game/rules'
import { career, clearHistory, loadHistory } from './history'
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
  const [side, setSide] = useState(1)
  const [tab, setTab] = useState<'play' | 'how' | 'stats'>('play')

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
            {(['play', 'stats', 'how'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${tab === t ? 'bg-white text-ink' : 'text-white/70'}`}
              >
                {t === 'play' ? 'Play' : t === 'stats' ? 'My stats' : 'How to play'}
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
                    onClick={() => go({ kind: 'practice', settings: { ...DEFAULT_SETTINGS, mode: `${side}v${side}` as GameMode, wickets: defaultWickets(side), overs, teamNames: { A: name.trim() || 'You', B: 'Bots' } } })}
                  >
                    Play
                  </button>
                </div>
                <div className="flex gap-1 mt-3">
                  {[1, 2, 3, 5, 10, 20].map((o) => (
                    <button
                      key={o}
                      onClick={() => setOvers(o)}
                      className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${overs === o ? 'bg-gold text-ink' : 'bg-white/5 text-white/70'}`}
                    >
                      {o} ov
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 mt-1.5">
                  {[1, 2, 3, 5, 11].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSide(n)}
                      className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${side === n ? 'bg-tide text-white' : 'bg-white/5 text-white/70'}`}
                    >
                      {n}v{n}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : tab === 'stats' ? (
            <Stats />
          ) : (
            <HowTo />
          )}
        </div>
        <p className="mt-6 text-xs text-white/40 text-center max-w-sm">
          Rooms are private: only friends with your code can join. Anything from 1v1 to 11v11, 1 to 30 overs.
        </p>
      </div>
    </div>
  )
}

function Stats() {
  const [list, setList] = useState(loadHistory)
  const c = career(list)
  const tiles: [string, string][] = [
    ['Matches', String(c.matches)],
    ['Won', String(c.wins)],
    ['Win %', c.matches ? `${Math.round((c.wins / c.matches) * 100)}%` : '-'],
    ['Runs', String(c.runs)],
    ['Best', String(c.best)],
    ['Strike rate', c.balls ? ((c.runs / c.balls) * 100).toFixed(0) : '-'],
    ['Wickets', String(c.wickets)],
    ['Economy', c.bowled ? ((c.conceded / c.bowled) * 6).toFixed(1) : '-'],
    ['Avg score', c.matches ? (c.runs / c.matches).toFixed(1) : '-'],
  ]
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([k, val]) => (
          <div key={k} className="rounded-xl bg-black/25 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-white/45">{k}</div>
            <div className="font-display text-3xl leading-none mt-0.5">{val}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-white/55">Recent matches</div>
        {list.length > 0 && (
          <button
            className="text-xs text-white/40 underline"
            onClick={() => {
              clearHistory()
              setList([])
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="mt-2 space-y-2 max-h-72 overflow-y-auto pr-1">
        {list.length === 0 && <div className="text-sm text-white/45 rounded-xl bg-black/20 p-4 text-center">No matches yet. Play one and it shows up here.</div>}
        {list.map((r) => (
          <div key={r.at} className="rounded-xl bg-black/25 px-3 py-2">
            <div className="flex justify-between text-[11px] text-white/45">
              <span>
                {new Date(r.at).toLocaleDateString()} · {r.mode === 'team' ? 'Teams' : r.mode} · {r.overs} ov
              </span>
              {r.me?.won === true && <span className="text-emerald-300 font-semibold">WON</span>}
              {r.me?.won === false && <span className="text-red-300 font-semibold">LOST</span>}
            </div>
            <div className="text-sm font-semibold mt-0.5">{r.result}</div>
            <div className="text-[11px] text-white/55">{r.scores.join('  ·  ')}</div>
            {r.me && (
              <div className="text-[11px] text-gold/90 mt-0.5">
                You: {r.me.runs} ({r.me.balls}) · {r.me.wickets}/{r.me.conceded}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/35">Stats are saved in this browser only.</p>
    </div>
  )
}

function HowTo() {
  const rows = [
    ['🏏', 'Batting', 'Watch the yellow ring where the ball pitches. Tap/press the moment the ball reaches you. Tap left, middle or right of the batter to pick the direction. Turn on LOFT to go aerial: more sixes, more risk.'],
    ['📱', 'Touch', 'Tap to hit, or swipe: the swipe direction aims the shot and swiping up lofts it. Tap during a replay to skip it.'],
    ['⏱️', 'Timing', 'PERFECT timing middles it. Early pulls it to the leg side, late steers it to the off side. Way off and you miss.'],
    ['🎯', 'Bowling', 'Pick a delivery (pace, swing, seam, spin, yorker, bouncer, slower) and a field (attack, balanced, defend), drag the target on the pitch, then stop the power meter in the green. A rushed red-zone release can be a no-ball, and the next ball is a free hit.'],
    ['⌨️', 'Keyboard', 'Batting: ← ↑ → to hit, hold Shift (or L) to loft. Bowling: Space to bowl.'],
    ['👥', 'Rooms', 'Create a room, share the code, pick 1v1 up to 11v11 and 1–30 overs. Fill empty spots with bots. Lock the room so nobody can barge into a running match.'],
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
