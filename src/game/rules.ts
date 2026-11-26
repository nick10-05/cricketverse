import type { BallOutcome, Innings, MatchSettings, MatchState, TeamId } from './types'

export const other = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A')

export const MAX_TEAM = 11
export const MAX_OVERS = 30
export const OVER_PRESETS = [1, 2, 3, 5, 10, 15, 20, 25, 30]

export function teamSizeFor(mode: MatchSettings['mode']): number | null {
  if (mode === 'team') return null
  const n = parseInt(mode, 10)
  return Number.isFinite(n) ? Math.max(1, Math.min(MAX_TEAM, n)) : 1
}

export function isMode(v: unknown): v is MatchSettings['mode'] {
  if (v === 'team') return true
  if (typeof v !== 'string') return false
  const m = /^(\d{1,2})v(\d{1,2})$/.exec(v)
  return !!m && m[1] === m[2] && +m[1] >= 1 && +m[1] <= MAX_TEAM
}

/** Most wickets a side can be given: lives for a lone batter, otherwise the whole team ("last man stands"). */
export function wicketCap(teamSize: number) {
  return teamSize <= 1 ? 10 : teamSize
}

/** A sensible default number of wickets for a team size. */
export function defaultWickets(teamSize: number) {
  if (teamSize <= 1) return 3
  if (teamSize <= 5) return teamSize // last man stands in small teams
  return teamSize - 1
}

function newInnings(batting: TeamId, size: number, target: number | null): Innings {
  return {
    batting,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: 0,
    striker: 0,
    nonStriker: size > 1 ? 1 : -1,
    nextBat: Math.min(2, size),
    bowlerIdx: 0,
    lastBowler: -1,
    freeHit: false,
    fours: 0,
    sixes: 0,
    overRuns: [],
    fallOfWickets: [],
    thisOver: [],
    batters: {},
    bowlers: {},
    target,
  }
}

export function createMatch(
  settings: MatchSettings,
  teams: Record<TeamId, string[]>,
  names: Record<string, string>,
  tossWinner: TeamId,
  batFirst: TeamId,
): MatchState {
  const cap = (t: TeamId) => Math.max(1, Math.min(settings.wickets, wicketCap(teams[t].length)))
  const m: MatchState = {
    phase: 'playing',
    settings,
    teams,
    names,
    tossWinner,
    innings: [newInnings(batFirst, teams[batFirst].length, null)],
    current: 0,
    ballId: 0,
    turn: null,
    result: null,
    lastOutcome: null,
    startedAt: Date.now(),
    maxWickets: { A: cap('A'), B: cap('B') },
  }
  m.turn = nextTurn(m)
  return m
}

export function maxWickets(m: MatchState, batting: TeamId) {
  return m.maxWickets?.[batting] ?? m.settings.wickets
}

export function currentInnings(m: MatchState) {
  return m.innings[m.current]
}

export function strikerOf(m: MatchState, inn: Innings) {
  const team = m.teams[inn.batting]
  return team[inn.striker % team.length]
}

export function nonStrikerOf(m: MatchState, inn: Innings): string | null {
  if (inn.nonStriker < 0) return null
  const team = m.teams[inn.batting]
  return team[inn.nonStriker % team.length]
}

export function bowlerOf(m: MatchState, inn: Innings) {
  const team = m.teams[other(inn.batting)]
  return team[inn.bowlerIdx % team.length]
}

/** Most overs one bowler may bowl: overs shared out evenly across the side. */
export function bowlerQuota(m: MatchState, bowlingTeam: TeamId) {
  return Math.ceil(m.settings.overs / Math.max(1, m.teams[bowlingTeam].length))
}

function nextTurn(m: MatchState): MatchState['turn'] {
  if (m.phase !== 'playing') return null
  const inn = currentInnings(m)
  return { bowler: bowlerOf(m, inn), striker: strikerOf(m, inn), stage: 'bowl' }
}

