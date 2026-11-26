import Peer, { type DataConnection } from 'peerjs'
import { DEFAULT_SETTINGS, Room } from '../game/room'
import type { MatchSettings } from '../game/types'
import { type ClientMsg, type HostMsg, makeCode, PEER_PREFIX, type PeerHello } from './protocol'

export { DEFAULT_SETTINGS }

/**
 * Runs a Room inside this browser tab. Used for practice (offline) and as the
 * peer-to-peer fallback when the Socket.IO server can't be reached.
 */
export class BrowserHost {
  room: Room
  private peer: Peer | null = null
  private conns = new Map<string, DataConnection>()
  private myId: string
  local: (m: HostMsg) => void

  constructor(hostId: string, hostName: string, settings: MatchSettings, local: (m: HostMsg) => void) {
    this.local = local
    this.myId = hostId
    this.room = new Room('', hostId, hostName, settings, {
      send: (pid, msg) => {
        if (pid === this.myId) this.local(structuredClone(msg))
        else this.conns.get(pid)?.send(msg)
      },
      broadcast: (msg) => {
        this.local(structuredClone(msg))
        for (const c of this.conns.values()) if (c.open) c.send(msg)
      },
    })
  }

  openOffline() {
    this.room.lobby.code = 'SOLO'
    this.room.fillBots()
    if (!this.room.lobby.players.some((p) => p.team === 'B')) this.room.addBot('B')
    this.room.pushLobby()
  }

  open(): Promise<string> {
    return new Promise((resolve, reject) => {
      const tryOpen = (attempt: number) => {
        const code = makeCode()
        const peer = new Peer(PEER_PREFIX + code, { debug: 0 })
        peer.on('open', () => {
          this.peer = peer
          this.room.lobby.code = code
          this.room.pushLobby()
          resolve(code)
        })
        peer.on('error', (err: { type?: string }) => {
          if (err.type === 'unavailable-id' && attempt < 5) {
            peer.destroy()
            tryOpen(attempt + 1)
          } else if (!this.peer) {
            reject(new Error(err.type === 'network' || err.type === 'server-error' ? 'Could not reach the room relay. Check your internet.' : `Room error: ${err.type}`))
          }
        })
        peer.on('connection', (conn) => this.accept(conn))
        peer.on('disconnected', () => {
          if (this.peer && !this.peer.destroyed) this.peer.reconnect()
        })
      }
      tryOpen(0)
    })
  }

  private accept(conn: DataConnection) {
    let pid: string | null = null
    conn.on('data', (raw) => {
      const msg = raw as ClientMsg | PeerHello
      if (msg.t === 'hello') {
        pid = String(msg.pid).slice(0, 24)
        const old = this.conns.get(pid)
        if (old && old !== conn) old.close()
        const err = this.room.join(pid, msg.name)
        if (err) {
          conn.send({ t: 'error', text: err } satisfies HostMsg)
          setTimeout(() => conn.close(), 300)
          pid = null
          return
        }
        this.conns.set(pid, conn)
        return
      }
      if (pid) this.room.handle(pid, msg)
    })
    conn.on('close', () => {
      if (!pid || this.conns.get(pid) !== conn) return
      this.conns.delete(pid)
      this.room.disconnect(pid)
    })
  }

  handle(pid: string, msg: ClientMsg) {
    this.room.handle(pid, msg)
    if (msg.t === 'kick') {
      this.conns.get(msg.pid)?.close()
      this.conns.delete(msg.pid)
    }
  }

  close() {
    this.room.close()
    this.peer?.destroy()
  }
}
