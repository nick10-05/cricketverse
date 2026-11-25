import { botDelivery, botShot } from './ai'
import { resolveBall } from './physics'
import { applyBall, createMatch, other, startSecondInnings, teamSizeFor } from './rules'
import type { Delivery, LobbyState, MatchSettings, MatchState, ShotInput, TeamId } from './types'
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
}

export interface RoomOutput {
  send(pid: string, msg: HostMsg): void
  broadcast(msg: HostMsg): void
}

const BOT_NAMES = ['Bot Rahul', 'Bot Jack', 'Bot Imran', 'Bot Kane', 'Bot Shane', 'Bot Viv', 'Bot Dale', 'Bot Ash', 'Bot Ravi', 'Bot Joe']
const rid = () => Math.random().toString(36).slice(2, 8)

/** Animation time the clients need for one ball, so bots don't rush ahead. */
export function ballAnimationMs(pathT: number, slowMo: boolean) {
  return 1350 + 700 + Math.min(pathT, 5) * 1000 + 2300 + (slowMo ? 3200 : 0)
}

export class Room {
  lobby: LobbyState
  match: MatchState | null = null
  private out: RoomOutput
  private pending: { ballId: number; delivery: Delivery } | null = null
  private timers: ReturnType<typeof setTimeout>[] = []
  private shotTimeout: ReturnType<typeof setTimeout> | null = null
  /** Striker gets this long to send a shot before it counts as a leave. */
  shotTimeoutMs = 20000

  constructor(code: string, hostId: string, hostName: string, settings: MatchSettings, out: RoomOutput) {
    this.out = out
    this.lobby = {
      code,
      hostId,
      players: [{ id: hostId, name: clean(hostName), team: 'A', connected: true }],
      settings: structuredClone(settings),
      inMatch: false,
    }
  }

  // ------------------------------------------------------------------ membership

  join(pid: string, name: string) {
    const existing = this.lobby.players.find((p) => p.id === pid)
    if (existing) {
      existing.connected = true
      existing.name = clean(name)
    } else {
      this.lobby.players.push({ id: pid, name: clean(name), team: this.autoTeam(), connected: true })
    }
    this.pushLobby()
    if (this.match) this.out.send(pid, { t: 'match', match: this.match })
  }

  disconnect(pid: string) {
    const p = this.lobby.players.find((x) => x.id === pid)
    if (!p) return
    p.connected = false
    if (!this.lobby.inMatch) this.lobby.players = this.lobby.players.filter((x) => x.id !== pid)
    // Hand the host role to another connected human.
    if (pid === this.lobby.hostId) {
      const next = this.lobby.players.find((x) => x.connected && !x.isBot)
      if (next) this.lobby.hostId = next.id
    }
    this.pushLobby()
  }

  connectedHumans() {
    return this.lobby.players.filter((p) => p.connected && !p.isBot).length
  }

