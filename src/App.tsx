import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS } from './net/host'
import { RoomClient } from './net/client'
import type { MatchSettings } from './game/types'
import { Home } from './ui/Home'
import { Lobby } from './ui/Lobby'
import { GameScreen } from './ui/GameScreen'
import { sfx } from './render/sound'

function readRoomParam() {
  const p = new URLSearchParams(window.location.search)
  return p.get('room')?.toUpperCase() ?? ''
}

export default function App() {
  const [client, setClient] = useState<RoomClient | null>(null)
  const [inviteCode] = useState(readRoomParam)

  const leave = useCallback(() => {
    client?.leave()
    setClient(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    window.history.replaceState(null, '', url)
  }, [client])

  const begin = (name: string, action: { kind: 'create' } | { kind: 'join'; code: string } | { kind: 'practice'; settings: MatchSettings }) => {
    sfx.unlock()
    const c = new RoomClient(name)
    setClient(c)
    if (action.kind === 'create') void c.create(DEFAULT_SETTINGS)
    else if (action.kind === 'join') c.join(action.code)
    else c.practice(action.settings)
  }

  if (!client) return <Home inviteCode={inviteCode} onStart={begin} />
  return <Room client={client} onLeave={leave} />
}

function Room({ client, onLeave }: { client: RoomClient; onLeave: () => void }) {
  const snap = useSyncExternalStore(client.subscribe, client.getSnapshot)

  useEffect(() => {
    if (snap.lobby?.code && snap.lobby.code !== 'SOLO') {
      const url = new URL(window.location.href)
      url.searchParams.set('room', snap.lobby.code)
      window.history.replaceState(null, '', url)
    }
  }, [snap.lobby?.code])

  if (snap.status === 'error') {
    return (
      <Center>
        <div className="glass rounded-3xl p-8 max-w-sm text-center animate-rise">
          <div className="text-5xl mb-3">🏏</div>
          <h2 className="font-display text-4xl tracking-wide">Connection problem</h2>
          <p className="text-white/70 mt-2">{snap.error}</p>
          <button className="btn-primary mt-6 rounded-2xl px-6 py-3 font-bold w-full" onClick={onLeave}>
            Back to menu
          </button>
        </div>
      </Center>
    )
  }
  if (!snap.lobby) {
    return (
      <Center>
        <div className="text-center animate-rise">
          <div className="mx-auto h-14 w-14 rounded-full border-4 border-white/15 border-t-gold animate-spin" />
          <p className="mt-5 text-white/70">Connecting to room…</p>
          <button className="btn-ghost mt-6 rounded-xl px-5 py-2 text-sm" onClick={onLeave}>
            Cancel
          </button>
        </div>
      </Center>
    )
  }
  if (snap.match) return <GameScreen client={client} snap={snap} onLeave={onLeave} />
  return <Lobby client={client} snap={snap} onLeave={onLeave} />
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full grid place-items-center p-4 bg-[radial-gradient(ellipse_at_top,#1b2d63,#070b1a_70%)]">{children}</div>
}
