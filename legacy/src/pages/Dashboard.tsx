import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function Dashboard() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome, {user.displayName ?? 'Player'}
        </h1>
        <p className="mt-1 text-gray-400">Your CricketVerse hub</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/tournaments/new"
          className="group cursor-pointer rounded-xl border border-gray-800 bg-gray-900/50 p-6 transition-colors hover:border-green-500/50"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20 text-green-400 transition-colors group-hover:bg-green-500/30">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h3 className="font-semibold text-white">Create Tournament</h3>
          <p className="mt-1 text-sm text-gray-400">Set up a new private tournament</p>
        </Link>

        <Link
          to="/tournaments/join"
          className="group cursor-pointer rounded-xl border border-gray-800 bg-gray-900/50 p-6 transition-colors hover:border-blue-500/50"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 transition-colors group-hover:bg-blue-500/30">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
          </div>
          <h3 className="font-semibold text-white">Join Tournament</h3>
          <p className="mt-1 text-sm text-gray-400">Enter a room code to join</p>
        </Link>

        <Link
          to="/players"
          className="group cursor-pointer rounded-xl border border-gray-800 bg-gray-900/50 p-6 transition-colors hover:border-orange-500/50 sm:col-span-1 lg:col-span-1"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 transition-colors group-hover:bg-orange-500/30">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <h3 className="font-semibold text-white">My Players</h3>
          <p className="mt-1 text-sm text-gray-400">Manage custom player profiles</p>
        </Link>

        <Link
          to="/tournaments"
          className="group cursor-pointer rounded-xl border border-gray-800 bg-gray-900/50 p-6 transition-colors hover:border-purple-500/50 sm:col-span-2 lg:col-span-1"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 transition-colors group-hover:bg-purple-500/30">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
          </div>
          <h3 className="font-semibold text-white">My Tournaments</h3>
          <p className="mt-1 text-sm text-gray-400">View your tournaments</p>
        </Link>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Activity</h2>
        <p className="text-sm text-gray-500">
          No recent activity. Create or join a tournament to get started!
        </p>
      </div>
    </div>
  )
}
