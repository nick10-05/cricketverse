/**
 * CricketVerse Arena game server.
 * - Socket.IO rooms, each running the same authoritative Room logic the browser uses.
 * - Serves the built front-end from ../dist so the whole game deploys as one web service.
 *
 * Run:  npm run server         (dev, port 3001; Vite proxies /socket.io to it)
 *       npm start              (production: serves dist + sockets on $PORT)
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server, type Socket } from 'socket.io'
import { DEFAULT_SETTINGS, Room } from '../src/game/room'
import type { MatchSettings } from '../src/game/types'
import { type ClientMsg, type HostMsg, makeCode, type ServerJoinAck } from '../src/net/protocol'

const PORT = Number(process.env.PORT ?? 3001)
const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const ROOM_IDLE_MS = 10 * 60 * 1000
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? 500)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
}

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }))
    return
  }
  // Static files with SPA fallback; never serve outside dist.
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)))
  if (!file.startsWith(DIST + sep) && file !== DIST) {
    res.writeHead(403).end()
    return
  }
  try {
    const s = await stat(file).catch(() => null)
    if (!s || s.isDirectory()) file = join(DIST, 'index.html')
    const body = await readFile(file)
    const ext = extname(file)
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('CricketVerse server is running. Build the client with `npm run build`.')
  }
})

const io = new Server(http, {
  cors: { origin: true },
  pingInterval: 10000,
  pingTimeout: 8000,
  maxHttpBufferSize: 64 * 1024,
})

interface RoomEntry {
  room: Room
  sockets: Map<string, Socket>
  idleTimer: ReturnType<typeof setTimeout> | null
}
const rooms = new Map<string, RoomEntry>()

function makeRoom(hostId: string, name: string, settings: MatchSettings): string {
  let code = makeCode()
  while (rooms.has(code)) code = makeCode()
  const entry: RoomEntry = {
    sockets: new Map(),
    idleTimer: null,
    room: null as unknown as Room,
  }
  const send = (pid: string, msg: HostMsg) => entry.sockets.get(pid)?.emit('msg', msg)
  entry.room = new Room(code, hostId, name, settings, {
    send,
    broadcast: (msg) => io.to(code).emit('msg', msg),
  })
  rooms.set(code, entry)
  return code
}

function scheduleCleanup(code: string) {
  const e = rooms.get(code)
  if (!e) return
  if (e.idleTimer) clearTimeout(e.idleTimer)
  if (e.room.connectedHumans() > 0) return
  e.idleTimer = setTimeout(() => {
    e.room.close()
    rooms.delete(code)
  }, ROOM_IDLE_MS)
}

const str = (v: unknown, max: number) => String(v ?? '').slice(0, max)

io.on('connection', (socket) => {
  let code: string | null = null
  let pid: string | null = null
  // Token bucket: 20 messages/second sustained, bursts of 40.
  let tokens = 40
  let last = Date.now()
  const allow = (cost = 1) => {
    const now = Date.now()
    tokens = Math.min(40, tokens + ((now - last) / 1000) * 20)
    last = now
    if (tokens < cost) return false
    tokens -= cost
    return true
  }

  const bind = (c: string, p: string) => {
    const e = rooms.get(c)!
    const old = e.sockets.get(p)
    if (old && old.id !== socket.id) old.disconnect(true)
    e.sockets.set(p, socket)
    if (e.idleTimer) clearTimeout(e.idleTimer)
    code = c
    pid = p
    void socket.join(c)
  }

  socket.on('create', (data: { pid: string; name: string; settings?: MatchSettings }, ack: (a: ServerJoinAck) => void) => {
    if (typeof ack !== 'function') return
    const p = str(data?.pid, 24)
    if (!p || !allow(5)) return ack({ ok: false, error: 'bad request' })
    if (rooms.size >= MAX_ROOMS) return ack({ ok: false, error: 'Server is full, try again soon' })
    const c = makeRoom(p, str(data?.name, 16), { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) })
    bind(c, p)
    ack({ ok: true, code: c })
    rooms.get(c)!.room.pushLobby()
  })

  socket.on('join', (data: { code: string; pid: string; name: string }, ack: (a: ServerJoinAck) => void) => {
    if (typeof ack !== 'function') return
    const c = str(data?.code, 5).toUpperCase()
    const p = str(data?.pid, 24)
    const e = rooms.get(c)
    if (!e || !p) return ack({ ok: false, error: 'Room not found' })
    const err = e.room.join(p, str(data?.name, 16))
    if (err) return ack({ ok: false, error: err })
    bind(c, p)
    ack({ ok: true, code: c })
    e.room.pushLobby()
  })

  socket.on('msg', (msg: ClientMsg) => {
    if (!code || !pid || !allow()) return
    const e = rooms.get(code)
    if (!e) return
    e.room.handle(pid, msg)
    if (msg?.t === 'kick') {
      e.sockets.get(msg.pid)?.disconnect(true)
      e.sockets.delete(msg.pid)
    }
  })

  socket.on('disconnect', () => {
    if (!code || !pid) return
    const e = rooms.get(code)
    if (!e || e.sockets.get(pid)?.id !== socket.id) return
    e.sockets.delete(pid)
    e.room.disconnect(pid)
    scheduleCleanup(code)
  })
})

http.listen(PORT, () => {
  console.log(`CricketVerse server on http://localhost:${PORT}`)
})
