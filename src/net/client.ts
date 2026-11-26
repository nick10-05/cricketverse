import Peer, { type DataConnection } from 'peerjs'
import { io, type Socket } from 'socket.io-client'
import type { LobbyState, MatchSettings, MatchState } from '../game/types'
import { BrowserHost, DEFAULT_SETTINGS } from './host'
import { canStartLobby } from '../game/room'
import { type ClientMsg, type HostMsg, makeId, PEER_PREFIX, type PeerHello, type ServerJoinAck } from './protocol'

export type GameEvent = Extract<HostMsg, { t: 'ball' } | { t: 'replay' }>
export interface ChatLine {
  from: string
  name: string
  text: string
  at: number
}

export type Transport = 'local' | 'server' | 'peer'

export interface RoomSnapshot {
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed'
  error: string | null
  toast: string | null
  myId: string
  transport: Transport | null
  lobby: LobbyState | null
  match: MatchState | null
  chat: ChatLine[]
}

export function myPlayerId() {
  try {
    let id = sessionStorage.getItem('cvx-pid')
    if (!id) {
      id = makeId()
      sessionStorage.setItem('cvx-pid', id)
    }
    return id
  } catch {
    return makeId()
  }
}

const SERVER_URL: string = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? window.location.origin

/**
 * Everything the UI needs about a room. Three transports, same API:
 *  - server: Socket.IO game server (preferred, survives the host leaving)
 *  - peer:   PeerJS peer-to-peer, the host's browser runs the room (fallback)
 *  - local:  practice vs bots, no network
 */
export class RoomClient {
  snap: RoomSnapshot
  private listeners = new Set<() => void>()
  private eventListeners = new Set<(e: GameEvent) => void>()
  private host: BrowserHost | null = null
  private socket: Socket | null = null
  private peer: Peer | null = null
  private conn: DataConnection | null = null
  private name: string
  private toastTimer: ReturnType<typeof setTimeout> | undefined
  private roomCode = ''

  constructor(name: string) {
    this.name = name
    this.snap = { status: 'idle', error: null, toast: null, myId: myPlayerId(), transport: null, lobby: null, match: null, chat: [] }
  }

