import { botDelivery, botShot } from './ai'
import { resolveBall } from './physics'
import { ballAnimationMs } from './pacing'
import { applyBall, applyFreeHit, createMatch, defaultWickets, isMode, MAX_OVERS, MAX_TEAM, other, startSecondInnings, teamSizeFor, wicketCap } from './rules'
import type { Delivery, LobbyState, MatchSettings, MatchState, Player, ShotInput, TeamId } from './types'
import type { ClientMsg, HostMsg } from '../net/protocol'

/**
 * The authoritative game room. Pure logic with no browser or network APIs, so it runs
 * the same in a host's browser (practice / peer-to-peer) and on the Node Socket.IO server.
 */

export const DEFAULT_SETTINGS: MatchSettings = {
  mode: '1v1',
  overs: 2,
  wickets: 3,
  teamNames: { A: 'Blaze', B: 'Tide' },
  locked: false,
}

export interface RoomOutput {
  send(pid: string, msg: HostMsg): void
  broadcast(msg: HostMsg): void
}

const BOT_NAMES = [
  'Bot Rahul', 'Bot Jack', 'Bot Imran', 'Bot Kane', 'Bot Shane', 'Bot Viv', 'Bot Dale', 'Bot Ash', 'Bot Ravi', 'Bot Joe',
  'Bot Brian', 'Bot Wasim', 'Bot Kumar', 'Bot Glenn', 'Bot Steve', 'Bot Faf', 'Bot Ross', 'Bot Mitch', 'Bot Babar', 'Bot Trent', 'Bot Rash', 'Bot Ben',
]
const rid = () => Math.random().toString(36).slice(2, 8)
export const MAX_ROOM = 30

/** Shortest pause after a shot before the next ball (result banner and settle). */
const MIN_AFTER_SHOT_MS = 1200

export class Room {
  lobby: LobbyState
  match: MatchState | null = null
  private out: RoomOutput
  private pending: { ballId: number; delivery: Delivery; at: number } | null = null
  private timers: ReturnType<typeof setTimeout>[] = []
  private shotTimeout: ReturnType<typeof setTimeout> | null = null
  private bowlTimeout: ReturnType<typeof setTimeout> | null = null
  private awayTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private lastChat = new Map<string, number>()
  /** Striker gets this long to send a shot before it counts as a leave. */
  shotTimeoutMs = 20000
  /** Bowler gets this long before a bot bowls for them. */
  bowlTimeoutMs = 30000
  /** A player who drops mid-match gets this long to come back before a bot takes over. */
  awayGraceMs = 12000

  constructor(code: string, hostId: string, hostName: string, settings: MatchSettings, out: RoomOutput) {
    this.out = out
    this.lobby = {
      code,
      hostId,
      players: [{ id: hostId, name: clean(hostName), team: 'A', connected: true }],
      settings: sanitizeSettings(settings) ?? structuredClone(DEFAULT_SETTINGS),
      inMatch: false,
    }
  }

  // ------------------------------------------------------------------ membership

  /** Returns an error message if the player may not join. */
  join(pid: string, name: string): string | null {
    const existing = this.lobby.players.find((p) => p.id === pid)
    if (existing) {
      existing.connected = true
      existing.name = clean(name)
      this.comeBack(existing)
    } else {
      if (this.lobby.inMatch && this.lobby.settings.locked) return 'This room is locked while a match is in progress'
      if (this.lobby.players.filter((p) => !p.isBot).length >= MAX_ROOM) return 'This room is full'
      const team = this.autoTeam()
      this.lobby.players.push({ id: pid, name: clean(name), team, connected: true, spectator: this.lobby.inMatch || undefined })
    }
    this.pushLobby()
    if (this.match) this.out.send(pid, { t: 'match', match: this.match })
    return null
  }

  private comeBack(p: Player) {
    const t = this.awayTimers.get(p.id)
    if (t) clearTimeout(t)
    this.awayTimers.delete(p.id)
    if (p.away) {
      p.away = false
      this.out.broadcast({ t: 'chat', from: 'system', name: '', text: `${p.name} is back`, at: Date.now() })
    }
  }

