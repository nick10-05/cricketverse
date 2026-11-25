type Props = {
  value: number
  max?: number
  color?: string
}

export function RatingBar({ value, max = 1000, color = 'emerald' }: Props) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-right text-sm font-semibold text-white">{value}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-700">
        <div className={`h-full rounded-full transition-all ${colorMap[color] ?? 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
