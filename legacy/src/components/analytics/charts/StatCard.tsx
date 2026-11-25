type Props = {
  label: string
  value: string | number
  subtitle?: string
  icon?: string
  trend?: 'up' | 'down' | 'neutral'
}

export function StatCard({ label, value, subtitle, icon, trend }: Props) {
  const trendColors = { up: 'text-emerald-400', down: 'text-red-400', neutral: 'text-gray-400' }
  const trendArrows = { up: '↑', down: '↓', neutral: '→' }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 transition-colors hover:border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-white">{value}</div>
          {subtitle && <div className="mt-1 text-xs text-gray-600">{subtitle}</div>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {icon && <span className="text-xl">{icon}</span>}
          {trend && (
            <span className={`text-xs font-medium ${trendColors[trend]}`}>
              {trendArrows[trend]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
