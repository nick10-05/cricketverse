import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gradeTiming, resolveBall, trajectory, classifyShot } from './physics'
import { applyBall, applyFreeHit, createMatch, isMode } from './rules'
import { DEFAULT_SETTINGS, Room, sanitizeSettings } from './room'
import type { BallOutcome, Delivery, MatchSettings } from './types'
import type { HostMsg } from '../net/protocol'

const delivery = (over: Partial<Delivery> = {}): Delivery => ({ type: 'fast', line: 0, length: 0.5, power: 0.9, turn: 1, seed: 1234, ...over })

describe('physics', () => {
  it('is deterministic for the same delivery and shot', () => {
    const d = delivery({ seed: 99 })
    const s = { swung: true, dir: 0.3, loft: true, timing: 10 }
    expect(resolveBall(d, s)).toEqual(resolveBall(d, s))
  })

  it('ball reaches the batter after release and bounces before', () => {
    const tr = trajectory(delivery())
    expect(tr.tBounce).toBeGreaterThan(0)
    expect(tr.tContact).toBeGreaterThan(tr.tBounce)
    expect(tr.tStumps).toBeGreaterThan(tr.tContact)
  })

  it('grades timing windows', () => {
    const d = delivery()
    expect(gradeTiming(d, { swung: true, dir: 0, loft: false, timing: 0 })).toBe('perfect')
    expect(gradeTiming(d, { swung: true, dir: 0, loft: false, timing: -110 })).toBe('early')
    expect(gradeTiming(d, { swung: true, dir: 0, loft: false, timing: 110 })).toBe('late')
    expect(gradeTiming(d, { swung: true, dir: 0, loft: false, timing: 400 })).toBe('miss')
    expect(gradeTiming(d, { swung: false, dir: 0, loft: false, timing: 0 })).toBe('none')
  })

  it('classifies shots by length and direction', () => {
    expect(classifyShot(delivery({ type: 'bouncer', length: 0.95 }), { swung: true, dir: -0.6, loft: false, timing: 0 }).shot).toBe('pull')
    expect(classifyShot(delivery({ type: 'bouncer', length: 0.95 }), { swung: true, dir: 0.7, loft: false, timing: 0 }).shot).toBe('cut')
    expect(classifyShot(delivery({ length: 0.3 }), { swung: true, dir: 0.6, loft: false, timing: 0 }).shot).toBe('cover drive')
    expect(classifyShot(delivery({ length: 0.3 }), { swung: true, dir: 0, loft: true, timing: 0 }).shot).toBe('lofted drive')
    expect(classifyShot(delivery(), { swung: false, dir: 0, loft: false, timing: 0 }).footwork).toBeDefined()
  })

  it('a straight ball that is left alone hits the stumps', () => {
    let bowled = 0
    for (let seed = 0; seed < 50; seed++) {
      const o = resolveBall(delivery({ seed, line: 0, length: 0.2, power: 1 }), { swung: false, dir: 0, loft: false, timing: 0 })
      if (o.wicket === 'bowled' || o.wicket === 'lbw') bowled++
    }
    expect(bowled).toBeGreaterThan(25)
  })

  it('perfect lofted timing scores far more than poor timing on average', () => {
    const avg = (timing: number) => {
      let runs = 0
      for (let seed = 0; seed < 300; seed++) runs += resolveBall(delivery({ seed, length: 0.4 }), { swung: true, dir: (seed % 3) - 1, loft: true, timing }).runs
      return runs / 300
    }
    expect(avg(0)).toBeGreaterThan(avg(-110) + 1.5)
  })
})

const settings: MatchSettings = { ...DEFAULT_SETTINGS, overs: 1, wickets: 2 }
const dot: BallOutcome = { runs: 0, extra: null, wicket: null, grade: 'good', label: '', boundary: null, path: [], fielder: -1, fielderPath: [], edged: false, shot: 'block', footwork: 'front', dive: false, throwPath: [] }

describe('rules', () => {
  it('ends the innings after the overs are bowled and sets a target', () => {
    let m = createMatch(settings, { A: ['a'], B: ['b'] }, { a: 'A', b: 'B' }, 'A', 'A')
    for (let i = 0; i < 5; i++) m = applyBall(m, { ...dot, runs: 1 })
    expect(m.phase).toBe('playing')
    m = applyBall(m, { ...dot, runs: 4, boundary: 4 })
    expect(m.phase).toBe('break')
    expect(m.innings[1].target).toBe(10)
  })

  it('wides add a run and do not count as a ball', () => {
    let m = createMatch(settings, { A: ['a'], B: ['b'] }, { a: 'A', b: 'B' }, 'A', 'A')
    m = applyBall(m, { ...dot, runs: 1, extra: 'wide' })
    expect(m.innings[0].balls).toBe(0)
    expect(m.innings[0].runs).toBe(1)
  })

  it('all out ends the innings and a chase can win the match', () => {
    let m = createMatch(settings, { A: ['a'], B: ['b'] }, { a: 'A', b: 'B' }, 'A', 'A')
    m = applyBall(m, { ...dot, wicket: 'bowled' })
    m = applyBall(m, { ...dot, wicket: 'bowled' })
    expect(m.phase).toBe('break')
    m = { ...m, phase: 'playing' }
    m = applyBall(m, { ...dot, runs: 1 })
    expect(m.phase).toBe('done')
    expect(m.result?.winner).toBe('B')
  })
})

