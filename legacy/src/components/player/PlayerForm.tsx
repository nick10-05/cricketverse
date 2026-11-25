import { useState, type FormEvent } from 'react'
import {
  type PlayerRole,
  type PlayerSkills,
  type CreatePlayerInput,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  SKILL_GROUPS,
  ALL_SKILLS,
  createDefaultSkills,
} from '@/types/player'

type Props = {
  initial?: { name: string; role: PlayerRole; skills: PlayerSkills }
  onSubmit: (input: CreatePlayerInput) => Promise<void>
  loading: boolean
}

export function PlayerForm({ initial, onSubmit, loading }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState<PlayerRole>(initial?.role ?? 'batsman')
  const [skills, setSkills] = useState<PlayerSkills>(initial?.skills ?? createDefaultSkills())
  const [error, setError] = useState<string | null>(null)

  const totalPoints = ALL_SKILLS.reduce((sum, s) => sum + skills[s], 0)
  const canSubmit = name.trim().length > 0 && !loading

  const setSkill = (skill: keyof PlayerSkills, value: number) => {
    setSkills((prev) => ({ ...prev, [skill]: Math.max(1, Math.min(100, value)) }))
  }

  const resetToDefaults = () => {
    setSkills(createDefaultSkills())
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!canSubmit) return
    try {
      await onSubmit({ name: name.trim(), role, skills })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save player')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Name ─────────────────────────────────────── */}
      <div>
        <label htmlFor="playerName" className="mb-1.5 block text-sm font-medium text-gray-300">
          Player Name
        </label>
        <input
          id="playerName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Virat Kohli"
          maxLength={60}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white placeholder-gray-500 outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* ── Role ──────────────────────────────────────── */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Role</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(ROLE_LABELS) as PlayerRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors ${
                role === r
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="text-sm font-medium text-white">{ROLE_LABELS[r]}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-gray-500">
                {ROLE_DESCRIPTIONS[r]}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Skills ────────────────────────────────────── */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Skills</label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              Total: <span className="font-mono text-gray-300">{totalPoints}</span>/900
            </span>
            <button
              type="button"
              onClick={resetToDefaults}
              className="cursor-pointer text-xs text-gray-500 hover:text-gray-300"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          {SKILL_GROUPS.map((group) => (
            <div key={group.label}>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {group.label}
              </h4>
              <div className="space-y-3">
                {group.skills.map((skill) => (
                  <SkillSlider
                    key={skill}
                    name={skill}
                    value={skills[skill]}
                    onChange={(v) => setSkill(skill, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Submit ────────────────────────────────────── */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full cursor-pointer rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Saving...' : initial ? 'Update Player' : 'Create Player'}
      </button>
    </form>
  )
}

/* ─── Skill Slider ───────────────────────────────────── */

function SkillSlider({
  name,
  value,
  onChange,
}: {
  name: string
  value: number
  onChange: (v: number) => void
}) {
  const pct = ((value - 1) / 99) * 100

  const trackColor =
    value < 35 ? '#ef4444' : value < 65 ? '#f59e0b' : '#22c55e'

  return (
    <div className="group">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm capitalize text-gray-400">{name}</label>
        <div className="flex items-center gap-2">
          <span
            className="min-w-[2.5rem] text-right text-sm font-bold tabular-nums"
            style={{ color: trackColor }}
          >
            {value}
          </span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-xs ${
                  value >= star * 20 ? 'text-yellow-400' : 'text-gray-700'
                }`}
              >
                ★
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full transition-all duration-150"
          style={{ width: `${pct}%`, backgroundColor: trackColor }}
        />
      </div>
      <input
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full cursor-pointer accent-green-500 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ height: 0, margin: 0 }}
      />
    </div>
  )
}
