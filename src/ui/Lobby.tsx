import { useState } from 'react'
import type { RoomClient, RoomSnapshot } from '../net/client'
import type { GameMode, MatchSettings, Player, TeamId } from '../game/types'
import { teamSizeFor } from '../game/rules'
import { TEAM_COLORS } from '../render/scene'
import { QuickChat, Toast } from './bits'

const MODES: { id: GameMode; label: string; sub: string }[] = [
  { id: '1v1', label: '1v1', sub: 'Duel' },
  { id: '2v2', label: '2v2', sub: 'Pairs' },
  { id: '3v3', label: '3v3', sub: 'Trios' },
  { id: '4v4', label: '4v4', sub: 'Squads' },
  { id: '5v5', label: '5v5', sub: 'Full' },
  { id: 'team', label: 'Teams', sub: 'Any size' },
]

export function Lobby({ client, snap, onLeave }: { client: RoomClient; snap: RoomSnapshot; onLeave: () => void }) {
  const lobby = snap.lobby!
  const s = lobby.settings
  const isHost = snap.lobby?.hostId === snap.myId
  const me = lobby.players.find((p) => p.id === snap.myId)
  const [copied, setCopied] = useState(false)
  const startError = isHost ? client.canStart() : null
  const size = teamSizeFor(s.mode)

  const update = (patch: Partial<MatchSettings>) => {
    const next = { ...s, ...patch }
    if (patch.mode) {
      const n = teamSizeFor(patch.mode)
      next.wickets = n === null ? Math.max(2, Math.min(10, lobby.players.length)) : n === 1 ? 3 : Math.min(10, n + 1)
    }
    client.send({ t: 'settings', settings: next })
  }

  const invite = `${window.location.origin}${window.location.pathname}?room=${lobby.code}`
  const copy = async () => {
    const text = `Join my CricketVerse match! Room code: ${lobby.code}\n${invite}`
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) await navigator.share({ title: 'CricketVerse Arena', text })
      else await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* cancelled */
    }
  }

  const spectators = lobby.players.filter((p) => !p.team)

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#1b2d63,#070b1a_65%)] px-4 py-5 sm:py-8">
      <Toast text={snap.toast} />
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <button className="btn-ghost rounded-xl px-3 py-2 text-sm" onClick={onLeave}>
            ← Leave
          </button>
          <div className="font-display text-2xl tracking-wider text-white/80">
            CRICKET<span className="text-gold">VERSE</span>
          </div>
          <div className="w-16" />
        </div>

        {/* Room code */}
        <div className="glass rounded-3xl mt-5 p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 justify-between animate-rise">
          <div className="text-center sm:text-left">
            <div className="text-xs uppercase tracking-[0.3em] text-white/55">Room code</div>
            <div className="font-display text-6xl sm:text-7xl tracking-[0.25em] text-gold leading-none mt-1">{lobby.code}</div>
            <div className="text-sm text-white/60 mt-1">Share it with friends so they can join</div>
          </div>
          <button onClick={copy} className="btn-primary rounded-2xl px-6 py-3 font-bold min-w-44">
            {copied ? '✓ Copied!' : '🔗 Copy invite'}
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4 mt-4">
          <div className="space-y-4">
            {/* Teams */}
            <div className="grid sm:grid-cols-2 gap-4">
              {(['A', 'B'] as TeamId[]).map((t) => (
                <TeamColumn
                  key={t}
                  team={t}
                  name={s.teamNames[t]}
                  players={lobby.players.filter((p) => p.team === t)}
                  size={size}
                  myId={snap.myId}
                  hostId={lobby.hostId}
                  isHost={isHost}
                  myTeam={me?.team ?? null}
                  onJoin={() => client.send({ t: 'setTeam', team: t })}
                  onBot={() => client.send({ t: 'addBot', team: t })}
                  onKick={(pid) => client.send({ t: 'kick', pid })}
                  onRename={(n) => update({ teamNames: { ...s.teamNames, [t]: n } })}
                />
              ))}
            </div>
            {spectators.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Not in a team</div>
                <div className="flex flex-wrap gap-2">
                  {spectators.map((p) => (
                    <span key={p.id} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                      {p.name}
                      {p.id === snap.myId && ' (you)'}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {me?.team && (
              <button className="text-sm text-white/50 underline" onClick={() => client.send({ t: 'setTeam', team: null })}>
                Sit out (spectate)
              </button>
            )}
          </div>

          {/* Settings */}
          <div className="glass rounded-3xl p-5 space-y-5 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-3xl tracking-wide">Match setup</h3>
              {!isHost && <span className="text-xs text-white/50">Host decides</span>}
            </div>
            <div>
              <Label>Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    disabled={!isHost}
                    onClick={() => update({ mode: m.id })}
                    className={`rounded-xl py-2 transition ${s.mode === m.id ? 'bg-gold text-ink shadow-[0_4px_0_#b9790a]' : 'bg-white/5 text-white/80 disabled:opacity-60'}`}
                  >
                    <div className="font-display text-2xl leading-none">{m.label}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-70">{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>
                Overs <span className="text-gold">{s.overs}</span>
              </Label>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((o) => (
                  <button
                    key={o}
                    disabled={!isHost}
                    onClick={() => update({ overs: o })}
                    className={`rounded-lg py-2 font-bold ${s.overs === o ? 'bg-gold text-ink' : 'bg-white/5 text-white/75 disabled:opacity-60'}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Wickets per side</Label>
              <div className="flex items-center gap-3">
                <Step disabled={!isHost || s.wickets <= 1} onClick={() => update({ wickets: s.wickets - 1 })}>
                  −
                </Step>
                <div className="font-display text-4xl w-10 text-center">{s.wickets}</div>
                <Step disabled={!isHost || s.wickets >= 10} onClick={() => update({ wickets: s.wickets + 1 })}>
                  +
                </Step>
              </div>
            </div>
            {isHost ? (
              <div>
                <button disabled={!!startError} onClick={() => client.send({ t: 'start' })} className="btn-primary w-full rounded-2xl py-4 font-display text-3xl tracking-wider">
                  Start match
                </button>
                {startError && <p className="text-xs text-amber-200/80 mt-2 text-center">{startError}</p>}
              </div>
            ) : (
              <div className="rounded-2xl bg-black/30 p-4 text-center text-white/70 text-sm">
                <div className="mx-auto mb-2 h-6 w-6 rounded-full border-2 border-white/20 border-t-gold animate-spin" />
                Waiting for the host to start…
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <QuickChat client={client} chat={snap.chat} inline />
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-widest text-white/55 mb-2">{children}</div>
}

function Step(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold disabled:opacity-30" />
}

function TeamColumn(props: {
  team: TeamId
  name: string
  players: Player[]
  size: number | null
  myId: string
  hostId: string
  isHost: boolean
  myTeam: TeamId | null
  onJoin: () => void
  onBot: () => void
  onKick: (pid: string) => void
  onRename: (n: string) => void
}) {
  const { team, players, size, isHost } = props
  const col = TEAM_COLORS[team]
  const full = size !== null && players.length >= size
  const slots = size ?? Math.max(players.length, 1)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.name)
  return (
    <div className="rounded-3xl overflow-hidden glass animate-rise">
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: `linear-gradient(120deg, ${col.main}, ${col.dark})` }}>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 14))}
            onBlur={() => {
              setEditing(false)
              props.onRename(draft.trim() || props.name)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="bg-black/20 rounded-lg px-2 font-display text-3xl tracking-wide w-40 outline-none"
          />
        ) : (
          <button className="font-display text-3xl tracking-wide text-left" disabled={!isHost} onClick={() => setEditing(true)} title={isHost ? 'Rename team' : ''}>
            {props.name} {isHost && <span className="text-base opacity-70">✎</span>}
          </button>
        )}
        <div className="text-sm font-semibold bg-black/25 rounded-full px-2.5 py-0.5">
          {players.length}
          {size !== null && `/${size}`}
        </div>
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: slots }, (_, i) => players[i]).map((p, i) =>
          p ? (
            <div key={p.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2.5">
              <div className="h-9 w-9 rounded-full grid place-items-center font-bold text-sm" style={{ background: col.main }}>
                {p.isBot ? '🤖' : p.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {p.name}
                  {p.id === props.myId && <span className="text-gold"> (you)</span>}
                </div>
                <div className="text-[11px] text-white/45">
                  {p.id === props.hostId ? 'Host' : p.isBot ? 'Bot' : p.connected ? 'Ready' : 'Reconnecting…'}
                </div>
              </div>
              {isHost && p.id !== props.hostId && (
                <button onClick={() => props.onKick(p.id)} className="text-white/40 hover:text-red-300 px-2" title="Remove">
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div key={`empty-${i}`} className="rounded-xl border border-dashed border-white/15 px-3 py-3 text-sm text-white/35 text-center">
              Open slot
            </div>
          ),
        )}
        <div className="flex gap-2 pt-1">
          {props.myTeam !== team && (!full || players.some((p) => p.isBot)) && (
            <button onClick={props.onJoin} className="flex-1 rounded-xl py-2 text-sm font-bold" style={{ background: col.main }}>
              Join {props.name}
            </button>
          )}
          {isHost && !full && (
            <button onClick={props.onBot} className="flex-1 btn-ghost rounded-xl py-2 text-sm font-semibold">
              + Add bot
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
