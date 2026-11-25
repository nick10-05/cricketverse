type Props = {
  rank: number
}

export function RankingBadge({ rank }: Props) {
  const colors: Record<number, string> = {
    1: 'border-yellow-500 bg-yellow-500/20 text-yellow-400',
    2: 'border-gray-300 bg-gray-300/20 text-gray-200',
    3: 'border-amber-700 bg-amber-700/20 text-amber-500',
  }

  const cls = colors[rank] ?? 'border-gray-700 bg-gray-800 text-gray-400'

  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${cls}`}>
      {rank}
    </span>
  )
}
