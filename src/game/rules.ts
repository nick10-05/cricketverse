import type { BallOutcome, Innings, MatchSettings, MatchState, TeamId } from './types'

export const other = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A')

export function teamSizeFor(mode: MatchSettings['mode']): number | null {
  return mode === 'team' ? null : Number(mode[0])
}

function newInnings(batting: TeamId, target: number | null): Innings {
  return {
    batting,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: 0,
    strikerIdx: 0,
    bowlerIdx: 0,
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
  const m: MatchState = {
    phase: 'playing',
    settings,
    teams,
    names,
    tossWinner,
    innings: [newInnings(batFirst, null)],
    current: 0,
    ballId: 0,
    turn: null,
    result: null,
    lastOutcome: null,
    startedAt: Date.now(),
  }
  m.turn = nextTurn(m)
  return m
}

export function maxWickets(m: MatchState, batting: TeamId) {
  return m.settings.wickets || m.teams[batting].length
}

export function currentInnings(m: MatchState) {
  return m.innings[m.current]
}

export function strikerOf(m: MatchState, inn: Innings) {
  const team = m.teams[inn.batting]
  return team[inn.strikerIdx % team.length]
}

export function bowlerOf(m: MatchState, inn: Innings) {
  const team = m.teams[other(inn.batting)]
  return team[inn.bowlerIdx % team.length]
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
  if (o.extra === 'wide') return 'Wd'
  return String(o.runs)
}

/** Apply a resolved ball to the match. Pure: returns a new state. */
export function applyBall(prev: MatchState, o: BallOutcome): MatchState {
  const m: MatchState = structuredClone(prev)
  const inn = currentInnings(m)
  const striker = strikerOf(m, inn)
  const bowler = bowlerOf(m, inn)
  const bs = (inn.batters[striker] ??= { runs: 0, balls: 0, fours: 0, sixes: 0, out: null })
  const bw = (inn.bowlers[bowler] ??= { balls: 0, runs: 0, wickets: 0 })

  m.ballId += 1
  m.lastOutcome = o
  inn.runs += o.runs
  bw.runs += o.runs
  inn.thisOver.push(ballSymbol(o))

  if (o.extra === 'wide') {
    inn.extras += o.runs
  } else {
    inn.balls += 1
    bw.balls += 1
    bs.balls += 1
    bs.runs += o.runs
    if (o.boundary === 4) bs.fours += 1
    if (o.boundary === 6) bs.sixes += 1
  }

  if (o.wicket) {
    inn.wickets += 1
    bw.wickets += 1
    bs.out = `${o.wicket} b ${m.names[bowler] ?? '?'}`
    inn.strikerIdx += 1
  }

  const overDone = o.extra !== 'wide' && inn.balls % 6 === 0
  const totalBalls = m.settings.overs * 6
  const allOut = inn.wickets >= maxWickets(m, inn.batting)
  const chased = inn.target !== null && inn.runs >= inn.target
  const oversUp = inn.balls >= totalBalls

  if (allOut || chased || oversUp) {
    if (m.current === 0) {
      m.phase = 'break'
      m.innings.push(newInnings(other(inn.batting), inn.runs + 1))
      m.current = 1
    } else {
      m.phase = 'done'
      m.result = decide(m)
    }
  } else if (overDone) {
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
