import { useState, useRef } from 'react'

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Cricket',
    emojis: ['🏏', '🏆', '🎯', '🔥', '💯', '⭐', '👏', '🙌', '💪', '🎉', '🏅', '🥇'],
  },
  {
    label: 'Faces',
    emojis: ['😀', '😂', '😎', '🤩', '😍', '🥳', '😤', '😅', '🤔', '😢', '🙏', '👍'],
  },
  {
    label: 'Hands',
    emojis: ['👋', '✌️', '🤝', '👊', '✊', '🤞', '👌', '❤️', '💀', '🎊', '✨', '💥'],
  },
  {
    label: 'Objects',
    emojis: ['🎁', '🎂', '🍕', '☕', '🍺', '🌮', '🎵', '🎶', '📸', '🔔', '⚡', '💡'],
  },
]

type Props = {
  onSelect: (emoji: string) => void
  open: boolean
  onToggle: () => void
}

export function EmojiPicker({ onSelect, open }: Props) {
  if (!open) return null

  return (
    <div className="absolute bottom-14 left-0 z-50 rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-2xl">
      <div className="max-h-60 overflow-y-auto">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.label} className="mb-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {cat.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSelect(emoji)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-lg transition-colors hover:bg-gray-800"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type InputProps = {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder }: InputProps) {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className="relative border-t border-gray-800 bg-gray-900/80 p-3">
      <EmojiPicker
        open={showEmoji}
        onToggle={() => setShowEmoji(!showEmoji)}
        onSelect={handleEmojiSelect}
      />

      <div className="flex items-end gap-2">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className="mb-0.5 cursor-pointer rounded-lg p-2 text-lg text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          title="Emoji"
        >
          😀
        </button>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            handleInput()
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Type a message...'}
          rows={1}
          disabled={disabled}
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-green-500"
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="mb-0.5 cursor-pointer rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
