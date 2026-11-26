/**
 * How long one ball takes to play out on screen. The 3D view uses these constants to animate, and
 * the room uses ballAnimationMs to know when every screen is ready for the next ball, so bots never
 * rush ahead or leave players waiting. Pure: no browser or Node APIs.
 */
import { bowlStyle, trajectory } from './physics'
import type { BallOutcome, Delivery, PathPoint } from './types'

/** After contact the live view runs a little faster than real time, so hits resolve briskly. */
export const POST_SPEED = 1.25
/** Playback speed of the slow-motion replay of sixes and wickets. */
export const REPLAY_SPEED = 0.6
/** View-seconds between the result and the start of the replay. */
export const REPLAY_DELAY = 0.7
/** View-seconds the result stays on screen before the next ball (when there is no replay). */
export const LINGER = 1.3

const pathEnd = (p: PathPoint[]) => (p.length ? p[p.length - 1].t : 0)

/** Live slow-motion windows [from, to, rate] in view time (the 3D view eases in and out of them). */
export function slowWindows(d: Delivery, o: BallOutcome, hitTime: number): [number, number, number][] {
  const tr = trajectory(d)
  if (!o.path.length) {
    if (o.wicket === 'bowled') return [[tr.tStumps - 0.04, tr.tStumps + 0.3, 0.3]]
    if (o.wicket === 'stumped') return [[tr.tStumps + 0.24, tr.tStumps + 0.55, 0.35]]
    return []
  }
  const end = hitTime + pathEnd(o.path)
  if (o.boundary === 6) return [[hitTime + 0.08, hitTime + 0.4, 0.35]]
  if (o.wicket === 'caught') return [[end - 0.28, end + 0.12, 0.35]]
  if (o.wicket === 'run out' && o.throwPath.length) {
    const te = hitTime + pathEnd(o.throwPath)
    return [[te - 0.22, te + 0.2, 0.35]]
  }
  return []
}

/** View time at which the result is shown. */
export function resultTime(d: Delivery, o: BallOutcome, hitTime: number) {
  const tr = trajectory(d)
  if (o.path.length) return hitTime + pathEnd(o.path) + (o.wicket === 'run out' && o.throwPath.length ? pathEnd(o.throwPath) - pathEnd(o.path) : 0)
  return o.wicket === 'bowled' || o.wicket === 'lbw' ? tr.tStumps + 0.05 : tr.tStumps + 0.25
}

/** The [from, to] view-time span of the slow-motion replay. */
export function replaySpan(d: Delivery, o: BallOutcome, hitTime: number): [number, number] {
  const tr = trajectory(d)
  if (o.path.length) return [hitTime - 0.5, Math.min(resultTime(d, o, hitTime), hitTime + 0.95)]
  return [tr.tStumps - 0.6, tr.tStumps + 0.5]
}

/** Real milliseconds from the start of the run-up until the screen is ready for the next ball. */
export function ballAnimationMs(d: Delivery, o: BallOutcome) {
  const tr = trajectory(d)
  const hit = tr.tContact // the bat meets the ball within a few ms of this
  const result = resultTime(d, o, hit)
  let s = bowlStyle(d.type).runup + hit + Math.max(0, result - hit) / POST_SPEED
  for (const [a, b, rate] of slowWindows(d, o, hit)) s += (b - a) * (1 / rate - 1 / POST_SPEED)
  if (o.path.length && (o.grade === 'perfect' || o.boundary)) s += 0.12 // the freeze-frame at contact
  if (o.boundary === 6 || o.wicket) {
    const [from, to] = replaySpan(d, o, hit)
    s += REPLAY_DELAY / POST_SPEED + (to - from) / REPLAY_SPEED
  } else s += LINGER / POST_SPEED
  return Math.round(s * 1000) + 250 // a little slack for frame timing and the network
}
