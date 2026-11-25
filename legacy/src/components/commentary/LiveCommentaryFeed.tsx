import { useEffect, useRef } from 'react'
import type { CommentaryLine, ExcitementLevel } from '@/lib/commentary-engine'
import { EXCITEMENT_CONFIG } from '@/lib/commentary-engine'

type Props = {
  lines: CommentaryLine[]
  maxHeight?: string
}

const TYPE_ICONS: Record<string, string> = {
  ball: '',
  milestone: '🏆 ',
  summary: '📊 ',
  analysis: '💡 ',
  strategic: '🎯 ',
}

const TYPE_BG: Record<string, string> = {
  ball: 'bg-gray-900/40',
  milestone: 'bg-yellow-500/10 border-yellow-500/20',
  summary: 'bg-blue-500/5 border-blue-500/10',
  analysis: 'bg-purple-500/5 border-purple-500/10',
  strategic: 'bg-green-500/5 border-green-500/10',
}

export function LiveCommentaryFeed({ lines, maxHeight = '400px' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div
      className="overflow-y-auto rounded-xl border border-gray-800 bg-gray-950"
      style={{ maxHeight }}
    >
      {lines.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-600">Commentary will appear here...</p>
        </div>
      ) : (
        <div className="space-y-0.5 p-3">
          {lines.map((line) => {
            const cfg = EXCITEMENT_CONFIG[line.excitement]
            const icon = TYPE_ICONS[line.type] ?? ''

            return (
              <div
                key={line.id}
                className={`rounded-lg border border-transparent px-3 py-2 text-sm transition-colors ${TYPE_BG[line.type] ?? ''}`}
              >
                <div className="flex items-start gap-2">
                  {line.excitement >= 3 && (
                    <span className="shrink-0 text-xs">{cfg.prefix}</span>
                  )}
                  <p className={`flex-1 leading-relaxed ${line.excitement >= 3 ? 'font-medium' : ''} ${cfg.color}`}>
                    {icon}{line.text}
                  </p>
                  {line.excitement >= 2 && (
                    <ExcitementBadge level={line.excitement} />
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

function ExcitementBadge({ level }: { level: ExcitementLevel }) {
  const colors: Record<number, string> = {
    2: 'bg-blue-500/20 text-blue-400',
    3: 'bg-yellow-500/20 text-yellow-400',
    4: 'bg-orange-500/20 text-orange-400',
    5: 'bg-red-500/20 text-red-400',
  }

  if (level < 2) return null

  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${colors[level] ?? ''}`}>
      {EXCITEMENT_CONFIG[level].label}
    </span>
  )
}
