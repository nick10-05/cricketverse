import { type BallOutcome, type MatchPlayer } from './types'

const dotLines = [
  (b: string, bw: string) => `${bw} bowls a good delivery, ${b} defends it back to the bowler. No run.`,
  (b: string, bw: string) => `${bw} to ${b}, tapped to the off side, no run taken.`,
  (b: string, _bw: string) => `${b} pushes forward, the ball goes straight to mid-off. Dot ball.`,
  (b: string, bw: string) => `Excellent bowling from ${bw}! ${b} is forced to defend.`,
  (b: string, bw: string) => `${b} plays and misses! Beaten all ends up by ${bw}.`,
  (b: string, bw: string) => `Short from ${bw}, ${b} cuts but finds the fielder. No run.`,
  (b: string, _bw: string) => `Full delivery, ${b} drives straight to cover. Well fielded.`,
  (b: string, bw: string) => `${bw} fires it in, ${b} blocks from the crease. Another dot.`,
]

const singleLines = [
  (b: string, _bw: string) => `${b} pushes to mid-on and sets off for a quick single.`,
  (b: string, _bw: string) => `Worked away to square leg for a single by ${b}.`,
  (b: string, bw: string) => `${bw} bowls, ${b} nudges it to fine leg and scampers across.`,
  (b: string, _bw: string) => `Tapped to third man, easy single for ${b}.`,
  (b: string, _bw: string) => `${b} drives through the covers, just a single. Good running.`,
  (b: string, _bw: string) => `Deflected to backward square leg, ${b} takes the single.`,
  (b: string, _bw: string) => `Soft hands from ${b}, the ball rolls to short third. Single taken.`,
]

const doubleLines = [
  (b: string, _bw: string) => `${b} drives through the gap, comes back for the second! Good running.`,
  (b: string, _bw: string) => `Punched through the off side, ${b} turns for two!`,
  (b: string, _bw: string) => `${b} clips it off the pads, they rush back for two.`,
  (b: string, _bw: string) => `Well run! ${b} works it into the leg side and they come back for the second.`,
]

const tripleLines = [
  (b: string, _bw: string) => `${b} cracks it through extra cover, they sprint three! Great running.`,
  (b: string, _bw: string) => `Excellent placement from ${b}, all the way to the deep. Three runs.`,
]

const fourLines = [
  (b: string, bw: string, short: boolean) =>
    short
      ? `Short from ${bw}, ${b} rocks back and cuts it past point for FOUR!`
      : `${b} drives elegantly through the covers, beats the fielder, FOUR!`,
  (b: string, _bw: string, short: boolean) =>
    short
      ? `Short and wide! ${b} throws the hands and slashes it through backward point for FOUR!`
      : `Full delivery, ${b} presents the full face of the bat and drives it straight down the ground for FOUR!`,
  (b: string, _bw: string, _short: boolean) => `${b} picks the length early and pulls it over mid-wicket! FOUR!`,
  (b: string, _bw: string, short: boolean) =>
    short
      ? `Pulled away by ${b}, no one in the deep. Boundary!`
      : `Smashed through the off side by ${b}! The rope saves the fielder.`,
  (b: string, _bw: string, _short: boolean) => `Glanced off the pads, beats fine leg! FOUR for ${b}.`,
]

const sixLines = [
  (b: string, _bw: string) => `${b} launches it over long-on! That's a massive SIX!`,
  (b: string, _bw: string) => `Down the track, ${b} sends it into the stands over mid-wicket! SIX!`,
  (b: string, bw: string) => `${bw} drops it short, ${b} pulls it over square leg for SIX!`,
  (_b: string, _bw: string) => `In the air and over the keeper's head! Goes all the way for SIX!`,
  (b: string, _bw: string) => `${b} gets underneath it and launches it over deep mid-wicket! SIX!`,
  (b: string, _bw: string) => `That's out of the ground! ${b} smashes it into the stands!`,
]

const wicketLines: Record<string, (b: string, bw: string) => string> = {
  bowled: (b: string, bw: string) =>
    `Bowled him! ${bw} sends down a beauty, it crashes into the stumps! ${b} has to walk back.`,
  caught: (b: string, bw: string) =>
    `Edged and taken! ${bw} gets the wicket, the fielder takes a clean catch. ${b} departs.`,
  lbw: (b: string, bw: string) =>
    `Plumb in front! ${bw} raps ${b} on the pads, the finger goes up! LBW!`,
  run_out: (b: string, _bw: string) =>
    `Run out! Direct hit from the deep and ${b} is short of the crease!`,
  stumped: (b: string, _bw: string) =>
    `Stumped! ${b} dances down the track, misses, and the keeper whips the bails off!`,
  hit_wicket: (b: string, _bw: string) =>
    `Hit wicket! ${b} steps back and knocks the stumps over. What a unfortunate way to go!`,
}

const wideLines = [
  (bw: string) => `Down the leg side, called wide by the umpire. ${bw} will have to reload.`,
  (_bw: string) => `Sprayed down the leg side! Wide signaled.`,
  (bw: string) => `Too far outside off, ${bw} concedes a wide.`,
]

const noBallLines = [
  (_b: string, bw: string) => `No ball! ${bw} oversteps. Free hit coming up!`,
  (_b: string, bw: string) => `Called for no ball! ${bw} has overstepped.`,
]

export function generateCommentary(
  outcome: BallOutcome,
  batter: MatchPlayer,
  bowler: MatchPlayer,
  totalScore: number,
  totalWickets: number,
  over: number,
  ball: number,
  _isExtraDelivery: boolean,
): string {
  const b = batter.name
  const bw = bowler.name
  const rng = mulberry32((over * 1000 + ball * 7 + totalScore * 13 + totalWickets * 31) >>> 0)

  if (outcome.isExtra) {
    if (outcome.extraType === 'wide') {
      return pick(rng, wideLines)(bw)
    }
    if (outcome.extraType === 'no_ball') {
      return pick(rng, noBallLines)(b, bw)
    }
  }

  switch (outcome.type) {
    case 'dot':
      return pick(rng, dotLines)(b, bw)
    case 'single':
      return pick(rng, singleLines)(b, bw)
    case 'double':
      return pick(rng, doubleLines)(b, bw)
    case 'triple':
      return pick(rng, tripleLines)(b, bw)
    case 'four': {
      const short = rng() % 2 === 0
      return pick(rng, fourLines)(b, bw, short)
    }
    case 'six':
      return pick(rng, sixLines)(b, bw)
    case 'wicket':
      if (outcome.wicketType && wicketLines[outcome.wicketType]) {
        return wicketLines[outcome.wicketType](b, bw)
      }
      return `${bw} strikes! ${b} is on the way back to the pavilion.`
    default:
      return `${b} plays the ball from ${bw}.`
  }
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}
