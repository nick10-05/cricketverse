import { useEffect, useState } from 'react'
import type { ChatLine, RoomClient } from '../net/client'

export function Toast({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-black/80 border border-white/15 px-4 py-2 text-sm animate-rise">
      {text}
    </div>
  )
}

const QUICK = ['Nice shot! 🔥', 'Well bowled 👏', 'Haha 😂', 'Come on! 💪', 'Unlucky 😬', 'GG 🤝']

export function QuickChat({ client, chat, inline = false }: { client: RoomClient; chat: ChatLine[]; inline?: boolean }) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Float the newest messages for a few seconds during a match.
  useEffect(() => {
    if (inline) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [inline])
  const recent = chat.filter((c) => now - c.at < 4000).slice(-3)

  const send = (text: string) => {
    client.send({ t: 'chat', text })
    setOpen(false)
  }

  if (inline) {
    return (
      <div className="glass rounded-3xl p-4">
        <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Room chat</div>
        <div className="max-h-32 overflow-y-auto space-y-1 text-sm mb-3">
          {chat.length === 0 && <div className="text-white/35">Say hi to your opponents 👋</div>}
          {chat.map((c) => (
            <div key={c.at + c.from}>
              <span className="text-gold font-semibold">{c.name}:</span> <span className="text-white/80">{c.text}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} className="btn-ghost rounded-full px-3 py-1 text-xs">
              {q}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-28 z-20 space-y-1.5">
        {recent.map((c) => (
          <div key={c.at + c.from} className="animate-rise rounded-2xl bg-black/60 border border-white/10 px-3 py-1.5 text-sm">
            <span className="text-gold font-semibold">{c.name}</span> {c.text}
          </div>
        ))}
      </div>
      <div className="absolute right-3 top-28 z-30 flex flex-col items-end gap-1.5">
        <button onClick={() => setOpen((o) => !o)} className="h-10 w-10 rounded-full bg-black/50 border border-white/15 text-lg">
          💬
        </button>
        {open &&
          QUICK.map((q) => (
            <button key={q} onClick={() => send(q)} className="animate-rise rounded-full bg-black/70 border border-white/15 px-3 py-1.5 text-xs whitespace-nowrap">
              {q}
            </button>
          ))}
      </div>
    </>
  )
}
