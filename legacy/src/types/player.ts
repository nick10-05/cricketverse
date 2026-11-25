import type { Timestamp } from 'firebase/firestore'

export type PlayerRole = 
  | 'batsman' 
  | 'bowler' 
  | 'all_rounder' 
  | 'wicket_keeper'

export type SkillName = 
  | 'power'
  | 'timing'
  | 'technique'
  | 'pace'
  | 'swing'
  | 'spin'
  | 'accuracy'
  | 'catching'
  | 'stamina'

export type PlayerSkills = Record<SkillName, number>

export const ALL_SKILLS: SkillName[] = [
  'power', 'timing', 'technique', 'pace', 'swing',
  'spin', 'accuracy', 'catching', 'stamina',
]

export const SKILL_GROUPS: { label: string; skills: SkillName[] }[] = [
  { label: 'Batting', skills: ['power', 'timing', 'technique'] },
  { label: 'Bowling', skills: ['pace', 'swing', 'spin', 'accuracy'] },
  { label: 'Fielding', skills: ['catching'] },
  { label: 'Physical', skills: ['stamina'] },
]

export const ROLE_RELEVANT_SKILLS: Record<PlayerRole, SkillName[]> = {
  batsman: ['power', 'timing', 'technique', 'catching', 'stamina'],
  bowler: ['pace', 'swing', 'spin', 'accuracy', 'stamina', 'catching'],
  all_rounder: ALL_SKILLS,
  wicket_keeper: ['catching', 'timing', 'technique', 'stamina'],
}

export const ROLE_LABELS: Record<PlayerRole, string> = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  all_rounder: 'All Rounder',
  wicket_keeper: 'Wicket Keeper',
}

export const ROLE_DESCRIPTIONS: Record<PlayerRole, string> = {
  batsman: 'Specialist batter focused on scoring runs',
  bowler: 'Specialist bowler focused on taking wickets',
  all_rounder: 'Balanced skills with both bat and ball',
  wicket_keeper: 'Primary wicketkeeper who can also bat',
}

export interface Player {
  id: string
  name: string
  role: PlayerRole
  skills: PlayerSkills
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CreatePlayerInput {
  name: string
  role: PlayerRole
  skills: PlayerSkills
}

export function createDefaultSkills(): PlayerSkills {
  return {
    power: 50,
    timing: 50,
    technique: 50,
    pace: 50,
    swing: 50,
    spin: 50,
    accuracy: 50,
    catching: 50,
    stamina: 50,
  }
}
