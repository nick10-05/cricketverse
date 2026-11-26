import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent, RoomClient, RoomSnapshot } from '../net/client'
import type { BallOutcome, Delivery, DeliveryType, FieldSetting, MatchState, ShotInput, TeamId } from '../game/types'
import { CREASE_Z, DELIVERY_INFO, randomSeed, resolveBall } from '../game/physics'
import { applyFreeHit, bowlerQuota, nonStrikerOf, other, oversText, requiredRate } from '../game/rules'
import { Scene, TEAM_COLORS } from '../render/scene'
import { detectQuality, Scene3D, type Quality } from '../render3d/Scene3D'
import { recordMatch } from './history'
import { crowdAmbience, isMuted, setMuted, sfx } from '../render/sound'
import { QuickChat, Toast } from './bits'
import { Scorecard } from './Scorecard'
import { TimingBar } from './TimingBar'

type Job = () => void
type AnyScene = Scene | Scene3D
const QUALITIES: (Quality | '2d')[] = ['high', 'medium', 'low', '2d']
const FIELD_LABEL: Record<FieldSetting, string> = { attacking: 'Attack', balanced: 'Balanced', defensive: 'Defend' }

const LEN_MIN = CREASE_Z - 0.35
const LEN_RANGE = 8.6

export function GameScreen({ client, snap, onLeave }: { client: RoomClient; snap: RoomSnapshot; onLeave: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<AnyScene | null>(null)
  const [quality, setQuality] = useState<Quality | '2d'>(() => detectQuality())
  const [replaying, setReplaying] = useState(false)
  const live = useRef<{ ballId: number; delivery: Delivery; sent: boolean } | null>(null)
  const queue = useRef<Job[]>([])
  const myBalls = useRef(new Set<number>())
  const hostReplays = useRef(new Map<number, Extract<GameEvent, { t: 'replay' }>>())
  const [frozen, setFrozen] = useState<MatchState | null>(null)
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState<{ text: string; kind: 'six' | 'four' | 'out' | 'runs' | 'dot'; key: number } | null>(null)
  const [grade, setGrade] = useState<{ text: string; key: number } | null>(null)
  const [loft, setLoft] = useState(false)
  const loftRef = useRef(false)
  const [muted, setMutedState] = useState(isMuted())
  const [liveBatting, setLiveBatting] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const match = snap.match!
  const shown = frozen ?? match
  const inn = shown.innings[shown.current]
  const myId = snap.myId
  const names = shown.names

  // ------------------------------------------------------------- scene
  useEffect(() => {
    let s: AnyScene
    try {
      s = quality === '2d' ? new Scene(canvasRef.current!) : new Scene3D(canvasRef.current!, quality)
    } catch {
      s = new Scene(canvasRef.current!) // WebGL unavailable: fall back to the 2D renderer
    }
    if (s instanceof Scene3D) s.onReplay = setReplaying
    sceneRef.current = s
    s.batting = inn.batting
    s.bowling = other(inn.batting)
    if (import.meta.env.DEV) (window as unknown as { __scene: AnyScene }).__scene = s
    return () => s.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality])

  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.batting = inn.batting
    s.bowling = other(inn.batting)
  }, [inn.batting])

  // Hide the non-striker when the batter is batting alone (1-player side / last man stands).
  const hasPartner = inn.nonStriker >= 0
  useEffect(() => {
    const s = sceneRef.current
    if (s instanceof Scene3D) s.partner = hasPartner
  }, [hasPartner, quality])

  // Crowd murmur while the match screen is open.
  useEffect(() => {
    const start = () => crowdAmbience(true)
    window.addEventListener('pointerdown', start, { once: true })
    window.addEventListener('keydown', start, { once: true })
    if (!isMuted()) crowdAmbience(true)
    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
      crowdAmbience(false)
    }
  }, [])

  // Live score on the stadium's big screen.
  useEffect(() => {
    const s = sceneRef.current
    if (!(s instanceof Scene3D)) return
    const r = requiredRate(inn, shown.settings.overs)
    s.setScoreboard(`${inn.runs}/${inn.wickets}`, r ? `NEED ${Math.max(0, r.need)} OFF ${r.balls}` : `${shown.settings.teamNames[inn.batting].toUpperCase()} · ${oversText(inn.balls)} OV`, TEAM_COLORS[inn.batting].main)
  }, [inn, shown.settings, quality])

  // Save finished matches to the local history.
  useEffect(() => {
    if (match.phase === 'done' && match.result) recordMatch(match, myId)
  }, [match, myId])

  // ------------------------------------------------------------- playback queue
  const runNext = useCallback(() => {
    const s = sceneRef.current
    if (!s || s.isBusy()) return
    const job = queue.current.shift()
    if (!job) {
      setBusy(false)
      setFrozen(null)
      setLiveBatting(false)
      return
    }
    job()
  }, [])

  const enqueue = useCallback(
    (job: Job) => {
      if (!sceneRef.current?.isBusy() && queue.current.length === 0) {
        setFrozen(client.snap.match)
        setBusy(true)
      }
      queue.current.push(job)
      runNext()
    },
    [client, runNext],
  )

  const onContact = useCallback((o: BallOutcome) => {
    setLiveBatting(false)
    sfx.bat(o.grade === 'perfect' ? 1 : o.grade === 'good' ? 0.7 : 0.35)
    const g = o.edged ? 'EDGE!' : o.grade === 'perfect' ? 'PERFECT' : o.grade === 'good' ? 'GOOD' : o.grade === 'early' ? 'EARLY' : o.grade === 'late' ? 'LATE' : ''
    if (g) setGrade({ text: g, key: Date.now() })
  }, [])

  const onResult = useCallback((o: BallOutcome) => {
    const kind = o.boundary === 6 ? 'six' : o.boundary === 4 ? 'four' : o.wicket ? 'out' : o.runs > 0 ? 'runs' : 'dot'
    setLabel({ text: o.label, kind, key: Date.now() })
    if (o.boundary) {
      sfx.cheer(o.boundary === 6)
      sfx.drums(o.boundary === 6 ? 10 : 6)
      if (o.boundary === 6) sfx.horn()
      crowdAmbience(true, 0.3)
      setTimeout(() => crowdAmbience(true, 0.12), 3000)
    }
    else if (o.wicket) {
      if (o.wicket === 'bowled' || o.wicket === 'stumped' || o.wicket === 'run out') sfx.stumps()
      sfx.cheer(false)
    } else if (!o.path.length && o.grade !== 'none') sfx.whoosh()
    if (!o.path.length && o.grade === 'miss') setGrade({ text: 'MISSED', key: Date.now() })
  }, [])

  const onDone = useCallback(() => {
    setLabel(null)
    setGrade(null)
    runNext()
  }, [runNext])

  const finishLive = useCallback(
    (shot: ShotInput) => {
      const L = live.current
      const s = sceneRef.current
      if (!L || L.sent || !s) return
      L.sent = true
      const m = client.snap.match
      const o = m ? applyFreeHit(m, resolveBall(L.delivery, shot)) : resolveBall(L.delivery, shot)
      s.setOutcome(o)
      client.send({ t: 'shot', ballId: L.ballId, shot })
    },
    [client],
  )

  useEffect(
    () =>
      client.onEvent((e) => {
        if (e.t === 'ball') {
          if (e.striker !== client.snap.myId) return
          myBalls.current.add(e.ballId)
          enqueue(() => {
            // The host already settled this ball (e.g. we were in the background): show its result.
            const settled = hostReplays.current.get(e.ballId)
            if (settled) {
              live.current = { ballId: e.ballId, delivery: e.delivery, sent: true }
              sceneRef.current!.playDelivery({ delivery: settled.delivery, live: false, shot: settled.shot, outcome: settled.outcome, onContact, onResult, onDone })
              return
            }
            live.current = { ballId: e.ballId, delivery: e.delivery, sent: false }
            setLiveBatting(true)
            sceneRef.current!.playDelivery({
              delivery: e.delivery,
              live: true,
              onNoSwing: () => finishLive({ swung: false, dir: 0, loft: false, timing: 0 }),
              onContact,
              onResult: (o) => {
                setLiveBatting(false)
                onResult(o)
              },
              onDone,
            })
          })
        } else {
          if (myBalls.current.has(e.ballId)) {
            hostReplays.current.set(e.ballId, e)
            const L = live.current
            // Host timed out before our swing arrived: its result is authoritative.
            if (L?.ballId === e.ballId && !L.sent) {
              L.sent = true
              sceneRef.current?.forceOutcome(e.shot, e.outcome)
            }
            return
          }
          enqueue(() => {
            sceneRef.current!.playDelivery({ delivery: e.delivery, live: false, shot: e.shot, outcome: e.outcome, onContact, onResult, onDone })
          })
        }
      }),
    [client, enqueue, finishLive, onContact, onResult, onDone],
  )

  // ------------------------------------------------------------- roles
  const idle = !busy && !frozen
  const myBowl = idle && match.phase === 'playing' && match.turn?.stage === 'bowl' && match.turn.bowler === myId
  const iAmStriker = match.turn?.striker === myId && match.phase === 'playing'

  // ------------------------------------------------------------- bowling
  const [dtype, setDtype] = useState<DeliveryType>('fast')
  const [field, setField] = useState<FieldSetting>('balanced')
  useEffect(() => {
    const s = sceneRef.current
    if (s instanceof Scene3D && !s.isBusy()) s.field = field
  }, [field, quality])
  const [turnDir, setTurnDir] = useState<1 | -1>(1)
  const meterRef = useRef<HTMLDivElement>(null)
  const meterVal = useRef(0)
  const [bowledFor, setBowledFor] = useState(-1)
  const canBowl = myBowl && bowledFor !== match.ballId

  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.showZones = canBowl
    if (canBowl && !s.aim) s.aim = { x: 0.15, z: LEN_MIN - 0.45 * LEN_RANGE }
    if (!canBowl) s.aim = null
  }, [canBowl])

  useEffect(() => {
    if (!canBowl) return
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const ph = ((performance.now() - t0) / 1100) % 2
      const v = ph < 1 ? ph : 2 - ph
      meterVal.current = v
      if (meterRef.current) meterRef.current.style.left = `${v * 100}%`
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [canBowl])

  const bowl = useCallback(() => {
    const s = sceneRef.current
    if (!s || !canBowl || !s.aim) return
    const v = meterVal.current
    const power = Math.max(0, 1 - Math.abs(v - 0.5) * 2.2)
    const delivery: Delivery = {
      type: dtype,
      line: Math.max(-1.3, Math.min(1.3, s.aim.x)),
      length: Math.max(0, Math.min(1, (LEN_MIN - s.aim.z) / LEN_RANGE)),
      power,
      turn: turnDir,
      seed: randomSeed(),
      field,
    }
    sfx.click()
    setBowledFor(match.ballId)
    client.send({ t: 'bowl', delivery })
  }, [canBowl, dtype, turnDir, client, match.ballId, field])

  // ------------------------------------------------------------- input
  const dragging = useRef(false)
  const aimAt = (clientX: number, clientY: number) => {
    const s = sceneRef.current!
    const r = canvasRef.current!.getBoundingClientRect()
    const g = s.groundAt(clientX - r.left, clientY - r.top)
    if (!g) return
    s.aim = { x: Math.max(-1.3, Math.min(1.3, g.x)), z: Math.max(LEN_MIN - LEN_RANGE, Math.min(LEN_MIN, g.z)) }
  }

  const getScene = useCallback(() => sceneRef.current, [])

  const doSwing = useCallback(
    (dir: number, lofted: boolean, at?: number) => {
      const s = sceneRef.current
      if (!s) return
      const shot = s.swing(dir, lofted, at)
      if (shot) finishLive(shot)
    },
    [finishLive],
  )

  // Touch batting: a tap swings at once; a swipe picks the direction (and up = lofted).
  // The swing is timed from the moment the finger went down.
  const press = useRef<{ x: number; y: number; at: number; tapDir: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const releasePress = (x: number, y: number) => {
    const pr = press.current
    if (!pr) return
    press.current = null
    clearTimeout(pr.timer)
    const dx = x - pr.x
    const dy = y - pr.y
    if (Math.hypot(dx, dy) > 34) doSwing(Math.max(-1, Math.min(1, dx / 110)), dy < -30 || loftRef.current, pr.at)
    else doSwing(pr.tapDir, loftRef.current, pr.at)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    sfx.unlock()
    const s = sceneRef.current
    if (!s) return
    if (canBowl) {
      dragging.current = true
      aimAt(e.clientX, e.clientY)
      return
    }
    if (replaying && s instanceof Scene3D) {
      s.skipReplay()
      return
    }
    if (liveBatting) {
      const r = canvasRef.current!.getBoundingClientRect()
      const bs = s.batterScreen()
      const bx = bs ? bs.x : r.width / 2
      const dir = Math.max(-1, Math.min(1, (e.clientX - r.left - bx) / (r.width * 0.26)))
      const at = performance.now()
      if (press.current) clearTimeout(press.current.timer)
      const ex = e.clientX
      const ey = e.clientY
      press.current = { x: ex, y: ey, at, tapDir: dir, timer: setTimeout(() => releasePress(ex, ey), 120) }
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      if (k === 'l') {
        loftRef.current = !loftRef.current
        setLoft(loftRef.current)
        return
      }
      if (canBowl && (k === ' ' || k === 'enter')) {
        e.preventDefault()
        bowl()
        return
      }
      if (!liveBatting) return
      const lofted = loftRef.current || e.shiftKey
      if (k === 'arrowleft' || k === 'a') doSwing(-0.75, lofted)
      else if (k === 'arrowright' || k === 'd') doSwing(0.75, lofted)
      else if (k === 'arrowup' || k === 'w' || k === ' ') {
        e.preventDefault()
        doSwing(0, lofted)
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [canBowl, bowl, liveBatting, doSwing])

  // ------------------------------------------------------------- toss banner
  const fresh = match.ballId === 0 && match.current === 0 && match.phase === 'playing'
  const [tossSeen, setTossSeen] = useState(0)
  const showToss = fresh && tossSeen !== match.startedAt
  useEffect(() => {
    if (!fresh) return
    const id = match.startedAt
    const t = setTimeout(() => setTossSeen(id), 3800)
    return () => clearTimeout(t)
  }, [fresh, match.startedAt])

  // ------------------------------------------------------------- render
  const batCol = TEAM_COLORS[inn.batting]
  const bowlTeam = other(inn.batting)
  const striker = shown.turn?.striker ?? null
  const bowler = shown.turn?.bowler ?? null
  const sStat = striker ? inn.batters[striker] : undefined
  const nonStriker = nonStrikerOf(shown, inn)
  const nsStat = nonStriker ? inn.batters[nonStriker] : undefined
  const meP = snap.lobby?.players.find((p) => p.id === myId)
  const spectating = !!meP?.spectator || !(['A', 'B'] as TeamId[]).some((t) => match.teams[t].includes(myId))
  const quota = bowlerQuota(shown, bowlTeam)
  const bStat = bowler ? inn.bowlers[bowler] : undefined
  const rr = requiredRate(inn, shown.settings.overs)
  const waitingText =
    idle && match.phase === 'playing' && match.turn && !canBowl
      ? match.turn.stage === 'bowl'
        ? iAmStriker
          ? `Get ready… ${names[match.turn.bowler]} is bowling`
          : `${names[match.turn.bowler]} is choosing a delivery`
        : iAmStriker
          ? ''
          : `${names[match.turn.striker]} is facing…`
      : ''

  return (
    <div className="fixed inset-0 overflow-hidden select-none bg-ink touch-none" onPointerLeave={() => press.current && releasePress(press.current.x, press.current.y)}>
      <canvas key={quality} ref={canvasRef} className="absolute inset-0 w-full h-full" onPointerDown={onPointerDown} onPointerMove={(e) => dragging.current && canBowl && aimAt(e.clientX, e.clientY)} onPointerUp={(e) => {
          dragging.current = false
          releasePress(e.clientX, e.clientY)
        }} />
      <Toast text={snap.toast} />

      {/* Scoreboard */}
      <div className="absolute top-0 inset-x-0 p-2 sm:p-3 z-20 pointer-events-none">
        <div className="mx-auto max-w-3xl flex items-stretch gap-2">
          <div className="flex-1 rounded-2xl overflow-hidden flex shadow-xl" style={{ background: 'rgba(7,11,26,0.82)' }}>
            <div className="px-3 flex items-center font-display text-xl sm:text-2xl tracking-wide" style={{ background: `linear-gradient(120deg, ${batCol.main}, ${batCol.dark})` }}>
              {shown.settings.teamNames[inn.batting]}
            </div>
            <div className="px-3 py-1.5 flex items-center gap-3">
              <div className="font-display text-3xl sm:text-4xl leading-none">
                {inn.runs}
                <span className="text-white/60">/{inn.wickets}</span>
              </div>
              <div className="text-xs sm:text-sm text-white/70 leading-tight">
                <div>
                  Ov <b className="text-white">{oversText(inn.balls)}</b>/{shown.settings.overs}
                </div>
                {rr ? (
                  <div className="text-gold">
                    Need {Math.max(0, rr.need)} off {rr.balls}
                  </div>
                ) : (
                  <div>RR {inn.balls ? ((inn.runs / inn.balls) * 6).toFixed(1) : '0.0'}</div>
                )}
              </div>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-1 pr-3">
              {inn.thisOver.map((b, i) => (
                <BallChip key={i} v={b} />
              ))}
              {Array.from({ length: Math.max(0, 6 - inn.thisOver.filter((b) => !/Wd|Nb/.test(b)).length) }, (_, i) => (
                <div key={'e' + i} className="h-6 w-6 rounded-full border border-white/15" />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button
              className="h-full w-10 sm:w-auto sm:aspect-square shrink-0 rounded-2xl bg-black/60 border border-white/10 text-base sm:text-lg"
              onClick={() => {
                setMuted(!muted)
                setMutedState(!muted)
                if (muted) crowdAmbience(true)
              }}
              title="Sound"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              className="h-full shrink-0 rounded-2xl bg-black/60 border border-white/10 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider"
              onClick={() => {
                const next = QUALITIES[(QUALITIES.indexOf(quality) + 1) % QUALITIES.length]
                try {
                  localStorage.setItem('cvx-quality', next)
                } catch {
                  /* ignore */
                }
                setQuality(next)
              }}
              title="Graphics quality"
            >
              {quality === '2d' ? '2D' : quality === 'medium' ? 'MED' : quality}
            </button>
            <button className="h-full w-10 sm:w-auto sm:aspect-square shrink-0 rounded-2xl bg-black/60 border border-white/10 text-base sm:text-lg" onClick={() => setConfirmLeave(true)} title="Leave">
              ✕
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-3xl flex sm:hidden gap-1 mt-1.5">
          {inn.thisOver.map((b, i) => (
            <BallChip key={i} v={b} />
          ))}
        </div>
        <div className="mx-auto max-w-3xl mt-1.5 flex justify-between text-[11px] sm:text-xs text-white/85">
          {striker && (
            <div className="rounded-full bg-black/55 px-2.5 py-1">
              🏏 <b>{names[striker]}*</b> {sStat?.runs ?? 0}
              <span className="text-white/50">({sStat?.balls ?? 0})</span>
              {nonStriker && (
                <span className="text-white/60">
                  {' '}
                  · {names[nonStriker]} {nsStat?.runs ?? 0}
                  <span className="text-white/40">({nsStat?.balls ?? 0})</span>
                </span>
              )}
            </div>
          )}
          {inn.freeHit && <div className="rounded-full bg-gold text-ink font-bold px-2.5 py-1 animate-pulse">FREE HIT</div>}
          {bowler && (
            <div className="rounded-full bg-black/55 px-2.5 py-1" style={{ boxShadow: `inset 0 0 0 1px ${TEAM_COLORS[bowlTeam].main}55` }}>
              ⚾ <b>{names[bowler]}</b> {bStat?.wickets ?? 0}-{bStat?.runs ?? 0}
              <span className="text-white/50">
                {' '}
                ({oversText(bStat?.balls ?? 0)}/{quota})
              </span>
            </div>
          )}
        </div>
      </div>

      <QuickChat client={client} chat={snap.chat} />

      {replaying && (
        <div className="absolute top-28 right-3 z-20 pointer-events-none flex items-center gap-2 rounded-lg bg-red-600/90 px-3 py-1 font-display text-xl tracking-widest shadow-lg">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> REPLAY
          <span className="text-[10px] font-sans tracking-normal opacity-80">tap to skip</span>
        </div>
      )}
      {spectating && (
        <div className="absolute top-28 left-3 z-20 pointer-events-none rounded-lg bg-black/60 border border-white/10 px-3 py-1 text-xs font-semibold tracking-wider">
          👀 SPECTATING
        </div>
      )}

      {/* Result label */}
      {label && (
        <div key={label.key} className="absolute inset-x-0 top-[22%] z-20 text-center pointer-events-none animate-pop">
          <div
            className={`font-display text-stroke tracking-wider leading-none px-2 ${label.kind === 'six' ? 'text-gold' : label.kind === 'four' ? 'text-tide' : label.kind === 'out' ? 'text-red-500' : 'text-white'}`}
            style={{
              textShadow: '0 6px 30px rgba(0,0,0,0.6)',
              // big and punchy, but always fits on one line
              fontSize: `min(${label.kind === 'six' ? 150 : label.kind === 'four' ? 130 : label.kind === 'out' ? 110 : 72}px, ${Math.min(30, 150 / Math.max(1, label.text.length))}vw)`,
            }}
          >
            {label.text}
          </div>
        </div>
      )}
      {grade && !label && (
        <div key={grade.key} className="absolute inset-x-0 top-[17%] z-20 text-center pointer-events-none animate-pop">
          <div className={`font-display text-5xl tracking-widest text-stroke ${grade.text === 'PERFECT' ? 'text-emerald-300' : grade.text === 'GOOD' ? 'text-lime-200' : 'text-orange-300'}`}>{grade.text}</div>
        </div>
      )}

      {/* Waiting banner */}
      {waitingText && (
        <div className={`absolute inset-x-0 ${iAmStriker ? "top-28 sm:top-32" : "bottom-8"} z-20 text-center pointer-events-none`}>
          <span className="inline-block rounded-full bg-black/65 border border-white/10 px-5 py-2.5 text-sm sm:text-base animate-rise">
            <span className="inline-block h-2 w-2 rounded-full bg-gold mr-2 animate-pulse" />
            {waitingText}
          </span>
        </div>
      )}

      {/* Batting controls */}
      {iAmStriker && match.phase === 'playing' && (busy ? liveBatting : true) && !canBowl && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3 pb-5 pointer-events-none">
          {liveBatting && (
            <div className="mx-auto max-w-xl grid grid-cols-3 text-center text-xs font-semibold tracking-widest text-white/55 mb-3">
              <div>◀ LEG SIDE</div>
              <div>STRAIGHT</div>
              <div>OFF SIDE ▶</div>
            </div>
          )}
          <div className="flex justify-between items-end max-w-xl mx-auto">
            {liveBatting ? (
              <TimingBar scene={getScene} />
            ) : (
              <div className="text-xs text-white/60 max-w-[55%] leading-snug bg-black/40 rounded-xl px-3 py-2">
                Tap left · middle · right of the batter as the ball arrives, or swipe (swipe up to loft). Keys: ← ↑ →
              </div>
            )}
            <button
              className={`pointer-events-auto rounded-2xl px-5 py-3 font-display text-2xl tracking-widest border-2 transition ${loft ? 'bg-gold text-ink border-gold shadow-[0_0_24px_rgba(255,210,63,0.6)]' : 'bg-black/50 border-white/25 text-white/80'}`}
              onPointerDown={(e) => {
                e.stopPropagation()
                loftRef.current = !loftRef.current
                setLoft(loftRef.current)
              }}
            >
              LOFT {loft ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Bowling controls */}
      {canBowl && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3 pb-4 animate-rise">
          <div className="mx-auto max-w-xl rounded-3xl p-3 sm:p-4" style={{ background: 'rgba(7,11,26,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-display text-2xl tracking-wide">Your over · bowl</div>
              <div className="text-xs text-white/55">Drag the red target on the pitch</div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {(Object.keys(DELIVERY_INFO) as DeliveryType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setDtype(t)}
                  className={`rounded-xl py-1.5 px-1 transition ${dtype === t ? 'bg-gold text-ink' : 'bg-white/5 text-white/80'}`}
                >
                  <div className="text-[13px] font-bold leading-tight">{DELIVERY_INFO[t].label}</div>
                  <div className="text-[10px] opacity-60">{Math.round(DELIVERY_INFO[t].speed * 3.6)} km/h</div>
                </button>
              ))}
            </div>
            {(dtype === 'swing' || dtype === 'spin' || dtype === 'seam') && (
              <div className="flex gap-1.5 mt-2">
                {([1, -1] as const).map((d) => (
                  <button key={d} onClick={() => setTurnDir(d)} className={`flex-1 rounded-lg py-1 text-xs font-semibold ${turnDir === d ? 'bg-white text-ink' : 'bg-white/5 text-white/70'}`}>
                    {dtype === 'swing' ? (d === 1 ? 'Out-swing →' : '← In-swing') : dtype === 'seam' ? (d === 1 ? 'Seam away →' : '← Seam in') : d === 1 ? 'Turn to off →' : '← Turn to leg'}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[11px] uppercase tracking-wider text-white/50 mr-1">Field</span>
              {(['attacking', 'balanced', 'defensive'] as FieldSetting[]).map((f) => (
                <button key={f} onClick={() => setField(f)} className={`flex-1 rounded-lg py-1 text-xs font-semibold ${field === f ? 'bg-tide text-white' : 'bg-white/5 text-white/70'}`}>
                  {FIELD_LABEL[f]}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-9 flex-1 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg,#ff3b3b,#ffb21f 30%,#2bd17e 45%,#2bd17e 55%,#ffb21f 70%,#ff3b3b)' }}>
                <div ref={meterRef} className="absolute top-0 bottom-0 w-1.5 -ml-[3px] bg-white shadow-[0_0_12px_#fff]" />
              </div>
              <button onClick={bowl} className="btn-primary rounded-2xl px-6 py-2.5 font-display text-2xl tracking-widest">
                BOWL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toss */}
      {showToss && idle && (
        <Overlay>
          <div className="text-6xl mb-2">🪙</div>
          <div className="font-display text-4xl sm:text-5xl tracking-wide">
            <span style={{ color: TEAM_COLORS[match.tossWinner].main }}>{match.settings.teamNames[match.tossWinner]}</span> won the toss
          </div>
          <div className="text-white/75 mt-1">and chose to {match.innings[0].batting === match.tossWinner ? 'bat' : 'bowl'} first</div>
          <div className="mt-4 text-sm text-white/50">
            {match.settings.overs} over{match.settings.overs > 1 ? 's' : ''} · {match.maxWickets?.[match.innings[0].batting] ?? match.settings.wickets} wicket{(match.maxWickets?.[match.innings[0].batting] ?? match.settings.wickets) > 1 ? 's' : ''} · {match.teams.A.length}v{match.teams.B.length}
          </div>
        </Overlay>
      )}

      {/* Innings break */}
      {idle && match.phase === 'break' && (
        <Overlay>
          <div className="text-xs uppercase tracking-[0.3em] text-white/50">Innings break</div>
          <div className="font-display text-5xl mt-1" style={{ color: TEAM_COLORS[match.innings[0].batting].main }}>
            {match.settings.teamNames[match.innings[0].batting]} {match.innings[0].runs}/{match.innings[0].wickets}
          </div>
          <div className="text-lg mt-2">
            <b style={{ color: TEAM_COLORS[match.innings[1].batting].main }}>{match.settings.teamNames[match.innings[1].batting]}</b> need{' '}
            <b className="text-gold">{match.innings[1].target}</b> to win
          </div>
          <div className="mt-4 h-1.5 w-48 mx-auto rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gold animate-[grow_6.5s_linear_forwards]" style={{ width: '100%' }} />
          </div>
          <div className="text-xs text-white/45 mt-2">Second innings starting…</div>
        </Overlay>
      )}

      {/* Result */}
      {idle && match.phase === 'done' && match.result && (
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm overflow-y-auto p-4 grid place-items-center">
          <div className="w-full max-w-2xl animate-rise">
            <div className="text-center">
              <div className="text-6xl">{match.result.winner ? '🏆' : '🤝'}</div>
              <div className="font-display text-5xl sm:text-6xl tracking-wide mt-2" style={{ color: match.result.winner ? TEAM_COLORS[match.result.winner].main : '#fff' }}>
                {match.result.text}
              </div>
              {(() => {
                const myTeam = (['A', 'B'] as TeamId[]).find((t) => match.teams[t].includes(myId))
                if (!myTeam || !match.result.winner) return null
                return <div className="text-lg text-white/80">{myTeam === match.result.winner ? 'You won! 🎉' : 'Better luck next time'}</div>
              })()}
            </div>
            <Scorecard match={match} />
            <div className="flex gap-3 mt-5">
              {snap.lobby?.hostId === snap.myId ? (
                <>
                  <button className="btn-primary flex-1 rounded-2xl py-3.5 font-display text-2xl tracking-wider" onClick={() => client.send({ t: 'rematch' })}>
                    Rematch
                  </button>
                  {snap.lobby?.code !== 'SOLO' && (
                    <button className="btn-ghost flex-1 rounded-2xl py-3.5 font-semibold" onClick={() => client.send({ t: 'toLobby' })}>
                      Back to lobby
                    </button>
                  )}
                  <button className="btn-ghost rounded-2xl px-5 py-3.5 font-semibold" onClick={onLeave}>
                    Exit
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 rounded-2xl bg-white/5 py-3.5 text-center text-white/60 text-sm">Waiting for host: rematch or lobby</div>
                  <button className="btn-ghost rounded-2xl px-5 font-semibold" onClick={onLeave}>
                    Exit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div className="absolute inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setConfirmLeave(false)}>
          <div className="glass rounded-3xl p-6 max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-3xl">Leave match?</div>
            <p className="text-sm text-white/65 mt-1">{snap.transport === 'peer' && snap.lobby?.hostId === snap.myId ? 'You are the host: the match ends for everyone.' : 'You can rejoin with the room code.'}</p>
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost flex-1 rounded-xl py-2.5" onClick={() => setConfirmLeave(false)}>
                Stay
              </button>
              <button className="flex-1 rounded-xl py-2.5 bg-red-500 font-semibold" onClick={onLeave}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BallChip({ v }: { v: string }) {
  const cls =
    v === 'W' ? 'bg-red-500 text-white' : v === '6' ? 'bg-gold text-ink' : v === '4' ? 'bg-tide text-white' : /Wd|Nb|B|Lb/.test(v) ? 'bg-white/20 text-white text-[8px]' : v === '0' ? 'bg-white/10 text-white/70' : 'bg-white text-ink'
  return <div className={`h-6 min-w-6 px-0.5 rounded-full grid place-items-center text-xs font-bold ${cls}`}>{v === '0' ? '•' : v}</div>
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center pointer-events-none p-4">
      <div className="rounded-3xl px-8 py-6 text-center animate-pop" style={{ background: 'rgba(7,11,26,0.85)', border: '1px solid rgba(255,255,255,0.12)' }}>
        {children}
      </div>
    </div>
  )
}
