// End-to-end smoke test: two clients play a full 1-over 1v1 match through the Socket.IO server.
// Usage: npm run server (in another terminal), then npx tsx scripts/smoke-server.ts
import { io, type Socket } from 'socket.io-client'
import type { HostMsg, ServerJoinAck } from '../src/net/protocol'
import type { MatchState } from '../src/game/types'

const URL = process.env.SERVER_URL ?? 'http://localhost:3001'
type Client = { s: Socket; id: string; match: MatchState | null }

function client(id: string): Client {
  const c: Client = { s: io(URL, { transports: ['websocket'] }), id, match: null }
  c.s.on('msg', (m: HostMsg) => {
    if (m.t === 'match' || m.t === 'replay') c.match = m.match
  })
  return c
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fail = (why: string) => {
  console.error('FAIL:', why)
  process.exit(1)
}

const a = client('smoke-a')
const b = client('smoke-b')
const created = (await a.s.timeout(3000).emitWithAck('create', { pid: a.id, name: 'Alpha', settings: { mode: '1v1', overs: 1, wickets: 2 } })) as ServerJoinAck
if (!created.ok || !created.code) fail('create: ' + created.error)
console.log('room', created.code)
const joined = (await b.s.timeout(3000).emitWithAck('join', { code: created.code, pid: b.id, name: 'Beta' })) as ServerJoinAck
if (!joined.ok) fail('join: ' + joined.error)
const bad = (await b.s.timeout(3000).emitWithAck('join', { code: 'ZZZZZ', pid: 'x', name: 'x' })) as ServerJoinAck
if (bad.ok) fail('joined a missing room')

console.log('joined'); a.s.emit('msg', { t: 'start' })
await sleep(300)
if (!a.match || !b.match) fail('match not broadcast')
const byId = { [a.id]: a, [b.id]: b }
let seed = 1
const deadline = Date.now() + 20 * 60_000
while (Date.now() < deadline) {
  const m = a.match!
  if (m.phase === 'done') break
  const t = m.turn
  if (m.phase !== 'playing' || !t) {
    await sleep(200)
    continue
  }
  const id = m.ballId
  byId[t.bowler].s.emit('msg', { t: 'bowl', delivery: { type: 'fast', line: 0.1, length: 0.4, power: 0.8, turn: 1, seed: seed++ } })
  await sleep(150)
  byId[t.striker].s.emit('msg', { t: 'shot', ballId: id, shot: { swung: true, dir: (seed % 3) - 1, loft: seed % 2 === 0, timing: (seed % 5) * 20 - 40 } })
  while (a.match!.ballId === id && Date.now() < deadline) await sleep(100)
}
const ma = a.match!, mb = b.match!
if (ma.phase !== 'done') fail('match did not finish')
if (JSON.stringify(ma) !== JSON.stringify(mb)) fail('clients disagree on final state')
console.log('scores', ma.innings.map((i) => `${i.runs}/${i.wickets} (${i.balls} balls)`).join(' vs '), '→', ma.result?.text ?? ma.result)
console.log('PASS')
a.s.close()
b.s.close()
process.exit(0)