  disconnect(pid: string) {
    const p = this.lobby.players.find((x) => x.id === pid)
    if (!p) return
    p.connected = false
    const playing = this.lobby.inMatch && !!this.match && (this.match.teams.A.includes(pid) || this.match.teams.B.includes(pid))
    if (!playing) {
      this.lobby.players = this.lobby.players.filter((x) => x.id !== pid)
    } else {
      // Grace period, then a bot plays their turns until they reconnect.
      this.awayTimers.set(
        pid,
        setTimeout(() => {
          this.awayTimers.delete(pid)
          if (p.connected) return
          p.away = true
          this.out.broadcast({ t: 'chat', from: 'system', name: '', text: `${p.name} disconnected · a bot is playing for them`, at: Date.now() })
          this.pushLobby()
          this.actForAway()
        }, this.awayGraceMs),
      )
    }
    // Hand the host role to another connected human.
    if (pid === this.lobby.hostId) {
      const next = this.lobby.players.find((x) => x.connected && !x.isBot && !x.spectator) ?? this.lobby.players.find((x) => x.connected && !x.isBot)
      if (next) this.lobby.hostId = next.id
    }
    this.pushLobby()
  }

  connectedHumans() {
    return this.lobby.players.filter((p) => p.connected && !p.isBot).length
  }

  private autoTeam(): TeamId | null {
    if (this.lobby.inMatch) return null
    const size = teamSizeFor(this.lobby.settings.mode) ?? MAX_TEAM
    const count = (t: TeamId) => this.lobby.players.filter((p) => p.team === t).length
    const order: TeamId[] = count('A') <= count('B') ? ['A', 'B'] : ['B', 'A']
    for (const t of order) if (count(t) < size) return t
    for (const t of order) {
      const bot = this.lobby.players.find((p) => p.team === t && p.isBot)
      if (bot) {
        this.lobby.players = this.lobby.players.filter((p) => p !== bot)
        return t
      }
    }
    return null
  }

