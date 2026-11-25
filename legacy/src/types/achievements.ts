import type { Timestamp } from 'firebase/firestore'

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type AchievementCategory = 'batting' | 'bowling' | 'fielding' | 'tournament' | 'special'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  rarity: AchievementRarity
  xpReward: number
}

export interface PlayerAchievement {
  id: string
  playerId: string
  achievementId: string
  unlocked: boolean
  unlockedAt: Timestamp | null
  progress: {
    current: number
    target: number
  }
}

export interface UnlockNotification {
  playerId: string
  achievementId: string
  name: string
  description: string
  icon: string
  rarity: AchievementRarity
  xpReward: number
}

export const RARITY_CONFIG: Record<AchievementRarity, { label: string; border: string; glow: string; bg: string; text: string }> = {
  common: {
    label: 'Common',
    border: 'border-gray-600',
    glow: 'shadow-[0_0_12px_rgba(156,163,175,0.15)]',
    bg: 'bg-gray-800/60',
    text: 'text-gray-400',
  },
  rare: {
    label: 'Rare',
    border: 'border-blue-500/50',
    glow: 'shadow-[0_0_14px_rgba(59,130,246,0.25)]',
    bg: 'bg-blue-900/20',
    text: 'text-blue-400',
  },
  epic: {
    label: 'Epic',
    border: 'border-purple-500/50',
    glow: 'shadow-[0_0_16px_rgba(168,85,247,0.3)]',
    bg: 'bg-purple-900/20',
    text: 'text-purple-400',
  },
  legendary: {
    label: 'Legendary',
    border: 'border-yellow-500/60',
    glow: 'shadow-[0_0_20px_rgba(234,179,8,0.35)]',
    bg: 'bg-yellow-900/20',
    text: 'text-yellow-400',
  },
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ── Batting ──
  { id: 'first_runs',         name: 'First Blood',          description: 'Score your first run',                    icon: '🩸', category: 'batting',    rarity: 'common',    xpReward: 25 },
  { id: 'double_digits',      name: 'Double Digits',        description: 'Score 10+ runs in a match',               icon: '🔢', category: 'batting',    rarity: 'common',    xpReward: 50 },
  { id: 'half_century',       name: 'Half Century',         description: 'Score 50+ runs in a match',               icon: '5️⃣', category: 'batting',    rarity: 'rare',      xpReward: 150 },
  { id: 'century',            name: 'Century',              description: 'Score 100+ runs in a match',              icon: '💯', category: 'batting',    rarity: 'epic',      xpReward: 500 },
  { id: 'double_century',     name: 'Double Century',       description: 'Score 200+ runs in a match',              icon: '2️⃣0️⃣0️⃣', category: 'batting',    rarity: 'legendary', xpReward: 2000 },
  { id: 'six_machine',        name: 'Six Machine',          description: 'Hit 5+ sixes in a match',                 icon: '🚀', category: 'batting',    rarity: 'rare',      xpReward: 200 },
  { id: 'boundary_fest',      name: 'Boundary Fest',        description: 'Hit 10+ fours in a match',                icon: '4️⃣', category: 'batting',    rarity: 'rare',      xpReward: 150 },
  { id: 'runs_500',           name: 'Run Accumulator',      description: 'Score 500 total runs',                    icon: '📈', category: 'batting',    rarity: 'common',    xpReward: 50 },
  { id: 'runs_2000',          name: 'Run Machine',          description: 'Score 2000 total runs',                   icon: '⚡', category: 'batting',    rarity: 'rare',      xpReward: 200 },
  { id: 'runs_5000',          name: 'Run Factory',          description: 'Score 5000 total runs',                   icon: '🏭', category: 'batting',    rarity: 'epic',      xpReward: 600 },
  { id: 'runs_10000',         name: 'Cricket Legend',       description: 'Score 10000 total runs',                  icon: '🏅', category: 'batting',    rarity: 'legendary', xpReward: 2500 },

  // ── Bowling ──
  { id: 'first_wicket',       name: 'First Wicket',         description: 'Take your first wicket',                  icon: '🎯', category: 'bowling',    rarity: 'common',    xpReward: 25 },
  { id: 'double_strike',      name: 'Double Strike',        description: 'Take 2+ wickets in a match',              icon: '2️⃣', category: 'bowling',    rarity: 'common',    xpReward: 50 },
  { id: 'four_for',           name: 'Four-Fer',             description: 'Take 4+ wickets in a match',              icon: '4️⃣', category: 'bowling',    rarity: 'rare',      xpReward: 200 },
  { id: 'five_for',           name: 'Five-For',             description: 'Take 5+ wickets in a match',              icon: '5️⃣', category: 'bowling',    rarity: 'epic',      xpReward: 500 },
  { id: 'seven_for',          name: 'Seven-For',            description: 'Take 7+ wickets in a match',              icon: '7️⃣', category: 'bowling',    rarity: 'legendary', xpReward: 2000 },
  { id: 'economy_master',     name: 'Economy Master',       description: 'Economy under 4 (min 4 overs)',            icon: '💰', category: 'bowling',    rarity: 'rare',      xpReward: 150 },
  { id: 'wickets_25',         name: 'Wicket Taker',         description: 'Take 25 total wickets',                   icon: '🖐️', category: 'bowling',    rarity: 'common',    xpReward: 50 },
  { id: 'wickets_100',        name: 'Wicket Hunter',        description: 'Take 100 total wickets',                  icon: '🎪', category: 'bowling',    rarity: 'rare',      xpReward: 250 },
  { id: 'wickets_200',        name: 'Bowling Maestro',      description: 'Take 200 total wickets',                  icon: '🎼', category: 'bowling',    rarity: 'epic',      xpReward: 750 },
  { id: 'wickets_500',        name: 'Bowling Supreme',      description: 'Take 500 total wickets',                  icon: '👑', category: 'bowling',    rarity: 'legendary', xpReward: 3000 },

  // ── Fielding ──
  { id: 'first_catch',        name: 'Safe Hands',           description: 'Take your first catch',                   icon: '🧤', category: 'fielding',   rarity: 'common',    xpReward: 25 },
  { id: 'catches_10',         name: 'Catcher',              description: 'Take 10 total catches',                   icon: '🤲', category: 'fielding',   rarity: 'common',    xpReward: 50 },
  { id: 'catches_50',         name: 'Fielder',              description: 'Take 50 total catches',                   icon: '🏏', category: 'fielding',   rarity: 'rare',      xpReward: 200 },
  { id: 'catches_100',        name: 'Golden Gloves',        description: 'Take 100 total catches',                  icon: '🥇', category: 'fielding',   rarity: 'epic',      xpReward: 600 },
  { id: 'runout_5',           name: 'Run Out King',         description: '5 run outs',                              icon: '🎯', category: 'fielding',   rarity: 'rare',      xpReward: 150 },
  { id: 'stumping_5',         name: 'Stumping Star',        description: '5 stumpings',                             icon: '⭐', category: 'fielding',   rarity: 'rare',      xpReward: 150 },

  // ── Tournament ──
  { id: 'first_match',        name: 'First Match',          description: 'Play your first match',                   icon: '🎬', category: 'tournament', rarity: 'common',    xpReward: 25 },
  { id: 'matches_25',         name: 'Match Warrior',        description: 'Play 25 total matches',                   icon: '⚔️', category: 'tournament', rarity: 'common',    xpReward: 50 },
  { id: 'matches_100',        name: 'Seasoned Player',      description: 'Play 100 total matches',                  icon: '🎖️', category: 'tournament', rarity: 'rare',      xpReward: 200 },
  { id: 'matches_250',        name: 'Veteran',              description: 'Play 250 total matches',                  icon: '🏅', category: 'tournament', rarity: 'epic',      xpReward: 600 },
  { id: 'tournament_winner',  name: 'Champion',             description: 'Win a tournament',                        icon: '🏆', category: 'tournament', rarity: 'epic',      xpReward: 500 },
  { id: 'undefeated',         name: 'Undefeated Champion',  description: 'Win a tournament without losing',          icon: '👑', category: 'tournament', rarity: 'legendary', xpReward: 2000 },
  { id: 'final_hero',         name: 'Final Hero',           description: 'Man of the Match in a final',             icon: '🌟', category: 'tournament', rarity: 'epic',      xpReward: 400 },
  { id: 'perfect_start',      name: 'Perfect Start',        description: 'Win your first match',                    icon: '✅', category: 'tournament', rarity: 'common',    xpReward: 25 },

  // ── Special ──
  { id: 'first_mom',          name: 'Man of the Match',     description: 'Win your first Man of the Match award',    icon: '🥇', category: 'special',    rarity: 'rare',      xpReward: 150 },
  { id: 'mom_3',              name: 'Match Winner',         description: 'Win 3 Man of the Match awards',            icon: '🏆', category: 'special',    rarity: 'rare',      xpReward: 200 },
  { id: 'mom_10',             name: 'MVP',                  description: 'Win 10 Man of the Match awards',           icon: '💎', category: 'special',    rarity: 'epic',      xpReward: 600 },
  { id: 'all_rounder_show',   name: 'All-Rounder Show',     description: '50+ runs & 3+ wickets in a match',        icon: '🔥', category: 'special',    rarity: 'epic',      xpReward: 500 },
  { id: 'level_10',           name: 'Rising Star',          description: 'Reach Level 10',                          icon: '⭐', category: 'special',    rarity: 'common',    xpReward: 50 },
  { id: 'level_25',           name: 'Seasoned Pro',         description: 'Reach Level 25',                          icon: '🌟', category: 'special',    rarity: 'rare',      xpReward: 200 },
  { id: 'level_50',           name: 'Cricket Veteran',      description: 'Reach Level 50',                          icon: '💎', category: 'special',    rarity: 'epic',      xpReward: 600 },
  { id: 'level_75',           name: 'Legend',               description: 'Reach Level 75',                          icon: '👑', category: 'special',    rarity: 'legendary', xpReward: 2000 },
  { id: 'level_100',          name: 'Immortal',             description: 'Reach Level 100',                         icon: '🏆', category: 'special',    rarity: 'legendary', xpReward: 5000 },
  { id: 'hat_trick',          name: 'Hat Trick',            description: 'Take 3 wickets in 3 balls',               icon: '🎩', category: 'special',    rarity: 'legendary', xpReward: 2000 },
  { id: 'perfect_over',       name: 'Perfect Over',         description: 'Bowl 6 dot balls in an over',             icon: '🎯', category: 'special',    rarity: 'rare',      xpReward: 150 },
  { id: 'sixes_20',           name: 'Six Machine II',       description: 'Hit 20 total sixes',                      icon: '🚀', category: 'special',    rarity: 'rare',      xpReward: 150 },
  { id: 'fours_50',           name: 'Boundary Lord',        description: 'Hit 50 total fours',                      icon: '4️⃣', category: 'special',    rarity: 'rare',      xpReward: 150 },
]

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))
export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length
