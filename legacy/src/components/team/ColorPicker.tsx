import { useState, useRef } from 'react'
import type { TeamColors } from '@/types/tournament'

type Props = {
  value: TeamColors
  onChange: (colors: TeamColors) => void
}

const presetPairs: TeamColors[] = [
  { primary: '#22c55e', secondary: '#166534' },  // Green
  { primary: '#3b82f6', secondary: '#1e40af' },  // Blue
  { primary: '#ef4444', secondary: '#991b1b' },  // Red
  { primary: '#f59e0b', secondary: '#92400e' },  // Amber
  { primary: '#8b5cf6', secondary: '#5b21b6' },  // Purple
  { primary: '#ec4899', secondary: '#9d174d' },  // Pink
  { primary: '#14b8a6', secondary: '#0f766e' },  // Teal
  { primary: '#f97316', secondary: '#9a3412' },  // Orange
  { primary: '#6b7280', secondary: '#374151' },  // Gray
  { primary: '#1e293b', secondary: '#0f172a' },  // Dark
]

export function ColorPicker({ value, onChange }: Props) {
  const [tab, setTab] = useState<'preset' | 'custom'>('preset')
    const primaryRef = useRef<HTMLInputElement>(null)
    const secondaryRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-gray-900 p-0.5">
        <button
          type="button"
          onClick={() => setTab('preset')}
          className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === 'preset' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Presets
        </button>
        <button
          type="button"
          onClick={() => setTab('custom')}
          className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === 'custom' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Custom
        </button>
      </div>

      {tab === 'preset' ? (
        <div className="grid grid-cols-5 gap-2">
          {presetPairs.map((pair, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(pair)}
              className={`cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${
                value.primary === pair.primary && value.secondary === pair.secondary
                  ? 'border-white'
                  : 'border-transparent hover:border-gray-600'
              }`}
            >
              <div className="flex h-8">
                <div className="flex-1" style={{ backgroundColor: pair.primary }} />
                <div className="flex-1" style={{ backgroundColor: pair.secondary }} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400 min-w-20">Primary</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => primaryRef.current?.click()}
                className="h-8 w-8 cursor-pointer rounded-lg border border-gray-700"
                style={{ backgroundColor: value.primary }}
              />
              <input
                ref={primaryRef}
                type="color"
                value={value.primary}
                onChange={(e) => onChange({ ...value, primary: e.target.value })}
                className="sr-only"
              />
              <span className="text-xs font-mono text-gray-400">{value.primary}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400 min-w-20">Secondary</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => secondaryRef.current?.click()}
                className="h-8 w-8 cursor-pointer rounded-lg border border-gray-700"
                style={{ backgroundColor: value.secondary }}
              />
              <input
                ref={secondaryRef}
                type="color"
                value={value.secondary}
                onChange={(e) => onChange({ ...value, secondary: e.target.value })}
                className="sr-only"
              />
              <span className="text-xs font-mono text-gray-400">{value.secondary}</span>
            </div>
          </div>
          <div className="mt-2 flex h-10 overflow-hidden rounded-lg">
            <div className="flex-1" style={{ backgroundColor: value.primary }} />
            <div className="flex-1" style={{ backgroundColor: value.secondary }} />
          </div>
        </div>
      )}
    </div>
  )
}