describe('room', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const makeRoom = () => {
    const sent: { to: string; msg: HostMsg }[] = []
    const room = new Room('ABCDE', 'host', 'Host', settings, {
      send: (to, msg) => sent.push({ to, msg }),
      broadcast: (msg) => sent.push({ to: '*', msg }),
    })
    return { room, sent }
  }

  it('auto-assigns joiners to the emptier team and enforces team size', () => {
    const { room } = makeRoom()
    room.join('p2', 'Two')
    expect(room.lobby.players.find((p) => p.id === 'p2')?.team).toBe('B')
    room.join('p3', 'Three')
    expect(room.lobby.players.find((p) => p.id === 'p3')?.team).toBeNull()
  })

  it('only the host can change settings and values are clamped', () => {
    const { room } = makeRoom()
    room.join('p2', 'Two')
    room.handle('p2', { t: 'settings', settings: { ...settings, overs: 5 } })
    expect(room.lobby.settings.overs).toBe(1)
    room.handle('host', { t: 'settings', settings: { ...settings, overs: 99 } })
    expect(room.lobby.settings.overs).toBe(30)
  })

  it('rejects bowling out of turn and plays a full ball for the right players', () => {
    const { room, sent } = makeRoom()
    room.join('p2', 'Two')
    room.handle('host', { t: 'start' })
    const m = room.match!
    const { bowler, striker } = m.turn!
    room.handle(striker, { t: 'bowl', delivery: delivery() })
    expect(room.match!.turn!.stage).toBe('bowl')
    room.handle(bowler, { t: 'bowl', delivery: delivery() })
    expect(room.match!.turn!.stage).toBe('bat')
    room.handle(striker, { t: 'shot', ballId: 0, shot: { swung: true, dir: 0, loft: false, timing: 0 } })
    expect(sent.some((s) => s.msg.t === 'replay')).toBe(true)
    expect(room.match!.ballId).toBe(1)
  })

  it('treats a missing shot as a leave after the timeout', () => {
    const { room } = makeRoom()
    room.join('p2', 'Two')
    room.handle('host', { t: 'start' })
    room.handle(room.match!.turn!.bowler, { t: 'bowl', delivery: delivery() })
    vi.advanceTimersByTime(room.shotTimeoutMs + 10)
    expect(room.match!.ballId).toBe(1)
  })

  it('ignores malformed messages', () => {
    const { room } = makeRoom()
    expect(() => room.handle('host', { t: 'bowl', delivery: { type: 'nope' } as unknown as Delivery })).not.toThrow()
    expect(() => room.handle('host', null as unknown as never)).not.toThrow()
  })

  it('hands host to another player when the host leaves the lobby', () => {
    const { room } = makeRoom()
    room.join('p2', 'Two')
    room.disconnect('host')
    expect(room.lobby.hostId).toBe('p2')
  })
})

