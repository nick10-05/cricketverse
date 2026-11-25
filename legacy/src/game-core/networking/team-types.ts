export type TeamRole = 'striker' | 'non_striker' | 'bowler' | 'captain'

export interface TeamRoleState {
  teamId: string
  strikerId: string
  nonStrikerId: string
  bowlerId: string
  captainId: string
  lastOverBowlerId: string | null
}

export type ChatType = 'quick' | 'custom' | 'tactical'

export type QuickChatMessage =
  | 'Good ball!'
  | 'Well bowled!'
  | 'Keep it tight'
  | 'Need wickets'
  | 'Attack!'
  | 'Defend now'
  | 'My bad'
  | 'Great shot!'
  | 'Run hard!'
  | 'Watch the spin'
  | 'Switch ends'
  | 'Line and length'

export interface TeamChatMessage {
  id: string
  senderId: string
  senderName: string
  type: ChatType
  message: string
  timestamp: number
  targetTeamId: string
}

export interface TacticalMessage {
  type: 'field_change' | 'bowl_plan' | 'bat_plan' | 'rotation'
  senderId: string
  detail: string
  timestamp: number
}

export type FieldAggression = 'aggressive' | 'neutral' | 'defensive'

export interface FieldCommand {
  captainId: string
  aggression: FieldAggression
  zoneChanges: Array<{
    playerId: string
    fromZone: import('../fielding/types').FieldingZone
    toZone: import('../fielding/types').FieldingZone
  }>
  bringBowlerIn: boolean
  timestamp: number
}

export const QUICK_CHAT_OPTIONS: QuickChatMessage[] = [
  'Good ball!',
  'Well bowled!',
  'Keep it tight',
  'Need wickets',
  'Attack!',
  'Defend now',
  'My bad',
  'Great shot!',
  'Run hard!',
  'Watch the spin',
  'Switch ends',
  'Line and length',
]

export const FIELD_AGGRESSION_OPTIONS: FieldAggression[] = ['aggressive', 'neutral', 'defensive']

export const AGGRESSION_FIELD_MAP: Record<FieldAggression, import('../fielding/types').FieldingZone[]> = {
  aggressive: [
    'slip', 'gully', 'point', 'cover', 'mid_off',
    'mid_on', 'mid_wicket', 'square_leg', 'fine_leg',
    'third_man',
  ],
  neutral: [
    'slip', 'point', 'cover', 'mid_off',
    'mid_on', 'mid_wicket', 'square_leg', 'fine_leg',
    'long_off', 'long_on',
  ],
  defensive: [
    'third_man', 'point', 'cover', 'mid_off',
    'mid_on', 'mid_wicket', 'square_leg', 'fine_leg',
    'long_off', 'long_on', 'deep_cover', 'deep_square_leg',
  ],
}

export function createTeamRoleState(
  teamId: string,
  strikerId: string,
  nonStrikerId: string,
  bowlerId: string,
  captainId: string,
): TeamRoleState {
  return {
    teamId,
    strikerId,
    nonStrikerId,
    bowlerId,
    captainId,
    lastOverBowlerId: null,
  }
}