export function oversText(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`
}

export function ballSymbol(o: BallOutcome) {
  if (o.wicket) return 'W'
  if (o.extra === 'wide') return o.runs > 1 ? `${o.runs}Wd` : 'Wd'
  if (o.extra === 'noball') return o.runs > 1 ? `Nb+${o.runs - 1}` : 'Nb'
  if (o.extra === 'bye') return `${o.runs}B`
  if (o.extra === 'legbye') return `${o.runs}Lb`
  return String(o.runs)
}

/** Free hit protects against every dismissal except a run out. */
export function applyFreeHit(m: MatchState, o: BallOutcome): BallOutcome {
  const inn = currentInnings(m)
  if (!inn?.freeHit || !o.wicket || o.wicket === 'run out') return o
  return { ...o, wicket: null, label: 'FREE HIT · NOT OUT', runs: o.wicket === 'caught' || o.wicket === 'caught behind' ? 0 : o.runs }
}

/** Apply a resolved ball to the match. Pure: returns a new state. */
export function applyBall(prev: MatchState, o: BallOutcome): MatchState {
  const m: MatchState = structuredClone(prev)
  const inn = currentInnings(m)
  const striker = strikerOf(m, inn)
  const bowler = bowlerOf(m, inn)
  const bs = (inn.batters[striker] ??= { runs: 0, balls: 0, fours: 0, sixes: 0, out: null })
  const ns = nonStrikerOf(m, inn)
  if (ns) inn.batters[ns] ??= { runs: 0, balls: 0, fours: 0, sixes: 0, out: null }
  const bw = (inn.bowlers[bowler] ??= { balls: 0, runs: 0, wickets: 0, dots: 0, extras: 0 })

  m.ballId += 1
  m.lastOutcome = o
  inn.runs += o.runs
  inn.thisOver.push(ballSymbol(o))

  const legal = o.extra !== 'wide' && o.extra !== 'noball'
  const extraRuns = o.extra === 'wide' ? o.runs : o.extra === 'noball' ? 1 : o.extra === 'bye' || o.extra === 'legbye' ? o.runs : 0
  const batRuns = o.runs - extraRuns
  inn.extras += extraRuns
  // Byes and leg byes don't count against the bowler.
  bw.runs += o.extra === 'bye' || o.extra === 'legbye' ? 0 : o.runs
  if (o.extra === 'wide' || o.extra === 'noball') bw.extras = (bw.extras ?? 0) + 1

  if (o.extra !== 'wide') {
    bs.balls += legal ? 1 : 0
    bs.runs += batRuns
    if (o.boundary === 4 && !o.extra) {
      bs.fours += 1
      inn.fours += 1
    }
    if (o.boundary === 6 && !o.extra) {
      bs.sixes += 1
      inn.sixes += 1
    }
  }
  if (legal) {
    inn.balls += 1
    bw.balls += 1
    if (o.runs === 0 && !o.wicket) bw.dots = (bw.dots ?? 0) + 1
  }
  inn.freeHit = o.extra === 'noball'

  // Strike rotates on odd runs actually run (a wide's penalty run isn't run).
  const ran = o.extra === 'wide' ? o.runs - 1 : o.extra === 'noball' ? o.runs - 1 : o.boundary ? 0 : o.runs
  if (ran % 2 === 1 && inn.nonStriker >= 0) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker]

  if (o.wicket) {
    inn.wickets += 1
    if (o.wicket !== 'run out') bw.wickets += 1
    const how =
      o.wicket === 'bowled' ? `b ${m.names[bowler] ?? '?'}` :
      o.wicket === 'lbw' ? `lbw b ${m.names[bowler] ?? '?'}` :
      o.wicket === 'caught' ? `c & b ${m.names[bowler] ?? '?'}` :
      o.wicket === 'caught behind' ? `c †keeper b ${m.names[bowler] ?? '?'}` :
      o.wicket === 'stumped' ? `st †keeper b ${m.names[bowler] ?? '?'}` : 'run out'
    // A run out after odd runs catches the batter who has just crossed to the far end; keep it simple: the striker of the ball.
    const outIdx = ran % 2 === 1 && inn.nonStriker >= 0 ? inn.nonStriker : inn.striker
    const outId = m.teams[inn.batting][outIdx % m.teams[inn.batting].length]
    const os = (inn.batters[outId] ??= { runs: 0, balls: 0, fours: 0, sixes: 0, out: null })
    os.out = how
    os.outs = (os.outs ?? 0) + 1
    inn.fallOfWickets.push({ runs: inn.runs, balls: inn.balls, batter: outId })
    const size = m.teams[inn.batting].length
    if (size > 1) {
      const replaceStriker = outIdx === inn.striker
      if (inn.nextBat < size) {
        if (replaceStriker) inn.striker = inn.nextBat
        else inn.nonStriker = inn.nextBat
        inn.nextBat += 1
      } else {
        // Last man stands: the survivor bats alone.
        if (replaceStriker) inn.striker = inn.nonStriker
        inn.nonStriker = -1
      }
    }
  }

  const overDone = legal && inn.balls % 6 === 0
  const totalBalls = m.settings.overs * 6
  const allOut = inn.wickets >= maxWickets(m, inn.batting)
  const chased = inn.target !== null && inn.runs >= inn.target
  const oversUp = inn.balls >= totalBalls

  if (overDone) inn.overRuns.push(inn.runs)
  if (allOut || chased || oversUp) {
    if (!overDone) inn.overRuns.push(inn.runs)
    if (m.current === 0) {
      m.phase = 'break'
      const chasing = other(inn.batting)
      m.innings.push(newInnings(chasing, m.teams[chasing].length, inn.runs + 1))
      m.current = 1
    } else {
      m.phase = 'done'
      m.result = decide(m)
    }
  } else if (overDone) {
    // New over: change ends and hand the ball to the next bowler (never the same one twice running).
    if (inn.nonStriker >= 0) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker]
    const nb = m.teams[other(inn.batting)].length
    inn.lastBowler = inn.bowlerIdx % nb
    inn.bowlerIdx += 1
    inn.thisOver = []
  }

  m.turn = nextTurn(m)
  return m
}

/** Resume play after an innings break. */
export function startSecondInnings(prev: MatchState): MatchState {
  const m: MatchState = structuredClone(prev)
  m.phase = 'playing'
  m.turn = nextTurn(m)
  return m
}

function decide(m: MatchState): { winner: TeamId | null; text: string } {
  const [a, b] = m.innings
  const nameOf = (t: TeamId) => m.settings.teamNames[t]
  if (b.runs >= (b.target ?? Infinity)) {
    const left = maxWickets(m, b.batting) - b.wickets
    const ballsLeft = m.settings.overs * 6 - b.balls
    return {
      winner: b.batting,
      text: `${nameOf(b.batting)} won by ${left} wicket${left === 1 ? '' : 's'} (${ballsLeft} ball${ballsLeft === 1 ? '' : 's'} left)`,
    }
  }
  if (b.runs === a.runs) return { winner: null, text: 'Match tied!' }
  const margin = a.runs - b.runs
  return { winner: a.batting, text: `${nameOf(a.batting)} won by ${margin} run${margin === 1 ? '' : 's'}` }
}

export function requiredRate(inn: Innings, overs: number) {
  if (inn.target === null) return null
  const need = inn.target - inn.runs
  const balls = overs * 6 - inn.balls
  if (balls <= 0) return null
  return { need, balls, rate: (need / balls) * 6 }
}
