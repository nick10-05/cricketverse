import type { ExcitementLevel } from './types'

export interface TemplateSet {
  dot: Template[]
  single: Template[]
  double: Template[]
  triple: Template[]
  four: Template[]
  six: Template[]
  wicket: Record<string, Template[]>
  wide: Template[]
  noBall: Template[]
}

export interface Template {
  text: string
  minExcitement?: ExcitementLevel
}

/* ─── Templates grouped by excitement context ────── */

export const TEMPLATES: TemplateSet = {

  /* ═══════ DOTS ═══════ */
  dot: [
    { text: '{bowler} bowls a probing line, {batter} defends solidly. No run.' },
    { text: 'Tapped to mid-off by {batter}. Dot ball.' },
    { text: '{batter} pushes forward, finds mid-on. Another dot.' },
    { text: '{bowler} is building the pressure! {batter} can\'t get it away.' },
    { text: 'Play and a miss! {batter} beaten by {bowler}!' },
    { text: 'Short from {bowler}, {batter} cuts but finds the fielder.' },
    { text: 'Full and straight, {batter} drives to cover. Well fielded.' },
    { text: '{bowler} fires in yorker length, {batter} digs it out.' },
    { text: 'Defended back to {bowler}. No interest from the batter.' },
    { text: 'On the back foot, {batter} punches to point. No run.' },
    { text: '{batter} watches it go by outside off. Good leave.' },
    { text: 'Beaten on the outside edge! {bowler} is getting movement.' },
    { text: 'Bowled with pace, {batter} is stuck on the crease. Dot.' },
    { text: 'Squared up! {batter} survives but that was close.' },
    { text: '{bowler} showing great control. {batter} frustrated.' },
    // High excitement dots
    { text: '💥 EXCELLENT BOWLING! {batter} completely fooled by {bowler}!', minExcitement: 3 },
    { text: '🔥 Defended, but the crowd roars! Building towards something big!', minExcitement: 4 },
  ],

  /* ═══════ SINGLES ═══════ */
  single: [
    { text: '{batter} pushes to mid-on and sets off. Quick single.' },
    { text: 'Worked to square leg, easy single for {batter}.' },
    { text: 'Nudged to fine leg, they scamper across.' },
    { text: 'Tapped to third man. Single taken.' },
    { text: '{batter} drives through the covers. Just a single.' },
    { text: 'Soft hands, rolls to short third. Single.' },
    { text: 'Turned to mid-wicket, {batter} wants the single. There it is.' },
    { text: 'Dropped at short cover! They take the single.' },
    { text: 'Punched to long-on. Just one.' },
    { text: '{batter} works it off the hip. Single to deep square.' },
    { text: 'Quick running! Could have been risky but they make it.' },
    { text: 'Deflected to backward point, they take the single.' },
    { text: 'Pushed past the bowler. {batter} calls yes and goes.' },
    { text: 'Flicked off the pads, fine leg keeps them to one.' },
  ],

  /* ═══════ DOUBLES ═══════ */
  double: [
    { text: '{batter} drives through the gap and comes back for TWO! Good running.' },
    { text: 'Punched through the off side, they turn for two!' },
    { text: '{batter} clips it off the pads, rushing back for two.' },
    { text: 'Well run! Worked into the leg side, back for the second.' },
    { text: 'Cracked through extra cover! They push hard for two.' },
    { text: 'Down the ground! The fielder chases, they come back for two.' },
    { text: 'Split the fielders! {batter} pushes for two and makes it comfortably.' },
    { text: 'Excellent placement, the outfield is quick but they get two.' },
    // High excitement
    { text: '🔥 DROPPED! They scramble back for a second run!', minExcitement: 3 },
  ],

  /* ═══════ TRIPLES ═══════ */
  triple: [
    { text: 'Cracked through the covers! They sprint for THREE! Great running.' },
    { text: 'Excellent placement from {batter}, all the way to the deep. Three.' },
    { text: 'Down to long-off, they push hard and get three. Agile running.' },
    { text: 'Split the gap and they keep running! Three runs.' },
    { text: 'Pounded to deep mid-wicket, they turn for the third! Yes!' },
  ],

  /* ═══════ FOURS ═══════ */
  four: [
    // Short-pitched
    { text: 'Short from {bowler}, {batter} ROCKS back and cuts past point! FOUR!' },
    { text: 'Short and WIDE! {batter} slashes through backward point! FOUR!' },
    { text: 'Pulled away fiercely! No one in the deep, boundary!' },
    { text: 'Short ball punished! {batter} was waiting for that.' },
    // Full
    { text: '{batter} drives elegantly through the covers! Beats the fielder, FOUR!' },
    { text: 'Full and driven straight down the ground! Gorgeous shot!' },
    { text: 'Pressed through the line, beats mid-off. CLASSY from {batter}.' },
    { text: 'Danced down and lofted inside-out! Four more!' },
    // Off pads
    { text: 'Glanced off the pads, beats fine leg! FOUR for {batter}!' },
    { text: 'Flicked off the toes, races away to the mid-wicket boundary.' },
    // Late cuts / guides
    { text: 'Late cut, third man can only watch. Slips away for FOUR.' },
    { text: 'Guided past the keeper, down to third man. Nice placement.' },
    // High excitement
    { text: '🔥 {batter} launches over the in-field! FOUR more! The crowd is UP!', minExcitement: 3 },
    { text: '💥 SLAPPED through the off side! That went like a bullet!', minExcitement: 3 },
    { text: '🚀 {batter} is on FIRE! That\'s back-to-back boundaries!', minExcitement: 4 },
  ],

  /* ═══════ SIXES ═══════ */
  six: [
    { text: '{batter} LAUNCHES it over long-on! That\'s a MASSIVE SIX!' },
    { text: 'Down the track and INTO THE STANDS! SIX for {batter}!' },
    { text: 'Short ball pulled over square leg! SIX! The crowd erupts!' },
    { text: 'In the air... and over the keeper! All the way for SIX!' },
    { text: '{batter} gets underneath it and launches over deep mid-wicket!' },
    { text: 'OUT OF THE GROUND! {batter} SMASHES it!' },
    { text: 'Lofted straight back over {bowler}\'s head! One bounce and over!' },
    { text: 'Picked the length early and deposited into the stands!' },
    { text: 'That\'s HUGE! {batter} sends it into the orbit!' },
    // High excitement only
    { text: '🔥🔥🔥 {batter} has HIT THE ROOF! That\'s a MONSTER SIX!', minExcitement: 4 },
    { text: '💥 SIX! SIX! SIX! {batter} is TURNING THE GAME AROUND!', minExcitement: 4 },
    { text: '🚀 GONE! GONE! GONE! That ball has a FLIGHT NUMBER!', minExcitement: 5 },
  ],

  /* ═══════ WICKETS ═══════ */
  wicket: {
    bowled: [
      { text: 'BOWLED HIM! {bowler} sends down a BEAUTY, crashes into the stumps!' },
      { text: 'Castled! Middle stump knocked back! {batter} is stunned.' },
      { text: 'That\'s unplayable! {batter} had no answer to that.' },
      { text: 'Off stump cartwheeling! {batter} walks back in disbelief.' },
    ],
    caught: [
      { text: 'Edged and TAKEN! {bowler} gets the wicket! Clean catch in the slips.' },
      { text: 'Chipped to mid-on! Easy catch. {batter} departs.' },
      { text: 'Slices it in the air! The fielder settles under it. OUT!' },
      { text: 'Top-edged! The keeper calls for it and takes it comfortably.' },
      { text: 'Driven in the air, straight to cover! {bowler} is delighted!' },
    ],
    lbw: [
      { text: 'PLUMB in front! {bowler} raps {batter} on the pads! UP GOES THE FINGER!' },
      { text: 'Dead in front! That was going on to hit middle and leg. LBW!' },
      { text: 'Trapped on the crease! The umpire had no doubt about that.' },
      { text: 'Beaten by the angle, strikes the pad. Gone! {batter} reviews but it\'s hitting.' },
    ],
    run_out: [
      { text: 'RUN OUT! Direct hit from the deep! {batter} is short!' },
      { text: 'Miscommunication! Both batters at the same end. Run out!' },
      { text: 'Quick thinking in the field! The bails are off! {batter} just short.' },
      { text: 'THROWN DOWN! That\'s a rocket arm from the fielder!' },
    ],
    stumped: [
      { text: 'STUMPED! {batter} dances down, misses, the keeper whips the bails off!' },
      { text: 'Lured out of the crease! Beaten by the spin and stumped! Brilliant!' },
      { text: 'Gone down the track and left stranded! The keeper does the rest.' },
    ],
    hit_wicket: [
      { text: 'HIT WICKET! {batter} steps back and dislodges the bails! Unlucky!' },
      { text: 'What a bizarre way to go! {batter} has knocked the stumps over!' },
      { text: 'Disaster for {batter}! Stepped on the stumps while playing the shot.' },
    ],
  },

  /* ═══════ WIDES ═══════ */
  wide: [
    { text: 'Down the leg side, called WIDE. {bowler} will have to reload.' },
    { text: 'Sprayed down the leg side! Wide signaled.' },
    { text: 'Too far outside off. Wide.' },
    { text: 'Slipped down the leg side. The umpire stretches his arms.' },
    { text: 'That\'s going down leg. Not acceptable at this level!' },
  ],

  /* ═══════ NO BALLS ═══════ */
  noBall: [
    { text: 'NO BALL! {bowler} has overstepped! Free hit coming up!' },
    { text: 'Called for NO BALL! Front foot over the line.' },
    { text: 'Oversteps! The umpire signals no ball. {batter} will get a free hit.' },
  ],
}

