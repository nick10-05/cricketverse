type Column<T> = {
  key: string
  label: string
  render: (item: T, index: number) => React.ReactNode
  className?: string
}

type Props<T> = {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
}

export function RankingTable<T>({ columns, data, emptyMessage = 'No data' }: Props<T>) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 font-medium text-gray-400 ${col.className ?? ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i} className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.render(item, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
