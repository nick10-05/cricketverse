import type { MatchRecord, MatchState, TeamId } from '../game/types'

/** Match history and career stats, kept in this browser only (no account, no server). */

const KEY = 'cvx-history-v1'
const MAX = 50
const saved = new Set<number>()

export function loadHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as MatchRecord[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function recordMatch(m: MatchState, myId: string) {
  if (!m.result || saved.has(m.startedAt)) return
  saved.add(m.startedAt)
  const myTeam = (['A', 'B'] as TeamId[]).find((t) => m.teams[t].includes(myId)) ?? null
  let me: MatchRecord['me']
  if (myTeam) {
    let runs = 0
    let balls = 0
    let wickets = 0
    let conceded = 0
    let bowled = 0
    for (const inn of m.innings) {
      const b = inn.batters[myId]
      if (b) {
        runs += b.runs
        balls += b.balls
      }
      const w = inn.bowlers[myId]
      if (w) {
        wickets += w.wickets
        conceded += w.runs
        bowled += w.balls
      }
    }
    me = { name: m.names[myId] ?? 'You', runs, balls, wickets, conceded, bowled, won: m.result.winner ? m.result.winner === myTeam : null }
  }
  const rec: MatchRecord = {
    at: m.startedAt,
    teamNames: m.settings.teamNames,
    scores: m.innings.map((i) => `${m.settings.teamNames[i.batting]} ${i.runs}/${i.wickets} (${Math.floor(i.balls / 6)}.${i.balls % 6})`),
    result: m.result.text,
    overs: m.settings.overs,
    mode: m.settings.mode,
    me,
  }
  const list = [rec, ...loadHistory().filter((r) => r.at !== rec.at)].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage full or blocked */
  }
}

export interface Career {
  matches: number
  wins: number
  losses: number
  runs: number
  balls: number
  best: number
  wickets: number
  conceded: number
  bowled: number
}

export function career(list = loadHistory()): Career {
  const c: Career = { matches: 0, wins: 0, losses: 0, runs: 0, balls: 0, best: 0, wickets: 0, conceded: 0, bowled: 0 }
  for (const r of list) {
    if (!r.me) continue
    c.matches++
    if (r.me.won === true) c.wins++
    if (r.me.won === false) c.losses++
    c.runs += r.me.runs
    c.balls += r.me.balls
    c.best = Math.max(c.best, r.me.runs)
    c.wickets += r.me.wickets
    c.conceded += r.me.conceded
    c.bowled += r.me.bowled
  }
  return c
}