/* ─── Over Summary Templates ─────────────────────── */

export const OVER_SUMMARIES = {
  quiet: (_: number, runs: number) => `${runs < 2 ? 'A tidy over' : 'A quiet over'} — ${runs} run${runs !== 1 ? 's' : ''} from it.`,
  normal: (over: number, runs: number) => `${over} runs from Over ${over}.${runs >= 8 ? ' The batters are accelerating!' : runs <= 3 ? ' Tight bowling!' : ''}`,
  eventful: (_over: number, runs: number, wickets: number) => `Eventful over! ${runs} runs and ${wickets} wicket${wickets !== 1 ? 's' : ''} from it. The game is shifting!`,
  big: (over: number, runs: number) => `BIG OVER! ${runs} runs coming from Over ${over}. The momentum is with the batting side!`,
}

/* ─── Strategic Commentary ───────────────────────── */

export const STRATEGIC = {
  requiredRate: (rate: number) =>
    rate < 5 ? 'The required rate is under control. Just need to rotate strike.'
    : rate < 8 ? 'Required rate creeping up. Time for some boundaries.'
    : rate < 12 ? 'Required rate above 10. The batters need to take risks now!'
    : 'Required rate over 12! Only boundaries will do!',

  wicketsRemaining: (w: number) =>
    w >= 8 ? 'Plenty of wickets in hand. The batters can play with freedom.'
    : w >= 5 ? 'Wickets are starting to matter. Need to balance attack and caution.'
    : w >= 3 ? 'Tailing off! The lower order is exposed. Every wicket is crucial.'
    : 'Last recognized pair at the crease!',

  pressure: (p: number) =>
    p < 0.2 ? 'The game is in a comfortable phase.'
    : p < 0.4 ? 'Slight advantage building. Things are heating up.'
    : p < 0.6 ? 'The pressure is building! Every run matters here.'
    : p < 0.8 ? 'HIGH PRESSURE situation! Can someone step up?'
    : 'MAXIMUM PRESSURE! The crowd can barely watch!',

  milestone: (name: string, runs: number, balls: number) => {
    if (runs >= 100) return `CENTURY for ${name}! ${balls} balls. A magnificent innings!`
    if (runs >= 50) return `FIFTY for ${name}! Came off ${balls} balls. Well played!`
    return ''
  },
}
