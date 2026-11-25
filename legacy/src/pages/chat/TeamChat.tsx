import { useParams, Link } from 'react-router-dom'
import { ChatWindow } from '@/components/chat/ChatWindow'

export function TeamChat() {
  const { tournamentId, teamId } = useParams<{ tournamentId: string; teamId: string }>()

  return (
    <div>
      <div className="mb-4">
        <Link
          to={`/tournaments/${tournamentId}/team/edit`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to team
        </Link>
      </div>

      <ChatWindow
        chatType="team"
        chatId={teamId ?? ''}
        title="Team Chat"
        subtitle="Your team conversation"
      />
    </div>
  )
}
