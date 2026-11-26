import type { Innings, MatchState } from '../game/types'
import { oversText } from '../game/rules'
import { TEAM_COLORS } from '../render/scene'

const sr = (r: number, b: number) => (b ? ((r / b) * 100).toFixed(0) : '-')
const econ = (r: number, b: number) => (b ? ((r / b) * 6).toFixed(1) : '-')

export function Scorecard({ match }: { match: MatchState }) {
  return (
    <div className="mt-5 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {match.innings.map((inn, i) => (
          <InningsCard key={i} match={match} inn={inn} />
        ))}
      </div>
      <RunChart match={match} />
    </div>
  )
}

function InningsCard({ match, inn }: { match: MatchState; inn: Innings }) {
  const col = TEAM_COLORS[inn.batting]
  const bowlers = Object.entries(inn.bowlers)
  const batted = match.teams[inn.batting].filter((pid) => inn.batters[pid])
  const yetToBat = match.teams[inn.batting].filter((pid) => !inn.batters[pid])
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(7,11,26,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="px-4 py-2 flex justify-between items-center" style={{ background: `linear-gradient(120deg, ${col.main}, ${col.dark})` }}>
        <span className="font-display text-2xl tracking-wide">{match.settings.teamNames[inn.batting]}</span>
        <span className="font-display text-2xl">
          {inn.runs}/{inn.wickets} <span className="text-base opacity-80">({oversText(inn.balls)})</span>
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-white/40">
            <th className="px-4 pt-2 text-left font-normal">Batter</th>
            <th className="px-1 text-right font-normal">R</th>
            <th className="px-1 text-right font-normal">B</th>
            <th className="px-1 text-right font-normal">4/6</th>
            <th className="pr-4 text-right font-normal">SR</th>
          </tr>
        </thead>
        <tbody>
          {batted.map((pid) => {
            const b = inn.batters[pid]
            return (
              <tr key={pid} className="border-b border-white/5">
                <td className="px-4 py-1.5">
                  <div className="font-semibold leading-tight">{match.names[pid]}</div>
                  <div className="text-[11px] text-white/45">{b.out ? `${b.out}${(b.outs ?? 0) > 1 ? ` (out ${b.outs}×)` : ''}` : 'not out'}</div>
                </td>
                <td className="px-1 text-right font-bold">{b.runs}</td>
                <td className="px-1 text-right text-white/55">{b.balls}</td>
                <td className="px-1 text-right text-[11px] text-white/55">
                  {b.fours}/{b.sixes}
                </td>
                <td className="pr-4 text-right text-[11px] text-white/55">{sr(b.runs, b.balls)}</td>
              </tr>
            )
          })}
          <tr>
            <td className="px-4 py-1 text-white/50">Extras</td>
            <td className="px-1 text-right">{inn.extras}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
      {yetToBat.length > 0 && (
        <div className="px-4 pb-2 text-[11px] text-white/40">
          Yet to bat: {yetToBat.map((p) => match.names[p]).join(', ')}
        </div>
      )}
      {inn.fallOfWickets?.length > 0 && (
        <div className="px-4 py-1.5 text-[11px] text-white/50 border-t border-white/10">
          <span className="text-white/35 uppercase tracking-wider mr-1">FoW</span>
          {inn.fallOfWickets.map((f, k) => (
            <span key={k} className="mr-2">
              {f.runs}-{k + 1} ({match.names[f.batter]}, {oversText(f.balls)})
            </span>
          ))}
        </div>
      )}
      {bowlers.length > 0 && (
        <table className="w-full text-xs border-t border-white/10">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-white/40">
              <th className="px-4 pt-1.5 text-left font-normal">Bowler</th>
              <th className="px-1 text-right font-normal">O</th>
              <th className="px-1 text-right font-normal">R</th>
              <th className="px-1 text-right font-normal">W</th>
              <th className="pr-4 text-right font-normal">Econ</th>
            </tr>
          </thead>
          <tbody>
            {bowlers.map(([pid, b]) => (
              <tr key={pid}>
                <td className="px-4 py-1 text-white/80">{match.names[pid]}</td>
                <td className="px-1 text-right text-white/60">{oversText(b.balls)}</td>
                <td className="px-1 text-right text-white/60">{b.runs}</td>
                <td className="px-1 text-right font-bold">{b.wickets}</td>
                <td className="pr-4 text-right text-white/60">{econ(b.runs, b.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Cumulative runs per over for both innings ("worm" chart). */
function RunChart({ match }: { match: MatchState }) {
  const series = match.innings.map((inn) => ({ team: inn.batting, pts: [0, ...(inn.overRuns ?? [])] }))
  const maxRuns = Math.max(10, ...series.flatMap((s) => s.pts))
  const overs = Math.max(1, match.settings.overs)
  if (series.every((s) => s.pts.length < 2)) return null
  const W = 600
  const H = 160
  const x = (o: number) => 30 + (o / overs) * (W - 40)
  const y = (r: number) => H - 20 - (r / maxRuns) * (H - 34)
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(7,11,26,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/45 mb-1">Run progression (the worm)</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Runs by over">
        <line x1={30} y1={H - 20} x2={W - 10} y2={H - 20} stroke="rgba(255,255,255,0.2)" />
        <line x1={30} y1={10} x2={30} y2={H - 20} stroke="rgba(255,255,255,0.2)" />
        <text x={24} y={y(maxRuns) + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">
          {maxRuns}
        </text>
        <text x={W - 10} y={H - 6} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">
          {overs} ov
        </text>
        {series.map((s, i) => (
          <g key={i}>
            <polyline fill="none" stroke={TEAM_COLORS[s.team].main} strokeWidth={3} strokeLinejoin="round" points={s.pts.map((r, o) => `${x(Math.min(o, overs))},${y(r)}`).join(' ')} />
            {s.pts.map((r, o) => (
              <circle key={o} cx={x(Math.min(o, overs))} cy={y(r)} r={3} fill={TEAM_COLORS[s.team].main} />
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