describe('phase 1 rules', () => {
  const s = (mode: MatchSettings['mode'], wickets: number, overs = 2): MatchSettings => ({ ...DEFAULT_SETTINGS, mode, wickets, overs })

  it('accepts every team size from 1v1 to 11v11 and overs up to 30', () => {
    for (let n = 1; n <= 11; n++) expect(isMode(`${n}v${n}`)).toBe(true)
    expect(isMode('12v12')).toBe(false)
    expect(isMode('2v3')).toBe(false)
    expect(sanitizeSettings(s('11v11', 10, 30))?.overs).toBe(30)
    expect(sanitizeSettings(s('11v11', 10, 31))?.overs).toBe(30)
    expect(sanitizeSettings(s('3v3', 9))?.wickets).toBe(3)
    expect(sanitizeSettings(s('1v1', 9))?.wickets).toBe(9)
  })

  it('rotates strike on odd runs and at the end of an over', () => {
    let m = createMatch(s('2v2', 2), { A: ['a1', 'a2'], B: ['b1', 'b2'] }, {}, 'A', 'A')
    expect(m.turn?.striker).toBe('a1')
    m = applyBall(m, { ...dot, runs: 1 })
    expect(m.turn?.striker).toBe('a2')
    m = applyBall(m, { ...dot, runs: 2 })
    expect(m.turn?.striker).toBe('a2')
    for (let i = 0; i < 4; i++) m = applyBall(m, dot)
    // over done: ends change, so a1 is back on strike, and the next bowler takes over
    expect(m.turn?.striker).toBe('a1')
    expect(m.turn?.bowler).toBe('b2')
  })

  it('last man stands: the survivor bats alone until the final wicket', () => {
    let m = createMatch(s('2v2', 2), { A: ['a1', 'a2'], B: ['b1', 'b2'] }, {}, 'A', 'A')
    m = applyBall(m, { ...dot, wicket: 'bowled' })
    expect(m.phase).toBe('playing')
    expect(m.turn?.striker).toBe('a2')
    m = applyBall(m, { ...dot, runs: 1 })
    expect(m.turn?.striker).toBe('a2') // no partner to swap with
    m = applyBall(m, { ...dot, wicket: 'caught' })
    expect(m.phase).toBe('break')
  })

  it('no-balls cost a run, are not a legal ball, and give a free hit', () => {
    let m = createMatch(s('1v1', 3), { A: ['a'], B: ['b'] }, {}, 'A', 'A')
    m = applyBall(m, { ...dot, extra: 'noball', runs: 1 })
    expect(m.innings[0].balls).toBe(0)
    expect(m.innings[0].runs).toBe(1)
    expect(m.innings[0].freeHit).toBe(true)
    const saved = applyFreeHit(m, { ...dot, wicket: 'bowled' })
    expect(saved.wicket).toBeNull()
    expect(applyFreeHit(m, { ...dot, wicket: 'run out' }).wicket).toBe('run out')
  })

  it('byes count as extras and not against the bowler', () => {
    let m = createMatch(s('1v1', 3), { A: ['a'], B: ['b'] }, {}, 'A', 'A')
    m = applyBall(m, { ...dot, extra: 'bye', runs: 4 })
    expect(m.innings[0].extras).toBe(4)
    expect(m.innings[0].bowlers.b.runs).toBe(0)
    expect(m.innings[0].batters.a.runs).toBe(0)
  })

  it('field settings and seam deliveries are deterministic', () => {
    const d = delivery({ type: 'seam', field: 'defensive', seed: 77 })
    const shot = { swung: true, dir: 0.5, loft: true, timing: 0 }
    expect(resolveBall(d, shot)).toEqual(resolveBall(d, shot))
  })
})

describe('phase 2 room safety', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const mk = (locked = false) => {
    const sent: HostMsg[] = []
    const room = new Room('ABCDE', 'host', 'Host', { ...settings, locked }, { send: (_p, m) => sent.push(m), broadcast: (m) => sent.push(m) })
    return { room, sent }
  }

  it('late joiners watch as spectators, or are refused when the room is locked', () => {
    const { room } = mk()
    room.join('p2', 'Two')
    room.handle('host', { t: 'start' })
    expect(room.join('late', 'Late')).toBeNull()
    expect(room.lobby.players.find((p) => p.id === 'late')?.spectator).toBe(true)
    const locked = mk(true)
    locked.room.join('p2', 'Two')
    locked.room.handle('host', { t: 'start' })
    expect(locked.room.join('late', 'Late')).toMatch(/locked/)
    // a player who was already in the match can always come back
    locked.room.disconnect('p2')
    expect(locked.room.join('p2', 'Two')).toBeNull()
  })

  it('a bot plays for a disconnected bowler after the grace period', () => {
    const { room } = mk()
    room.join('p2', 'Two')
    room.handle('host', { t: 'start' })
    const bowler = room.match!.turn!.bowler
    room.disconnect(bowler)
    vi.advanceTimersByTime(room.awayGraceMs + 1000)
    expect(room.lobby.players.find((p) => p.id === bowler)?.away).toBe(true)
    expect(room.match!.turn!.stage).toBe('bat')
  })

  it('fills empty slots with bots for big teams', () => {
    const { room } = mk()
    room.handle('host', { t: 'settings', settings: { ...settings, mode: '11v11', wickets: 10 } })
    room.handle('host', { t: 'fillBots' })
    expect(room.lobby.players.filter((p) => p.team === 'A').length).toBe(11)
    expect(room.lobby.players.filter((p) => p.team === 'B').length).toBe(11)
    expect(room.canStart()).toBeNull()
  })

  it('rate-limits chat', () => {
    const { room, sent } = mk()
    room.handle('host', { t: 'chat', text: 'hi' })
    room.handle('host', { t: 'chat', text: 'spam' })
    expect(sent.filter((m) => m.t === 'chat').length).toBe(1)
  })
})