  private autoTeam(): TeamId | null {
    if (this.lobby.inMatch) return null
    const size = teamSizeFor(this.lobby.settings.mode)
    const count = (t: TeamId) => this.lobby.players.filter((p) => p.team === t).length
    const order: TeamId[] = count('A') <= count('B') ? ['A', 'B'] : ['B', 'A']
    for (const t of order) if (size === null || count(t) < size) return t
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
    const size = teamSizeFor(this.lobby.settings.mode)
    const count = this.lobby.players.filter((p) => p.team === team).length
    if (size !== null && count >= size) return
    const used = new Set(this.lobby.players.map((p) => p.name))
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${rid().slice(0, 3)}`
    this.lobby.players.push({ id: 'bot-' + rid(), name, team, isBot: true, connected: true })
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
        const size = teamSizeFor(L.settings.mode)
        if (msg.team && size !== null && L.players.filter((x) => x.team === msg.team && x.id !== pid).length >= size) {
          const bot = L.players.find((x) => x.team === msg.team && x.isBot)
          if (!bot) return this.out.send(pid, { t: 'error', text: 'That team is full' })
          L.players = L.players.filter((x) => x !== bot)
        }
        p.team = msg.team
        break
      }
      case 'settings': {
        if (!isHost || L.inMatch) return
        const s = msg.settings
        const modes = ['1v1', '2v2', '3v3', '4v4', '5v5', 'team']
        if (!s || !modes.includes(s.mode)) return
        L.settings = {
          mode: s.mode,
          overs: clampInt(s.overs, 1, 10),
          wickets: clampInt(s.wickets, 1, 10),
          teamNames: { A: String(s.teamNames?.A ?? '').slice(0, 14) || 'Team A', B: String(s.teamNames?.B ?? '').slice(0, 14) || 'Team B' },
        }
        const size = teamSizeFor(s.mode)
        if (size !== null) {
          for (const t of ['A', 'B'] as TeamId[]) {
            const members = L.players.filter((p) => p.team === t)
            members.sort((a, b) => Number(!!b.isBot) - Number(!!a.isBot))
            while (members.length > size) {
              const p = members.shift()!
              if (p.isBot) L.players = L.players.filter((x) => x !== p)
              else p.team = null
            }
          }
        }
        break
      }
      case 'addBot':
        if (isHost && !L.inMatch && (msg.team === 'A' || msg.team === 'B')) this.addBot(msg.team)
        break
      case 'kick':
        if (!isHost || msg.pid === L.hostId) return
        L.players = L.players.filter((p) => p.id !== msg.pid)
        this.out.send(msg.pid, { t: 'kicked' })
        break
      case 'start':
        if (isHost) this.start()
        return
      case 'rematch':
        if (isHost && this.match?.phase === 'done') this.start()
        return
      case 'toLobby':
        if (!isHost) return
        this.clearTimers()
        this.match = null
        L.inMatch = false
        L.players = L.players.filter((p) => p.connected)
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
        if (p) this.out.broadcast({ t: 'chat', from: pid, name: p.name, text: String(msg.text).slice(0, 80), at: Date.now() })
        return
      }
      default:
        return
    }
    this.pushLobby()
  }

  canStart(): string | null {
    const size = teamSizeFor(this.lobby.settings.mode)
    const a = this.lobby.players.filter((p) => p.team === 'A').length
    const b = this.lobby.players.filter((p) => p.team === 'B').length
    if (size !== null && (a !== size || b !== size)) return `Each team needs ${size} player${size > 1 ? 's' : ''} (add bots to fill)`
    if (a < 1 || b < 1) return 'Both teams need at least one player'
    return null
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
    this.match = createMatch(L.settings, teams, names, toss, batFirst)
    this.pushLobby()
    this.out.broadcast({ t: 'match', match: this.match })
    this.scheduleBots(4400)
  }

  private isBot(pid: string) {
    return this.lobby.players.find((p) => p.id === pid)?.isBot ?? false
  }

  private onBowl(pid: string, delivery: Delivery) {
    const m = this.match
    if (!m || m.phase !== 'playing' || !m.turn || m.turn.stage !== 'bowl' || m.turn.bowler !== pid) return
    if (!validDelivery(delivery)) return
    m.turn.stage = 'bat'
    const ballId = m.ballId
    const striker = m.turn.striker
    this.pending = { ballId, delivery }
    this.out.broadcast({ t: 'match', match: m })
    this.out.broadcast({ t: 'ball', ballId, delivery, striker })
    if (this.shotTimeout) clearTimeout(this.shotTimeout)
    if (this.isBot(striker)) {
      this.later(() => this.onShot(striker, ballId, botShot(delivery)), 150)
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
    const delivery = this.pending.delivery
    this.pending = null
    const outcome = resolveBall(delivery, shot)
    this.match = applyBall(m, outcome)
    this.out.broadcast({ t: 'replay', ballId, delivery, shot, outcome, match: this.match })
    const pathT = outcome.path.length ? outcome.path[outcome.path.length - 1].t : 0
    const wait = ballAnimationMs(pathT, !!outcome.wicket || outcome.boundary === 6)
    if (this.match.phase === 'break') {
      this.later(() => {
        if (this.match?.phase !== 'break') return
        this.match = startSecondInnings(this.match)
        this.out.broadcast({ t: 'match', match: this.match })
        this.scheduleBots(1500)
      }, wait + 6500)
    } else {
      this.scheduleBots(wait)
    }
  }

  private scheduleBots(delay: number) {
    const m = this.match
    if (!m || m.phase !== 'playing' || !m.turn) return
    const bowler = m.turn.bowler
    const ballId = m.ballId
    if (this.isBot(bowler)) {
      this.later(() => {
        if (this.match?.ballId === ballId && this.match.turn?.stage === 'bowl') this.onBowl(bowler, botDelivery())
      }, delay)
    }
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms))
  }

  private clearTimers() {
    this.timers.forEach((t) => clearTimeout(t))
    this.timers = []
    if (this.shotTimeout) clearTimeout(this.shotTimeout)
    this.pending = null
  }

  pushLobby() {
    this.out.broadcast({ t: 'lobby', lobby: this.lobby })
  }

  close() {
    this.clearTimers()
  }
}

function clean(name: string) {
  return String(name ?? '').trim().slice(0, 16) || 'Player'
}

function clampInt(v: unknown, a: number, b: number) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : a
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

function validDelivery(d: Delivery) {
  return !!d && ['fast', 'swing', 'spin', 'yorker', 'bouncer', 'slower'].includes(d.type) && num(d.line) && num(d.length) && num(d.power) && num(d.turn) && num(d.seed)
}

function validShot(s: ShotInput) {
  return !!s && typeof s.swung === 'boolean' && num(s.dir) && typeof s.loft === 'boolean' && num(s.timing)
}