  addBot(team: TeamId) {
    const size = teamSizeFor(this.lobby.settings.mode) ?? MAX_TEAM
    const count = this.lobby.players.filter((p) => p.team === team).length
    if (count >= size) return
    const used = new Set(this.lobby.players.map((p) => p.name))
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${rid().slice(0, 3)}`
    this.lobby.players.push({ id: 'bot-' + rid(), name, team, isBot: true, connected: true })
  }

  /** Fill every empty slot on both teams with bots. */
  fillBots() {
    const size = teamSizeFor(this.lobby.settings.mode)
    if (size === null) return
    for (const t of ['A', 'B'] as TeamId[]) while (this.lobby.players.filter((p) => p.team === t).length < size) this.addBot(t)
  }

  // ------------------------------------------------------------------ messages

  handle(pid: string, msg: ClientMsg) {
    if (!msg || typeof msg !== 'object') return
    const isHost = pid === this.lobby.hostId
    const L = this.lobby
    switch (msg.t) {
      case 'setTeam': {
        if (L.inMatch) return
        const p = L.players.find((x) => x.id === pid)
        if (!p || (msg.team !== null && msg.team !== 'A' && msg.team !== 'B')) return
        const size = teamSizeFor(L.settings.mode) ?? MAX_TEAM
        if (msg.team && L.players.filter((x) => x.team === msg.team && x.id !== pid).length >= size) {
          const bot = L.players.find((x) => x.team === msg.team && x.isBot)
          if (!bot) return this.out.send(pid, { t: 'error', text: 'That team is full' })
          L.players = L.players.filter((x) => x !== bot)
        }
        p.team = msg.team
        p.spectator = undefined
        break
      }
      case 'settings': {
        if (!isHost || L.inMatch) {
          // The lock can be toggled by the host mid-match.
          if (isHost && msg.settings && typeof msg.settings.locked === 'boolean') {
            L.settings.locked = msg.settings.locked
            break
          }
          return
        }
        const s = sanitizeSettings(msg.settings)
        if (!s) return
        L.settings = s
        const size = teamSizeFor(s.mode) ?? MAX_TEAM
        for (const t of ['A', 'B'] as TeamId[]) {
          const members = L.players.filter((p) => p.team === t)
          members.sort((a, b) => Number(!!b.isBot) - Number(!!a.isBot))
          while (members.length > size) {
            const p = members.shift()!
            if (p.isBot) L.players = L.players.filter((x) => x !== p)
            else p.team = null
          }
        }
        break
      }
      case 'addBot':
        if (isHost && !L.inMatch && (msg.team === 'A' || msg.team === 'B')) this.addBot(msg.team)
        break
      case 'fillBots':
        if (isHost && !L.inMatch) this.fillBots()
        break
      case 'kick': {
        if (!isHost || msg.pid === L.hostId) return
        const target = L.players.find((p) => p.id === msg.pid)
        if (!target) return
        // Mid-match only spectators can be removed; players would break the batting order.
        if (L.inMatch && !target.spectator && target.team) return this.out.send(pid, { t: 'error', text: 'Players can be removed after the match' })
        L.players = L.players.filter((p) => p.id !== msg.pid)
        this.out.send(msg.pid, { t: 'kicked' })
        break
      }
      case 'start':
        if (isHost && !L.inMatch) this.start()
        return
      case 'rematch':
        if (isHost && this.match?.phase === 'done') this.start()
        return
      case 'toLobby':
        if (!isHost) return
        this.clearTimers()
        this.match = null
        L.inMatch = false
        L.players = L.players.filter((p) => p.connected || p.isBot)
        for (const p of L.players) {
          p.away = undefined
          p.spectator = undefined
        }
        this.out.broadcast({ t: 'match', match: null })
        break
      case 'bowl':
        this.onBowl(pid, msg.delivery)
        return
      case 'shot':
        this.onShot(pid, msg.ballId, msg.shot)
        return
      case 'chat': {
        const p = L.players.find((x) => x.id === pid)
        const now = Date.now()
        if (!p || now - (this.lastChat.get(pid) ?? 0) < 800) return
        this.lastChat.set(pid, now)
        this.out.broadcast({ t: 'chat', from: pid, name: p.name, text: String(msg.text ?? '').slice(0, 80), at: now })
        return
      }
      default:
        return
    }
    this.pushLobby()
  }

  canStart(): string | null {
    return canStartLobby(this.lobby)
  }

  start() {
    const err = this.canStart()
    if (err) return this.out.send(this.lobby.hostId, { t: 'error', text: err })
    this.clearTimers()
    const L = this.lobby
    const teams: Record<TeamId, string[]> = {
      A: L.players.filter((p) => p.team === 'A').map((p) => p.id),
      B: L.players.filter((p) => p.team === 'B').map((p) => p.id),
    }
    const names = Object.fromEntries(L.players.map((p) => [p.id, p.name]))
    const toss: TeamId = Math.random() < 0.5 ? 'A' : 'B'
    const batFirst = Math.random() < 0.6 ? toss : other(toss)
    L.inMatch = true
    for (const p of L.players) if (!p.team && !p.isBot) p.spectator = true
    this.match = createMatch(L.settings, teams, names, toss, batFirst)
    this.pushLobby()
    this.out.broadcast({ t: 'match', match: this.match })
    this.scheduleTurn(4400)
  }

  /** Bots and players who have dropped out are played by the AI. */
  private isAuto(pid: string) {
    const p = this.lobby.players.find((x) => x.id === pid)
    return !p || !!p.isBot || !!p.away
  }

  private onBowl(pid: string, delivery: Delivery) {
    const m = this.match
    if (!m || m.phase !== 'playing' || !m.turn || m.turn.stage !== 'bowl' || m.turn.bowler !== pid) return
    if (!validDelivery(delivery)) return
    if (this.bowlTimeout) clearTimeout(this.bowlTimeout)
    m.turn.stage = 'bat'
    const ballId = m.ballId
    const striker = m.turn.striker
    this.pending = { ballId, delivery, at: Date.now() }
    this.out.broadcast({ t: 'match', match: m })
    this.out.broadcast({ t: 'ball', ballId, delivery, striker })
    if (this.shotTimeout) clearTimeout(this.shotTimeout)
    if (this.isAuto(striker)) {
      this.later(() => this.onShot(striker, ballId, botShot(delivery, this.match)), 150)
    } else {
      this.shotTimeout = setTimeout(() => {
        if (this.pending?.ballId === ballId) this.onShot(striker, ballId, { swung: false, dir: 0, loft: false, timing: 0 })
      }, this.shotTimeoutMs)
    }
  }

  private onShot(pid: string, ballId: number, shot: ShotInput) {
    const m = this.match
    if (!m || !this.pending || this.pending.ballId !== ballId || m.turn?.striker !== pid || m.turn.stage !== 'bat') return
    if (!validShot(shot)) return
    if (this.shotTimeout) clearTimeout(this.shotTimeout)
    const { delivery, at } = this.pending
    this.pending = null
    const outcome = applyFreeHit(m, resolveBall(delivery, shot))
    this.match = applyBall(m, outcome)
    this.out.broadcast({ t: 'replay', ballId, delivery, shot, outcome, match: this.match })
    // The run-up and flight have already played on screens by the time a human's shot arrives,
    // so only wait for what's left of the animation (a bot's shot comes almost at once).
    const wait = Math.max(MIN_AFTER_SHOT_MS, ballAnimationMs(delivery, outcome) - (Date.now() - at))
    if (this.match.phase === 'break') {
      this.later(() => {
        if (this.match?.phase !== 'break') return
        this.match = startSecondInnings(this.match)
        this.out.broadcast({ t: 'match', match: this.match })
        this.scheduleTurn(1500)
      }, wait + 6500)
    } else {
      this.scheduleTurn(wait)
    }
  }

  /** Line up the next delivery: a bot bowls after the animation, a human gets a turn timer. */
  private scheduleTurn(delay: number) {
    const m = this.match
    if (!m || m.phase !== 'playing' || !m.turn) return
    const bowler = m.turn.bowler
    const ballId = m.ballId
    const bowlNow = () => {
      if (this.match?.ballId === ballId && this.match.turn?.stage === 'bowl') this.onBowl(bowler, botDelivery(this.match))
    }
    if (this.bowlTimeout) clearTimeout(this.bowlTimeout)
    if (this.isAuto(bowler)) this.later(bowlNow, delay)
    else this.bowlTimeout = setTimeout(bowlNow, delay + this.bowlTimeoutMs)
  }

  /** Someone just went away: if it's their move, let the AI make it. */
  private actForAway() {
    const m = this.match
    if (!m || m.phase !== 'playing' || !m.turn) return
    if (m.turn.stage === 'bowl' && this.isAuto(m.turn.bowler)) this.scheduleTurn(600)
    if (m.turn.stage === 'bat' && this.pending && this.isAuto(m.turn.striker)) {
      const { ballId, delivery } = this.pending
      this.later(() => this.onShot(m.turn!.striker, ballId, botShot(delivery, this.match)), 150)
    }
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms))
  }

  private clearTimers() {
    this.timers.forEach((t) => clearTimeout(t))
    this.timers = []
    if (this.shotTimeout) clearTimeout(this.shotTimeout)
    if (this.bowlTimeout) clearTimeout(this.bowlTimeout)
    this.pending = null
  }

  pushLobby() {
    this.out.broadcast({ t: 'lobby', lobby: this.lobby })
  }

  close() {
    this.clearTimers()
    this.awayTimers.forEach((t) => clearTimeout(t))
    this.awayTimers.clear()
  }
}

/** Shared by the room and the client UI (to enable the Start button). */
export function canStartLobby(L: LobbyState): string | null {
  const size = teamSizeFor(L.settings.mode)
  const a = L.players.filter((p) => p.team === 'A').length
  const b = L.players.filter((p) => p.team === 'B').length
  if (size !== null && (a !== size || b !== size)) return `Each team needs ${size} player${size > 1 ? 's' : ''} (add bots to fill)`
  if (a < 1 || b < 1) return 'Both teams need at least one player'
  if (a > MAX_TEAM || b > MAX_TEAM) return `At most ${MAX_TEAM} players a side`
  return null
}

export function sanitizeSettings(s: MatchSettings | undefined | null): MatchSettings | null {
  if (!s || !isMode(s.mode)) return null
  const size = teamSizeFor(s.mode) ?? MAX_TEAM
  return {
    mode: s.mode,
    overs: clampInt(s.overs, 1, MAX_OVERS),
    wickets: clampInt(s.wickets ?? defaultWickets(size), 1, wicketCap(size)),
    teamNames: { A: String(s.teamNames?.A ?? '').slice(0, 14) || 'Team A', B: String(s.teamNames?.B ?? '').slice(0, 14) || 'Team B' },
    locked: !!s.locked,
  }
}

function clean(name: string) {
  return [...String(name ?? '')].filter((ch) => ch.charCodeAt(0) >= 32).join('').trim().slice(0, 16) || 'Player'
}

function clampInt(v: unknown, a: number, b: number) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

function validDelivery(d: Delivery) {
  return (
    !!d &&
    ['fast', 'swing', 'seam', 'spin', 'yorker', 'bouncer', 'slower'].includes(d.type) &&
    num(d.line) && Math.abs(d.line) <= 3 &&
    num(d.length) && d.length >= -0.5 && d.length <= 1.5 &&
    num(d.power) && d.power >= 0 && d.power <= 1 &&
    (d.turn === 1 || d.turn === -1) &&
    num(d.seed) &&
    (d.field === undefined || d.field === 'attacking' || d.field === 'balanced' || d.field === 'defensive')
  )
}

function validShot(s: ShotInput) {
  return !!s && typeof s.swung === 'boolean' && num(s.dir) && Math.abs(s.dir) <= 1.5 && typeof s.loft === 'boolean' && num(s.timing) && Math.abs(s.timing) < 5000
}
