import type { MatchState } from '../game/types'
import { oversText } from '../game/rules'
import { TEAM_COLORS } from '../render/scene'

export function Scorecard({ match }: { match: MatchState }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 mt-5">
      {match.innings.map((inn, i) => {
        const col = TEAM_COLORS[inn.batting]
        const bowlers = Object.entries(inn.bowlers)
        return (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(7,11,26,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="px-4 py-2 flex justify-between items-center" style={{ background: `linear-gradient(120deg, ${col.main}, ${col.dark})` }}>
              <span className="font-display text-2xl tracking-wide">{match.settings.teamNames[inn.batting]}</span>
              <span className="font-display text-2xl">
                {inn.runs}/{inn.wickets} <span className="text-base opacity-80">({oversText(inn.balls)})</span>
              </span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {match.teams[inn.batting].map((pid) => {
                  const b = inn.batters[pid]
                  return (
                    <tr key={pid} className="border-b border-white/5">
                      <td className="px-4 py-1.5">
                        <div className="font-semibold">{match.names[pid]}</div>
                        <div className="text-[11px] text-white/45">{b ? (b.out ?? 'not out') : 'did not bat'}</div>
                      </td>
                      <td className="px-2 text-right font-bold">{b ? b.runs : '-'}</td>
                      <td className="px-2 text-right text-white/50">{b ? `(${b.balls})` : ''}</td>
                      <td className="pr-4 text-right text-[11px] text-white/50">{b && (b.fours || b.sixes) ? `${b.fours}×4 ${b.sixes}×6` : ''}</td>
                    </tr>
                  )
                })}
                {inn.extras > 0 && (
                  <tr>
                    <td className="px-4 py-1 text-white/50">Extras</td>
                    <td className="px-2 text-right">{inn.extras}</td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
            {bowlers.length > 0 && (
              <div className="px-4 py-2 text-xs text-white/60 border-t border-white/10">
                {bowlers.map(([pid, b]) => (
                  <span key={pid} className="mr-3">
                    ⚾ {match.names[pid]} {b.wickets}-{b.runs} ({oversText(b.balls)})
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