  get isHost() {
    return this.snap.lobby?.hostId === this.snap.myId
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  getSnapshot = () => this.snap
  onEvent(fn: (e: GameEvent) => void) {
    this.eventListeners.add(fn)
    return () => {
      this.eventListeners.delete(fn)
    }
  }

  private set(patch: Partial<RoomSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    this.listeners.forEach((l) => l())
  }

  private receive = (msg: HostMsg) => {
    switch (msg.t) {
      case 'lobby':
        this.set({ lobby: msg.lobby, status: 'connected' })
        break
      case 'match':
        this.set({ match: msg.match })
        break
      case 'ball':
        this.eventListeners.forEach((l) => l(msg))
        break
      case 'replay':
        // The game screen freezes the scoreboard until its animation has played.
        this.eventListeners.forEach((l) => l(msg))
        this.set({ match: msg.match })
        break
      case 'chat':
        this.set({ chat: [...this.snap.chat.slice(-40), msg] })
        break
      case 'error':
        this.showToast(msg.text)
        break
      case 'kicked':
        this.leave()
        this.set({ status: 'error', error: 'The host removed you from the room.' })
        break
    }
  }

  showToast(text: string) {
    clearTimeout(this.toastTimer)
    this.set({ toast: text })
    this.toastTimer = setTimeout(() => this.set({ toast: null }), 2800)
  }

  // ------------------------------------------------------------------ server

  private connectServer(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const s = io(SERVER_URL, { transports: ['websocket', 'polling'], timeout: 5000, reconnectionAttempts: Infinity })
      const fail = setTimeout(() => {
        s.close()
        reject(new Error('timeout'))
      }, 6000)
      s.once('connect', () => {
        clearTimeout(fail)
        resolve(s)
      })
      s.once('connect_error', () => {
        clearTimeout(fail)
        s.close()
        reject(new Error('unreachable'))
      })
    })
  }

  private bindSocket(s: Socket) {
    this.socket = s
    s.on('msg', (m: HostMsg) => this.receive(m))
    s.on('disconnect', () => {
      if (this.snap.status !== 'closed') this.set({ status: 'reconnecting' })
    })
    // Rejoin automatically after a dropped connection.
    s.io.on('reconnect', () => {
      s.emit('join', { code: this.roomCode, pid: this.snap.myId, name: this.name }, (ack: ServerJoinAck) => {
        if (!ack.ok) this.set({ status: 'error', error: 'The room has closed.' })
      })
    })
  }

  // ------------------------------------------------------------------ public API

  async create(settings: MatchSettings = DEFAULT_SETTINGS) {
    this.set({ status: 'connecting', error: null })
    try {
      const s = await this.connectServer()
      this.bindSocket(s)
      const ack: ServerJoinAck = await s.timeout(5000).emitWithAck('create', { pid: this.snap.myId, name: this.name, settings })
      if (!ack.ok || !ack.code) throw new Error(ack.error ?? 'create failed')
      this.roomCode = ack.code
      this.set({ transport: 'server' })
      return
    } catch {
      this.socket?.close()
      this.socket = null
    }
    // Fallback: host the room in this browser, peer-to-peer.
    this.host = new BrowserHost(this.snap.myId, this.name, settings, this.receive)
    this.set({ transport: 'peer' })
    try {
      this.roomCode = await this.host.open()
    } catch (e) {
      this.set({ status: 'error', error: (e as Error).message })
    }
  }

  practice(settings: MatchSettings) {
    this.set({ status: 'connecting', error: null, transport: 'local' })
    this.host = new BrowserHost(this.snap.myId, this.name, settings, this.receive)
    this.host.openOffline()
    this.send({ t: 'start' })
  }

  async join(code: string) {
    code = code.trim().toUpperCase()
    this.roomCode = code
    this.set({ status: 'connecting', error: null })
    try {
      const s = await this.connectServer()
      // Listen before asking: the lobby can arrive right alongside the ack.
      this.bindSocket(s)
      const ack: ServerJoinAck = await s.timeout(5000).emitWithAck('join', { code, pid: this.snap.myId, name: this.name })
      if (ack.ok) {
        this.set({ transport: 'server' })
        return
      }
      s.close()
      this.socket = null
      // The server knows the room but refused us (locked / full): don't fall back to peer-to-peer.
      if (ack.error && ack.error !== 'Room not found') {
        this.set({ status: 'error', error: ack.error })
        return
      }
    } catch {
      /* server unreachable: try peer-to-peer */
      this.socket?.close()
      this.socket = null
    }
    this.joinPeer(code)
  }

  private joinPeer(code: string) {
    this.set({ transport: 'peer' })
    const peer = new Peer({ debug: 0 })
    this.peer = peer
    const fail = (text: string) => this.set({ status: 'error', error: text })
    const timer = setTimeout(() => {
      if (this.snap.status === 'connecting') fail(`Couldn't find room ${code}. Check the code and that the host is still in the lobby.`)
    }, 12000)
    peer.on('open', () => {
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true })
      this.conn = conn
      conn.on('open', () => {
        clearTimeout(timer)
        conn.send({ t: 'hello', pid: this.snap.myId, name: this.name } satisfies PeerHello)
      })
      conn.on('data', (d) => this.receive(d as HostMsg))
      conn.on('close', () => {
        if (this.snap.status !== 'closed') this.set({ status: 'error', error: 'Disconnected from the host.' })
      })
    })
    peer.on('error', (err: { type?: string }) => {
      clearTimeout(timer)
      if (err.type === 'peer-unavailable') fail(`Room ${code} not found.`)
      else if (this.snap.status !== 'connected') fail(`Connection failed (${err.type}).`)
    })
  }

  send(msg: ClientMsg) {
    if (this.host) this.host.handle(this.snap.myId, msg)
    else if (this.socket) this.socket.emit('msg', msg)
    else if (this.conn?.open) this.conn.send(msg)
  }

  canStart(): string | null {
    const L = this.snap.lobby
    if (!L) return 'Not connected'
    return canStartLobby(L)
  }

  leave() {
    this.set({ status: 'closed' })
    this.host?.close()
    this.socket?.close()
    this.conn?.close()
    this.peer?.destroy()
  }
}
