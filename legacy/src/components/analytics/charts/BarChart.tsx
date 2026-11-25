import type { ChartDataPoint } from '@/types/analytics'

type Props = {
  data: ChartDataPoint[]
  title?: string
  height?: number
  horizontal?: boolean
  maxBars?: number
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

export function BarChart({ data, title, height = 200, horizontal, maxBars = 20 }: Props) {
  const items = data.slice(0, maxBars)
  if (items.length === 0) return null

  const maxVal = Math.max(...items.map((d) => d.value), 1)
  const pad = 30
  const chartH = height - 24

  if (horizontal) {
    const barH = Math.max(20, Math.min(40, (chartH - items.length * 4) / items.length))
    const totalH = items.length * (barH + 4) + 24

    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        {title && <h3 className="mb-3 text-sm font-semibold text-gray-300">{title}</h3>}
        <svg width="100%" height={totalH} className="overflow-visible">
          {items.map((d, i) => {
            const w = (d.value / maxVal) * 200
            const y = i * (barH + 4) + 4
            return (
              <g key={i}>
                <text x={0} y={y + barH / 2 + 1} textAnchor="start" className="fill-gray-400 text-[10px]">{d.label}</text>
                <rect x={pad + 4} y={y} width={Math.max(w, 2)} height={barH} rx={3} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} opacity={0.8} />
                <text x={pad + 8 + Math.max(w, 2)} y={y + barH / 2 + 1} textAnchor="start" className="fill-gray-500 text-[10px]">{d.value}</text>
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  const barW = Math.max(8, Math.min(40, (600 - pad) / items.length - 4))

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      {title && <h3 className="mb-3 text-sm font-semibold text-gray-300">{title}</h3>}
      <svg width="100%" height={height} className="overflow-visible">
        {items.map((d, i) => {
          const h = (d.value / maxVal) * (chartH - 20)
          const x = i * (barW + 4) + pad
          const y = chartH - h
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} rx={2} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} opacity={0.8} />
              <text x={x + barW / 2} y={chartH + 12} textAnchor="middle" className="fill-gray-500 text-[9px]">{d.label}</text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-gray-400 text-[9px]">{d.value}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
