import type { BallOutcome, BallEvent, MatchPlayer } from '@/lib/match-engine'
import type {
  ExcitementLevel,
  CommentaryLine,
  MatchSituation,
} from './types'
import {
  calcBatterForm,
  calcBowlerForm,
  calcExcitement,
  buildCommentaryContext,
} from './context'
import { TEMPLATES, OVER_SUMMARIES, STRATEGIC } from './templates'

/* ─── Used Template Tracking ─────────────────────── */

const recentIndices = new Map<string, Set<number>>()

function pickTemplate(
  templates: { text: string; minExcitement?: ExcitementLevel }[],
  excitement: ExcitementLevel,
  typeKey: string,
  seed: number,
): string {
  const eligible = templates
    .map((t, i) => ({ ...t, idx: i }))
    .filter((t) => (t.minExcitement ?? 0) <= excitement)

  if (eligible.length === 0) return templates[0].text

  const used = recentIndices.get(typeKey) ?? new Set()
  const unused = eligible.filter((t) => !used.has(t.idx))
  const pool = unused.length > 0 ? unused : eligible

  const pos = Math.floor(((seed * 7 + 13) % 9973)) % pool.length
  const template = pool[pos]

  // Track recent
  if (!recentIndices.has(typeKey)) recentIndices.set(typeKey, new Set())
  const track = recentIndices.get(typeKey)!
  track.add(template.idx)
  if (track.size > Math.min(eligible.length - 1, 4)) {
    const first = track.values().next().value
    if (first !== undefined) track.delete(first)
  }

  return template.text
}

/* ─── Template Substitution ──────────────────────── */

function fill(template: string, batter: string, bowler: string): string {
  return template
    .replace(/\{batter\}/g, batter)
    .replace(/\{bowler\}/g, bowler)
}

/* ─── Wicket Type Key ────────────────────────────── */

function wicketTemplateKey(outcome: BallOutcome): string {
  if (outcome.wicketType && TEMPLATES.wicket[outcome.wicketType]) {
    return outcome.wicketType
  }
  return 'caught'
}

/* ─── Generate Ball Commentary ───────────────────── */

let commentCounter = 0

export function generateAdvancedCommentary(
  event: BallEvent,
  batter: MatchPlayer,
  bowler: MatchPlayer,
  matchSituation: MatchSituation,
): CommentaryLine {
  const outcome = event.outcome
  const { over, ballInOver } = event
  const b = batter.name
  const bw = bowler.name
  const seed = over * 1000 + ballInOver * 7 + event.totalScore * 13 + event.totalWickets * 31

  const batterForm = calcBatterForm(event.totalScore, 0, 0, 0)
  const bowlerForm = calcBowlerForm(event.totalWickets, 0, 0)
  const excitement = calcExcitement(outcome, matchSituation, batterForm, bowlerForm)
  const ctx = buildCommentaryContext(excitement)

  let text: string

  if (outcome.isExtra) {
    if (outcome.extraType === 'wide') {
      text = fill(pickTemplate(TEMPLATES.wide, excitement, 'wide', seed), b, bw)
    } else {
      text = fill(pickTemplate(TEMPLATES.noBall, excitement, 'noBall', seed), b, bw)
    }
  } else {
    switch (outcome.type) {
      case 'dot':
        text = fill(pickTemplate(TEMPLATES.dot, excitement, 'dot', seed), b, bw)
        break
      case 'single':
        text = fill(pickTemplate(TEMPLATES.single, excitement, 'single', seed), b, bw)
        break
      case 'double':
        text = fill(pickTemplate(TEMPLATES.double, excitement, 'double', seed), b, bw)
        break
      case 'triple':
        text = fill(pickTemplate(TEMPLATES.triple, excitement, 'triple', seed), b, bw)
        break
      case 'four':
        text = fill(pickTemplate(TEMPLATES.four, excitement, 'four', seed), b, bw)
        break
      case 'six':
        text = fill(pickTemplate(TEMPLATES.six, excitement, 'six', seed), b, bw)
        break
      case 'wicket': {
        const wkKey = wicketTemplateKey(outcome)
        const wkTemplates = TEMPLATES.wicket[wkKey] ?? TEMPLATES.wicket.caught
        text = fill(pickTemplate(wkTemplates, excitement, `wicket_${wkKey}`, seed * 3 + 7), b, bw)
        break
      }
      default:
        text = `${b} plays the ball from ${bw}.`
    }
  }

  return {
    id: `c${++commentCounter}`,
    type: 'ball',
    text: ctx.prefix + text,
    excitement,
    timestamp: Date.now(),
  }
}

/* ─── Generate Over Summary ──────────────────────── */

export function generateOverSummary(
  overNumber: number,
  runs: number,
  wickets: number,
): CommentaryLine {
  let text: string
  let excitement: ExcitementLevel = 1

  if (wickets > 0) {
    text = OVER_SUMMARIES.eventful(overNumber, runs, wickets)
    excitement = 3
  } else if (runs >= 12) {
    text = OVER_SUMMARIES.big(overNumber, runs)
    excitement = 4
  } else if (runs >= 8) {
    text = OVER_SUMMARIES.normal(overNumber, runs)
    excitement = 2
  } else {
    text = OVER_SUMMARIES.quiet(overNumber, runs)
    excitement = 1
  }

  return {
    id: `c${++commentCounter}`,
    type: 'summary',
    text,
    excitement,
    timestamp: Date.now(),
  }
}

/* ─── Generate Strategic Commentary ──────────────── */

export function generateStrategicCommentary(
  situation: MatchSituation,
): CommentaryLine {
  const text = STRATEGIC.pressure(situation.pressureIndex)

  return {
    id: `c${++commentCounter}`,
    type: 'strategic',
    text,
    excitement: Math.min(5, Math.max(1, Math.ceil(situation.pressureIndex * 5))) as ExcitementLevel,
    timestamp: Date.now(),
  }
}

/* ─── Generate Milestone Commentary ──────────────── */

export function generateMilestoneCommentary(
  name: string,
  runs: number,
  balls: number,
): CommentaryLine | null {
  const text = STRATEGIC.milestone(name, runs, balls)
  if (!text) return null

  return {
    id: `c${++commentCounter}`,
    type: 'milestone',
    text,
    excitement: runs >= 100 ? 5 : 3 as ExcitementLevel,
    timestamp: Date.now(),
  }
}

/* ─── Generate Required Rate Commentary ──────────── */

export function generateRRCommentary(
  situation: MatchSituation,
): CommentaryLine {
  return {
    id: `c${++commentCounter}`,
    type: 'strategic',
    text: STRATEGIC.requiredRate(situation.requiredRate),
    excitement: 2 as ExcitementLevel,
    timestamp: Date.now(),
  }
}

/* ─── Generate Wicket Situation ──────────────────── */

export function generateWicketAnalysis(
  wicketsLeft: number,
): CommentaryLine {
  return {
    id: `c${++commentCounter}`,
    type: 'analysis',
    text: STRATEGIC.wicketsRemaining(wicketsLeft),
    excitement: (wicketsLeft <= 3 ? 4 : wicketsLeft <= 5 ? 3 : 2) as ExcitementLevel,
    timestamp: Date.now(),
  }
}
