import type { ChartDataPoint } from '@/types/analytics'

type Props = {
  data: ChartDataPoint[]
  title?: string
  size?: number
  donut?: boolean
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

export function PieChart({ data, title, size = 180, donut }: Props) {
  if (data.length === 0) return null

  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 16
  const innerR = donut ? r * 0.55 : 0

  const arcs: string[] = []
  let cumAng = -Math.PI / 2

  for (const d of data) {
    const frac = d.value / total
    const ang = frac * Math.PI * 2
    const lx = cx + r * Math.cos(cumAng + ang)
    const ly = cy + r * Math.sin(cumAng + ang)
    const lx2 = cx + innerR * Math.cos(cumAng + ang)
    const ly2 = cy + innerR * Math.sin(cumAng + ang)
    const sx = cx + r * Math.cos(cumAng)
    const sy = cy + r * Math.sin(cumAng)
    const sx2 = cx + innerR * Math.cos(cumAng)
    const sy2 = cy + innerR * Math.sin(cumAng)
    const large = ang > Math.PI ? 1 : 0

    if (donut) {
      arcs.push(`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${lx} ${ly} L ${lx2} ${ly2} A ${innerR} ${innerR} 0 ${large} 0 ${sx2} ${sy2} Z`)
    } else {
      arcs.push(`M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${lx} ${ly} Z`)
    }
    cumAng += ang
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      {title && <h3 className="mb-3 text-sm font-semibold text-gray-300">{title}</h3>}
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((d, i) => (
            <path key={i} d={d} fill={COLORS[i % COLORS.length]} opacity={0.85} />
          ))}
        </svg>
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-gray-400">{d.label}</span>
              <span className="font-medium text-white">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
