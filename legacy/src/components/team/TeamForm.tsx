import { useState, type FormEvent } from 'react'
import { ColorPicker } from '@/components/team/ColorPicker'
import { LogoUpload } from '@/components/team/LogoUpload'
import type { Team, TeamColors, UpdateTeamInput } from '@/types/tournament'

type Props = {
  team: Team
  onSubmit: (input: UpdateTeamInput) => Promise<void>
  onLogoUpload: (file: File) => Promise<void>
  onLogoRemove: () => Promise<void>
  onDelete?: () => Promise<void>
  loading: boolean
}

export function TeamForm({
  team,
  onSubmit,
  onLogoUpload,
  onLogoRemove,
  onDelete,
  loading,
}: Props) {
  const [name, setName] = useState(team.name)
  const [colors, setColors] = useState<TeamColors>(team.colors)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const hasChanges =
    name.trim() !== team.name ||
    colors.primary !== team.colors.primary ||
    colors.secondary !== team.colors.secondary

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Team name is required')
      return
    }
    if (name.length > 50) {
      setError('Team name must be 50 characters or less')
      return
    }
    if (!hasChanges) return

    try {
      await onSubmit({ name: name.trim(), colors })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    try {
      await onDelete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="teamName" className="mb-1.5 block text-sm font-medium text-gray-300">
          Team Name
        </label>
        <input
          id="teamName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white placeholder-gray-500 outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Team Colors</label>
        <ColorPicker value={colors} onChange={setColors} />
      </div>

      <LogoUpload
        currentURL={team.logoURL}
        onUpload={onLogoUpload}
        onRemove={onLogoRemove}
        disabled={loading}
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!hasChanges || loading}
          className="flex-1 cursor-pointer rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="cursor-pointer rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            {deleteConfirm ? 'Confirm Delete' : 'Delete Team'}
          </button>
        )}
      </div>

      {deleteConfirm && (
        <p className="text-xs text-gray-500">
          Click "Confirm Delete" again to permanently delete this team. This cannot be undone.
        </p>
      )}
    </form>
  )
}
